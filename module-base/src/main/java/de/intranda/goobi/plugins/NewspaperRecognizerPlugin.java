package de.intranda.goobi.plugins;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.lang.reflect.Type;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import de.intranda.goobi.plugins.newspaper.*;
import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.configuration.XMLConfiguration;
import org.apache.commons.lang3.StringUtils;
import org.goobi.beans.Process;
import org.goobi.beans.Step;
import org.goobi.managedbeans.StepBean;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;

import de.sub.goobi.config.ConfigPlugins;
import de.sub.goobi.forms.HelperForm;
import de.sub.goobi.helper.Helper;
import de.sub.goobi.helper.HelperSchritte;
import de.sub.goobi.helper.StorageProvider;
import de.sub.goobi.helper.enums.StepStatus;
import de.sub.goobi.helper.exceptions.DAOException;
import de.sub.goobi.helper.exceptions.SwapException;
import de.sub.goobi.metadaten.Image;
import de.sub.goobi.persistence.managers.StepManager;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.extern.log4j.Log4j2;
import net.xeoh.plugins.base.annotations.PluginImplementation;
import ugh.dl.ContentFile;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.DocStructType;
import ugh.dl.FileSet;
import ugh.dl.Fileformat;
import ugh.dl.Metadata;
import ugh.dl.MetadataType;
import ugh.dl.Prefs;
import ugh.dl.RomanNumeral;
import ugh.exceptions.MetadataTypeNotAllowedException;
import ugh.exceptions.TypeNotAllowedAsChildException;
import ugh.exceptions.TypeNotAllowedForParentException;

@PluginImplementation
@Log4j2
@Data
@EqualsAndHashCode(callSuper = false)
public class NewspaperRecognizerPlugin extends AbstractStepPlugin implements IStepPlugin, IPlugin {
    private static final long serialVersionUID = -4130813487217128097L;
    private static final String PLUGIN_NAME = "intranda_step_newspaperRecognizer";
    private static final String GUI = "/uii/plugin_newspaperRecognizer.xhtml";
    private static final String ISSUE_RESULT_LOCATION = "/taskmanager/issues_result.json";
    private static final String ISSUE_RESULT_MANUAL_LOCATION = "/taskmanager/issues_result_manual.json";
    private static final DateTimeFormatter w3cdtf = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Pattern TITLE_GENERATOR_DATE_PATTERN = Pattern.compile("\\{date:(.*)\\}");
    private static final Pattern TITLE_GENERATOR_ISSUE_NUMBER_PATTERN = Pattern.compile("\\{no\\}");
    private static final Pattern TITLE_GENERATOR_ISSUE_PART_NUMBER_PATTERN = Pattern.compile("\\{partNo\\}");

    // Hard-coded metadata type names for special purposes
    private static final String LOGICAL_PHYSICAL_TYPE = "logical_physical";
    private static final String PAGE_TYPE_NAME = "page";
    private static final String PART_NUMBER_TYPE_NAME = "PartNumber";
    private static final String NUMBER_TYPE_NAME = "CurrentNo";
    private static final String NUMBER_SORT_TYPE_NAME = "CurrentNoSorting";
    private static final String DATE_ISSUED_TYPE_NAME = "DateIssued";
    private static final String DATE_ISSUED_TYPE_NAME_ALTERNATIVE = "PublicationYear";
    private static final String LOG_PAGE_NO_TYPE_NAME = "logicalPageNumber";
    private static final String PHYS_PAGE_NO_TYPE_NAME = "physPageNumber";

    private int tocDepth = 0;

    private boolean loadAllImages;
    private boolean showWriteMetsButton = true;
    private boolean showDeletePageButton = false;
    private String dateFormatDelimiter = ".";
    private transient DateTimeFormatter dateFormat = DateTimeFormatter.ofPattern("dd.MM.yyyy");
    private boolean writePageTitle = true;

    private String fileNameToDelete = null;
    private int fileIdToDelete;

    // whether or not to create new paginations
    private boolean createNewPagination;
    // which pagination type should be used, if blank or "-", then create no pagination, otherwise create paginations
    private String paginationType;
    // whether or not to use fake pagination, if true then use the form [N] where N is a number, otherwise use the bare N itself
    private boolean useFakePagination;

    private Map<String, DocStructType> docStructTypeMap;
    private Map<String, MetadataType> metadataTypeMap;
    private List<NewspaperIssueType> issueTypes;
    private List<NewspaperSupplementType> supplementTypes;

    private transient Gson gson = new Gson();
    transient Type listType = new TypeToken<ArrayList<NewspaperPage>>() {
    }.getType();
    private transient List<NewspaperPage> pages;

    /**
     * initialise, read config etc.
     */
    @Override
    public void initialize(Step step, String returnPath) {
        this.returnPath = returnPath;
        this.myStep = step;
        XMLConfiguration config = ConfigPlugins.getPluginConfig(PLUGIN_NAME);
        tocDepth = config.getInt("defaultDepth", 1);
        loadAllImages = config.getBoolean("loadAllImages", true);
        showWriteMetsButton = config.getBoolean("showWriteMetsButton", true);
        showDeletePageButton = config.getBoolean("showDeletePageButton", false);
        dateFormatDelimiter = config.getString("dateFormatDelimiter", ".");
        dateFormat = DateTimeFormatter.ofPattern("dd" + dateFormatDelimiter + "MM" + dateFormatDelimiter + "yyyy");
        writePageTitle = config.getBoolean("writePageTitle", true);

        HierarchicalConfiguration paginationConfig = config.configurationAt("pagination");
        createNewPagination = paginationConfig.getBoolean("createNewPagination", true);
        paginationType = paginationConfig.getString("type", "1");
        useFakePagination = paginationConfig.getBoolean("useFakePagination", false);

        issueTypes = initializeIssueTypes(config.configurationsAt("issue"));
        supplementTypes = initializeSupplementTypes(config.configurationsAt("supplement"));

        validateConfig();

        try {
            readExportedFile();
        } catch (Exception e) {
            log.error(e);
        }
    }

    private void validateConfig() {
        if (issueTypes.size() != issueTypes.stream()
                .map(NewspaperIssueType::label)
                .distinct()
                .count()) {
            // TODO: Localize
            Helper.setFehlerMeldung("Issue type labels are not unique!");
        }
        if (supplementTypes.size() != supplementTypes.stream()
                .map(NewspaperSupplementType::label)
                .distinct()
                .count()) {
            // TODO: Localize
            Helper.setFehlerMeldung("Supplement type labels are not unique!");
        }
    }

    private List<NewspaperIssueType> initializeIssueTypes(List<HierarchicalConfiguration> config) {
        return config.stream()
                .map(this::parseIssueType)
                .toList();
    }

    private List<NewspaperSupplementType> initializeSupplementTypes(List<HierarchicalConfiguration> config) {
        return config.stream()
                .map(this::parseSupplementType)
                .toList();
    }

    private NewspaperIssueType parseIssueType(HierarchicalConfiguration config) {
        return new NewspaperIssueType(
                config.getString("[@type]"),
                config.getString("[@label]"),
                config.configurationsAt("metadata").stream()
                        .map(this::parseMetadataWriteConfigurations)
                        .toList()
        );
    }

    private NewspaperSupplementType parseSupplementType(HierarchicalConfiguration config) {
        return new NewspaperSupplementType(
                config.getString("[@type]"),
                config.getString("[@label]"),
                config.configurationsAt("metadata").stream()
                        .map(this::parseMetadataWriteConfigurations)
                        .toList()
        );
    }

    private NewspaperMetadataWriteConfiguration parseMetadataWriteConfigurations(HierarchicalConfiguration config) {
        return new NewspaperMetadataWriteConfiguration(
                config.getString("[@key]"),
                config.getString("[@value]")
        );
    }

    @Override
    public boolean execute() {
        return false;
    }

    @Override
    public PluginGuiType getPluginGuiType() {
        return PluginGuiType.FULL;
    }

    @Override
    public String getTitle() {
        return PLUGIN_NAME;
    }

    @Override
    public String getDescription() {
        return getTitle();
    }

    @Override
    public String getPagePath() {
        return GUI;
    }

    @Override
    public String cancel() {
        return "/uii/" + returnPath;
    }

    @Override
    public String finish() {
        return "/uii/" + returnPath;
    }

    public void deleteFile() {
        log.debug("deleteFile is called");
        log.debug("deleting file: " + fileNameToDelete);
        Process pr = this.myStep.getProzess();
        String imageDir = getImageDirectory(pr);
        Path filePathToDelete = Path.of(imageDir, fileNameToDelete);
        try {
            // delete file from disk
            StorageProvider.getInstance().deleteFile(filePathToDelete);
            // delete the NewspaperPage object from pages
            pages.remove(fileIdToDelete);

        } catch (IOException e) {
            log.error("IOException happened trying to delete file: " + filePathToDelete);
            e.printStackTrace();
        }
    }

    public void setFileNameToDelete(String name) {
        log.debug("setFileNameToDelete is called with " + name);
        fileNameToDelete = name;
    }

    public String getFileNameToDelete() {
        log.debug("getFileNameToDelete is called");
        return fileNameToDelete;
    }

    public void setFileIdToDelete(int id) {
        log.debug("setFileIdToDelete is called with " + id);
        fileIdToDelete = id;
    }

    public int getFileIdToDelete() {
        log.debug("getFileIdToDelete is called");
        return fileIdToDelete;
    }

    public String deleteManualDataAndStartAutoAnalysis() throws IOException, InterruptedException, SwapException, DAOException {
        log.info("deleteManualDataAndStartAutoAnalysis - start");
        StepBean stepBean = (StepBean) Helper.getBeanByName("AktuelleSchritteForm", StepBean.class);
        String returnPath = stepBean.SchrittDurchBenutzerZurueckgeben();
        deleteManualData();
        this.myStep.setBearbeitungsstatusEnum(StepStatus.LOCKED);
        StepManager.saveStep(myStep);
        Optional<Step> maybePreviousStep = this.myStep.getProzess()
                .getSchritte()
                .stream()
                .filter(step -> step.getReihenfolge() < this.myStep.getReihenfolge())
                .max(Comparator.comparing(Step::getReihenfolge));
        if (maybePreviousStep.isPresent()) {
            log.info("deleteManualDataAndStartAutoAnalysis - found previous step");
            final Step previousStep = maybePreviousStep.get();
            Optional<Step> maybePreviousPreviousStep = previousStep.getProzess()
                    .getSchritte()
                    .stream()
                    .filter(step -> step.getReihenfolge() < previousStep.getReihenfolge())
                    .max(Comparator.comparing(Step::getReihenfolge));
            if (maybePreviousPreviousStep.isPresent()) {
                log.info("deleteManualDataAndStartAutoAnalysis - found previous previous step");
                previousStep.setBearbeitungsstatusEnum(StepStatus.LOCKED);
                StepManager.saveStep(previousStep);
                Step previousPreviousStep = maybePreviousPreviousStep.get();
                HelperSchritte hs = new HelperSchritte();
                hs.CloseStepObjectAutomatic(previousPreviousStep);
            }
        }
        log.info("deleteManualDataAndStartAutoAnalysis - returning " + returnPath);
        return returnPath;
    }

    public void deleteManualData() throws IOException, InterruptedException, SwapException, DAOException {
        Process pr = this.myStep.getProzess();
        Path manualF = Paths.get(pr.getProcessDataDirectory() + ISSUE_RESULT_MANUAL_LOCATION);

        log.info("Deleting {}", manualF);
        StorageProvider.getInstance().deleteFile(manualF);
    }

    public boolean pageNumberCountEqual() {
        String imageDir = getImageDirectory(this.myStep.getProzess());
        return this.pages.size() == StorageProvider.getInstance().list(imageDir).size();
    }

    public String getIssueTypeLabels() {
        return gson.toJson(
                this.issueTypes.stream()
                        .map(NewspaperIssueType::label)
                        .toList()
        );
    }

    public String getSupplementTypeLabels() {
        return gson.toJson(
                this.supplementTypes.stream()
                        .map(NewspaperSupplementType::label)
                        .toList()
        );
    }

    private NewspaperIssueType getIssueTypeForPage(NewspaperPage page) {
        return this.issueTypes.stream()
                .filter(t -> t.label().equals(page.getIssueType()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Unable to find issue type \"" + page.getIssueType() + "\"!"));
    }

    private NewspaperSupplementType getSupplementTypeForPage(NewspaperPage page) {
        return this.supplementTypes.stream()
                .filter(t -> t.label().equals(page.getSupplementType()))
                .findFirst()
                .orElseThrow(() -> new RuntimeException("Unable to find supplement type \"" + page.getIssueType() + "\"!"));
    }

    public String getJsonData() {
        if (this.pages.get(0).getImage() == null) {
            Process pr = this.myStep.getProzess();
            String imageDir = getImageDirectory(pr);
            String imageDirName = Paths.get(imageDir).toFile().getName();
            int order = 0;
            int count = 0;
            String contextPath = getContextPath();
            NewspaperPage currentIssue = null;
            for (NewspaperPage page : pages) {
                if (count == 0) {
                    page.setIssue(true);
                }
                if (page.isIssue()) {
                    currentIssue = page;
                    count++;
                } else if (currentIssue != null) {
                    currentIssue.addPage(page);
                }

                Image image = new Image(imageDir + "/" + page.getFilename(), order++, "", page.getFilename(), page.getFilename());
                String thumbUrl = createImageUrl(image, 400, "jpeg", contextPath, getStep().getProcessId(), imageDirName);
                image.setThumbnailUrl(thumbUrl);
                String largeThumbUrl = createImageUrl(image, 1600, "jpeg", contextPath, getStep().getProcessId(), imageDirName);
                image.setLargeThumbnailUrl(largeThumbUrl);
                page.setImage(image);
            }
            log.info(String.format("Counted %d issues", count));
        }

        this.pages.forEach(NewspaperPage::initializeProperties);

        return gson.toJson(this.pages);
    }

    private String getImageDirectory(Process pr) {
        String imageDir = null;
        try {
            imageDir = pr.getImagesTifDirectory(false);
            if (!StorageProvider.getInstance().isDirectory(Paths.get(imageDir))) {
                imageDir = pr.getImagesOrigDirectory(false);
            }
        } catch (Exception e) {
            log.error(e);
        }
        return imageDir;
    }

    public void setJsonData(String json) {
        log.info("saving json data");
        this.pages = gson.fromJson(json, listType);
        Process pr = this.myStep.getProzess();
        try {
            String manualF = pr.getProcessDataDirectory() + ISSUE_RESULT_MANUAL_LOCATION;
            OutputStream out = StorageProvider.getInstance().newOutputStream(Paths.get(manualF));
            try (BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(out))) {
                bw.write(json);
            }
        } catch (Exception e) {
            log.error(e);
        }
    }

    private void readExportedFile() throws Exception {
        Process pr = this.myStep.getProzess();
        Path manualF = Paths.get(pr.getProcessDataDirectory() + ISSUE_RESULT_MANUAL_LOCATION);
        Path automaticF = Paths.get(pr.getProcessDataDirectory() + ISSUE_RESULT_LOCATION);
        if (StorageProvider.getInstance().isFileExists(manualF)) {

            try (BufferedReader br = new BufferedReader(new InputStreamReader(StorageProvider.getInstance().newInputStream(manualF)))) {
                this.pages = gson.fromJson(br, listType);
            }
        } else if (StorageProvider.getInstance().isFileExists(automaticF)) {
            try (BufferedReader fr = new BufferedReader(new InputStreamReader(StorageProvider.getInstance().newInputStream(automaticF)))) {
                this.pages = gson.fromJson(new JsonReader(fr), listType);
            }

            for (NewspaperPage page : pages) {
                page.guessIssue();
            }
        } else {
            String imageDir = getImageDirectory(pr);
            List<Path> files = StorageProvider.getInstance().listFiles(imageDir);
            pages = new ArrayList<>();
            for (Path p : files) {
                pages.add(new NewspaperPage(p.getFileName().toString(), this.dateFormat));
            }

            for (NewspaperPage page : pages) {
                page.guessIssue();
            }
            if (!StorageProvider.getInstance().isDirectory(automaticF.getParent())) {
                StorageProvider.getInstance().createDirectories(automaticF.getParent());
            }

            OutputStream out = StorageProvider.getInstance().newOutputStream(automaticF);
            try (BufferedWriter bufw = new BufferedWriter(new OutputStreamWriter(out))) {
                gson.toJson(this.pages, bufw);
            }
        }
    }

    private String getContextPath() {
        HelperForm hf = (HelperForm) Helper.getBeanByName("HelperForm", HelperForm.class);
        return hf.getServletPathWithHostAsUrl();
    }

    private String createImageUrl(Image currentImage, Integer size, String format, String baseUrl, int processId, String imageDirName) {
        String url = String.format("%s/api/process/image/%d/%s/%s/full/!%d,%d/0/default.jpg", baseUrl, processId, imageDirName,
                currentImage.getTooltip(), size, size);
        String thumbsPath = String.format("/opt/digiverso/goobi/metadata/%d/thumbs/%s_%d/", processId, imageDirName, size);
        if (StorageProvider.getInstance().isDirectory(Paths.get(thumbsPath))) {
            url = String.format("%s/cs/cs?action=image&sourcepath=file:%s%s.jpg&format=jpg", baseUrl, thumbsPath,
                    currentImage.getTooltip().substring(0, currentImage.getTooltip().lastIndexOf('.')));
        }
        return url;
    }

    public String saveMetsFile() {
        long startTime = System.nanoTime();
        Process process = myStep.getProzess();
        // read mets file and ruleset
        DigitalDocument dd = null;
        Fileformat fileformat = null;
        try {
            fileformat = process.readMetadataFile();
            dd = fileformat.getDigitalDocument();
        } catch (Exception e) {
            log.error(e);
            return "";
        }

        // initialize the private type fields
        initializeTypes(process);

        // get a copy of bound book children if it is not null
        DocStruct boundBook = dd.getPhysicalDocStruct();
        log.debug("boundBook has " + (boundBook.getAllChildren() == null ? "NULL" : "") + " children");

        List<DocStruct> bbChildren = null;
        if (boundBook.getAllChildren() != null) {
            bbChildren = new ArrayList<>(boundBook.getAllChildren());
        }

        // prepare volume
        DocStruct volume = purifyDigitalDocument(dd, boundBook, bbChildren);

        DocStruct currentIssue = null;
        NewspaperPage currentIssuePage = null;
        DocStruct currentSupplement = null;

        // create entry for each page
        int mainPageNo = 0; // order of current page among the current issue pages
        int supplementPageNo = 0; // order of current page among the current supplement pages

        for (int i = 0; i < pages.size(); i++) {
            NewspaperPage newspaperPage = pages.get(i);
            DocStruct page = null;
            try {
                page = dd.createDocStruct(docStructTypeMap.get(PAGE_TYPE_NAME));
                boundBook.addChild(page);
            } catch (TypeNotAllowedAsChildException | TypeNotAllowedForParentException e) {
                log.error(e);
                return "";
            }
            page.setImageName(newspaperPage.getFilename());

            // process bound book children
            processBoundBookChildren(bbChildren, page, i, newspaperPage);

            if (newspaperPage.isIssue()) {
                currentSupplement = null;
            }

            // create new issue if needed
            if (currentIssue == null || newspaperPage.isIssue()) {
                mainPageNo = 1;
                try {
                    currentIssuePage = newspaperPage;
                    currentIssue = createNewIssue(dd, newspaperPage);
                    volume.addChild(currentIssue);
                } catch (TypeNotAllowedAsChildException | TypeNotAllowedForParentException e) {
                    log.error(e);
                    return "";
                }
            }

            if (newspaperPage.isSupplementTitle()) {
                supplementPageNo = 1;
                try {
                    currentSupplement = createNewSupplement(dd, currentIssuePage, newspaperPage);
                    currentIssue.addChild(currentSupplement);
                } catch (TypeNotAllowedAsChildException | TypeNotAllowedForParentException e) {
                    log.error(e);
                    return "";
                }
            }

            if (currentSupplement != null) {
                currentSupplement.addReferenceTo(page, LOGICAL_PHYSICAL_TYPE);
            }

            if (createNewPagination) {
                int pageNo = newspaperPage.isSupplement() ? supplementPageNo : mainPageNo;
                createMetadata(metadataTypeMap.get(LOG_PAGE_NO_TYPE_NAME), Integer.toString(pageNo), page);
            }

            // link pages to issue and volume
            currentIssue.addReferenceTo(page, LOGICAL_PHYSICAL_TYPE);
            volume.addReferenceTo(page, LOGICAL_PHYSICAL_TYPE);

            mainPageNo++;

            if (newspaperPage.isSupplement()) {
                supplementPageNo++;
            }
        }

        // save the METS file
        try {
            process.writeMetadataFile(fileformat);
        } catch (Exception e) {
            log.error(e);
            return "";
        }

        long elapsedTime = System.nanoTime() - startTime;
        log.info("Total execution time to save a METS file for " + pages.size() + " pages is " + elapsedTime / 1000000 + " millis.");

        return "";
    }

    private void initializeTypes(Process process) {
        Prefs prefs = process.getRegelsatz().getPreferences();
        docStructTypeMap = initializeDocStructTypeMap(prefs.getAllDocStructTypes());
        metadataTypeMap = initializeMetadataTypeMap(prefs.getAllMetadataTypes());
    }

    private Map<String, DocStructType> initializeDocStructTypeMap(Collection<DocStructType> dsTypes) {
        return dsTypes.stream()
                .collect(Collectors.toMap(
                        DocStructType::getName,
                        type -> type
                ));
    }

    private Map<String, MetadataType> initializeMetadataTypeMap(List<MetadataType> mdTypes) {
        var result = mdTypes.stream()
                .collect(Collectors.toMap(
                        MetadataType::getName,
                        type -> type
                ));

        // if by the end DATE_ISSUED_TYPE_NAME is not loaded into mapping, use alternative instead
        if (!result.containsKey(DATE_ISSUED_TYPE_NAME) && result.containsKey(DATE_ISSUED_TYPE_NAME_ALTERNATIVE)) {
            result.put(DATE_ISSUED_TYPE_NAME, result.get(DATE_ISSUED_TYPE_NAME_ALTERNATIVE));
        }

        return result;
    }

    private DocStruct purifyDigitalDocument(DigitalDocument dd, DocStruct boundBook, List<DocStruct> bbChildren) {
        DocStruct anchor = dd.getLogicalDocStruct();
        DocStruct volume;
        List<DocStruct> anchorsChildren = anchor.getAllChildren();
        if (anchor.getType().isAnchor() && anchorsChildren != null && !anchorsChildren.isEmpty()) {
            volume = anchor.getAllChildren().get(0);
        } else {
            volume = anchor;
        }

        List<DocStruct> volumesChildren = volume.getAllChildren();
        if (volumesChildren != null) {
            List<DocStruct> children = new ArrayList<>(volumesChildren);
            for (DocStruct child : children) {
                volume.removeChild(child);
                volume.removeReferenceTo(child);
            }
        }

        // remove all files from FileSet
        FileSet fs = dd.getFileSet();
        List<ContentFile> files = fs.getAllFiles();
        if (files != null) {
            files.clear();
        }

        if (bbChildren != null) {
            for (DocStruct child : bbChildren) {
                boundBook.removeChild(child);
                volume.removeReferenceTo(child);
            }
        }

        return volume;
    }

    private void processBoundBookChildren(List<DocStruct> bbChildren, DocStruct page, int currentNumber, NewspaperPage newspaperPage) {
        if (bbChildren == null) {
            createMetadata(metadataTypeMap.get(PHYS_PAGE_NO_TYPE_NAME), "" + (currentNumber + 1), page);
            return;
        }

        // bbChildren != null, process them
        Optional<DocStruct> oldPage = bbChildren.stream().filter(p -> newspaperPage.getFilename().equals(p.getImageName())).findAny();

        // process old physical pages
        createMetadata(metadataTypeMap.get(PHYS_PAGE_NO_TYPE_NAME), "" + (currentNumber + 1), page);

        if (createNewPagination) {
            // no need to process old logical page
            return;
        }

        // process old logical pages
        List<Metadata> oldLogPage = oldPage.map(p -> (List<Metadata>) p.getAllMetadataByType(metadataTypeMap.get(LOG_PAGE_NO_TYPE_NAME))).orElse(Collections.emptyList());

        if (oldLogPage.isEmpty()) {
            createMetadata(metadataTypeMap.get(LOG_PAGE_NO_TYPE_NAME), "uncounted", page);
        } else {
            createMetadata(metadataTypeMap.get(LOG_PAGE_NO_TYPE_NAME), oldLogPage.get(0).getValue(), page);
        }
    }

    private DocStruct createNewIssue(DigitalDocument dd, NewspaperPage newspaperPage) throws TypeNotAllowedForParentException {
        var issueType = getIssueTypeForPage(newspaperPage);
        var result = dd.createDocStruct(docStructTypeMap.get(issueType.rulesetType()));

        if (!StringUtils.isBlank(newspaperPage.getNumber())) {
            createMetadata(metadataTypeMap.get(NUMBER_TYPE_NAME), newspaperPage.getNumber(), result);
            createMetadata(metadataTypeMap.get(NUMBER_SORT_TYPE_NAME), newspaperPage.getNumber(), result);
            createMetadata(metadataTypeMap.get(PART_NUMBER_TYPE_NAME), newspaperPage.generatePartNumber(), result);
        } else {
            String message = "The newspaper issue for image \"" + newspaperPage.getFilename() + "\" has no number associated!";
            log.warn(message);
            Helper.setFehlerMeldung(message);
        }

        // Sometimes the NewspaperPage ctr is not called, therefore the formatter is not initialized
        newspaperPage.setDateFormatter(this.dateFormat);
        createMetadata(metadataTypeMap.get(DATE_ISSUED_TYPE_NAME), w3cdtf.format(newspaperPage.getDate()), result);

        for (NewspaperMetadataWriteConfiguration mc : getIssueTypeForPage(newspaperPage).customMetadata()) {
            createMetadata(metadataTypeMap.get(mc.key()), generateValue(newspaperPage, mc.value()), result);
        }

        return result;
    }

    private DocStruct createNewSupplement(DigitalDocument dd, NewspaperPage parentIssue, NewspaperPage newspaperPage) throws TypeNotAllowedForParentException {
        var supplementType = getSupplementTypeForPage(newspaperPage);
        var result = dd.createDocStruct(docStructTypeMap.get(supplementType.rulesetType()));

        for (NewspaperMetadataWriteConfiguration mc : getSupplementTypeForPage(newspaperPage).customMetadata()) {
            createMetadata(metadataTypeMap.get(mc.key()), generateValue(parentIssue, mc.value()), result);
        }

        return result;
    }

    private void createMetadata(MetadataType metadataType, String value, DocStruct docstruct) {
        // check whether the input metadataType is LOG_PAGE_NO_TYPE_NAME, if so modify value accordingly
        if (metadataTypeMap.get(LOG_PAGE_NO_TYPE_NAME).equals(metadataType)) {
            value = createFakePagination(value);
        }
        try {
            Metadata md = new Metadata(metadataType);
            md.setValue(value);
            docstruct.addMetadata(md);
        } catch (MetadataTypeNotAllowedException e) {
            log.error(e);
        }
    }

    private String createFakePagination(String pagination) {
        if (!createNewPagination) {
            // just return the old one
            return pagination;
        }

        if (StringUtils.isBlank(paginationType) || "-".equals(paginationType)) {
            // no pagination needed
            return "";
        }

        // format the numbers according to the configured paginationType
        String value = formatPagination(pagination);
        if (!useFakePagination) {
            return value;
        }

        return "[" + value + "]";
    }

    private String formatPagination(String pagination) {
        String value = pagination.replace("[", "").replace("]", "");
        boolean isArabic = Pattern.matches("\\d+", value);
        int num;
        RomanNumeral roman = null;
        if (isArabic) {
            num = Integer.parseInt(value);
            roman = new RomanNumeral(num);
        } else {
            // create a Roman Numeral
            roman = new RomanNumeral(value.toUpperCase());
            num = roman.intValue();
        }

        switch (paginationType) {
            case "1":
                return String.valueOf(num);
            case "i":
                return roman.getNumber().toLowerCase();
            case "I":
                return roman.getNumber();
            default:
                // unknown types
                return value;
        }
    }

    private String generateValue(NewspaperPage referencePage, String value) {
        if (referencePage.getDate() != null) {
            var matcher = TITLE_GENERATOR_DATE_PATTERN.matcher(value);
            if (matcher.find()) {
                var datePattern = matcher.group(1);
                var dateFormat = DateTimeFormatter.ofPattern(datePattern);
                value = matcher.replaceAll(dateFormat.format(referencePage.getDate()));
            }
        }

        if (!StringUtils.isBlank(referencePage.getNumber())) {
            var matcher = TITLE_GENERATOR_ISSUE_NUMBER_PATTERN.matcher(value);
            if (matcher.find()) {
                value = matcher.replaceAll(referencePage.getNumber());
            }

            matcher = TITLE_GENERATOR_ISSUE_PART_NUMBER_PATTERN.matcher(value);
            if (matcher.find()) {
                value = matcher.replaceAll(referencePage.generatePartNumber());
            }
        }

        return value;
    }
}
