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
import java.text.DateFormat;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

import de.intranda.goobi.plugins.newspaper.NewspaperIssueType;
import de.intranda.goobi.plugins.newspaper.NewspaperPage;
import de.intranda.goobi.plugins.newspaper.NewspaperSupplementType;
import de.intranda.goobi.plugins.newspaper.NewspaperPageType;
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
    private static final String LOGICAL_PHYSICAL_TYPE = "logical_physical";
    private static final String ISSUE_RESULT_LOCATION = "/taskmanager/issues_result.json";
    private static final String ISSUE_RESULT_MANUAL_LOCATION = "/taskmanager/issues_result_manual.json";
    private static final DateTimeFormatter w3cdtf = DateTimeFormatter.ofPattern("yyyy-MM-dd");

    private static final Pattern TITLE_GENERATOR_DATE_PATTERN = Pattern.compile("\\{date:(.*)\\}");

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

    // TODO: Remove these old fixed types
    private DocStructType pageType;

    private Map<String, DocStructType> rulesetTypeMapping;

    private List<NewspaperIssueType> issueTypes;
    private List<NewspaperSupplementType> supplementTypes;

    private MetadataType partNumberType;
    private MetadataType numberType;
    private MetadataType numberSortType;
    private MetadataType dateIssuedType;
    private MetadataType titleType;
    private MetadataType logPageNoType;
    private MetadataType physPageNoType;

    private static final String PAGE_TYPE_NAME = "page";

    private static final String PART_NUMBER_TYPE_NAME = "PartNumber";
    private static final String NUMBER_TYPE_NAME = "CurrentNo";
    private static final String NUMBER_SORT_TYPE_NAME = "CurrentNoSorting";
    private static final String DATE_ISSUED_TYPE_NAME = "DateIssued";
    private static final String DATE_ISSUED_TYPE_NAME_ALTERNATIVE = "PublicationYear";
    private static final String TITLE_TYPE_NAME = "TitleDocMain";
    private static final String LOG_PAGE_NO_TYPE_NAME = "logicalPageNumber";
    private static final String PHYS_PAGE_NO_TYPE_NAME = "physPageNumber";

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
                .map(c -> new NewspaperIssueType(
                        c.getString("[@type]"),
                        c.getString("[@label]"),
                        c.getString("[@title]")
                ))
                .toList();
    }

    private List<NewspaperSupplementType> initializeSupplementTypes(List<HierarchicalConfiguration> config) {
        return config.stream()
                .map(c -> new NewspaperSupplementType(
                        c.getString("[@type]"),
                        c.getString("[@label]"),
                        c.getString("[@title]")
                ))
                .toList();
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

    public static void main(String[] args) throws Exception {
        NewspaperRecognizerPlugin plugin = new NewspaperRecognizerPlugin();
        plugin.initialize(null, null);

        System.err.println(plugin.issueTypes);

//        Gson gson = new Gson();
        //        Type nt = new TypeToken<Collection<NewspaperPage>>() {
        //        }.getType();
        //        Collection<NewspaperPage> pages = gson.fromJson(new JsonReader(new FileReader(
        //                "/Users/steffen/git/goobi-plugin-step-olr-newspaper-recognizer/goobi-plugin-step-olr-newspaper-recognizer/doc/demmta_1911.json")),
        //                nt);
        //
        //        for (NewspaperPage page : pages) {
        //            page.setIssue(page.guessIssue());
        //        }

//        NewspaperPage page = new NewspaperPage("test.jpg", DateTimeFormat.forPattern("dd.MM.yyyy"));
//        String json = gson.toJson(page);
//        System.out.println(json);
//        NewspaperPage copy = gson.fromJson(json, NewspaperPage.class);
//        String json2 = gson.toJson(copy);
//        System.out.println(json2);
//
//        String page3String =
//                "{\"filename\":\"test.jpg\",\"result\":0.0,\"issue\":false,\"supplement\":false,\"supplementTitle\":false,\"showOtherImages\":true,\"supplementPages\":[],\"dateValid\":false}";
//        NewspaperPage copy3 = gson.fromJson(page3String, NewspaperPage.class);
//        copy3.initializeProperties();
//        System.out.println("copy3 otherpages = " + copy3.getOtherPages());
//        String json3 = gson.toJson(copy3);
//        System.out.println(json3);

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
                page = dd.createDocStruct(pageType);
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
                createMetadata(logPageNoType, Integer.toString(pageNo), page);
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
        // initialize all DocStructType objects
        List<DocStructType> dsTypes = prefs.getAllDocStructTypes();
        HashSet<String> dsTypesNames = new HashSet<>(List.of(PAGE_TYPE_NAME));
        dsTypesNames.addAll(this.issueTypes.stream()
                .map(NewspaperIssueType::rulesetType)
                .collect(Collectors.toSet()));
        dsTypesNames.addAll(this.supplementTypes.stream()
                .map(NewspaperSupplementType::rulesetType)
                .collect(Collectors.toSet()));
        initializeDocStructTypes(dsTypes, dsTypesNames);

        // initialize all MetadataType objects
        List<MetadataType> mdTypes = prefs.getAllMetadataTypes();
        HashSet<String> mdTypesNames = new HashSet<>(Arrays.asList(PART_NUMBER_TYPE_NAME, DATE_ISSUED_TYPE_NAME, NUMBER_TYPE_NAME,
                NUMBER_SORT_TYPE_NAME, TITLE_TYPE_NAME, LOG_PAGE_NO_TYPE_NAME, PHYS_PAGE_NO_TYPE_NAME));
        initializeMetadataTypes(mdTypes, mdTypesNames);
    }

    private void initializeDocStructTypes(List<DocStructType> dsTypes, HashSet<String> dsTypesNames) {
        // set null first
        pageType = null;
        rulesetTypeMapping = new HashMap<>();

        // update all fields
        for (DocStructType dsType : dsTypes) {
            if (dsTypesNames.isEmpty()) {
                break;
            }
            String typeName = dsType.getName();
            if (dsTypesNames.contains(typeName)) {
                switch (typeName) {
                    case PAGE_TYPE_NAME:
                        pageType = dsType;
                        break;
                    default:
                        rulesetTypeMapping.put(typeName, dsType);
                        // no need
                }
                dsTypesNames.remove(typeName);
            }
        }
    }

    private void initializeMetadataTypes(List<MetadataType> mdTypes, HashSet<String> mdTypesNames) {
        // set null first
        partNumberType = null;
        numberType = null;
        numberSortType = null;
        dateIssuedType = null;
        titleType = null;
        logPageNoType = null;
        physPageNoType = null;

        MetadataType alternative = null; // used to hold the MetadataType named after DATE_ISSUED_TYPE_NAME_ALTERNATIVE, just in case
        boolean noDateFound = true; // true if there is no candidate for dateIssuedType found yet

        // update all fields
        for (MetadataType mdType : mdTypes) {
            if (mdTypesNames.isEmpty()) {
                break;
            }

            String typeName = mdType.getName();
            if (mdTypesNames.contains(typeName)) {
                switch (typeName) {
                    case PART_NUMBER_TYPE_NAME:
                        partNumberType = mdType;
                        break;
                    case NUMBER_TYPE_NAME:
                        numberType = mdType;
                        break;
                    case NUMBER_SORT_TYPE_NAME:
                        numberSortType = mdType;
                        break;
                    case DATE_ISSUED_TYPE_NAME:
                        dateIssuedType = mdType;
                        noDateFound = false;
                        break;
                    case TITLE_TYPE_NAME:
                        titleType = mdType;
                        break;
                    case LOG_PAGE_NO_TYPE_NAME:
                        logPageNoType = mdType;
                        break;
                    case PHYS_PAGE_NO_TYPE_NAME:
                        physPageNoType = mdType;
                        break;
                    default:
                        // no need
                }
                mdTypesNames.remove(typeName);
            }

            if (noDateFound && DATE_ISSUED_TYPE_NAME_ALTERNATIVE.equals(typeName)) {
                alternative = mdType;
                noDateFound = false;
            }
        }
        // if by the end dateIssuedType is still null, use alternative instead
        if (dateIssuedType == null) {
            dateIssuedType = alternative;
        }
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
            createMetadata(physPageNoType, "" + (currentNumber + 1), page);
            return;
        }

        // bbChildren != null, process them
        Optional<DocStruct> oldPage = bbChildren.stream().filter(p -> newspaperPage.getFilename().equals(p.getImageName())).findAny();

        // process old physical pages
        createMetadata(physPageNoType, "" + (currentNumber + 1), page);

        if (createNewPagination) {
            // no need to process old logical page
            return;
        }

        // process old logical pages
        List<Metadata> oldLogPage = oldPage.map(p -> (List<Metadata>) p.getAllMetadataByType(logPageNoType)).orElse(Collections.emptyList());

        if (oldLogPage.isEmpty()) {
            createMetadata(logPageNoType, "uncounted", page);
        } else {
            createMetadata(logPageNoType, oldLogPage.get(0).getValue(), page);
        }
    }

    private DocStruct createNewIssue(DigitalDocument dd, NewspaperPage newspaperPage) throws TypeNotAllowedForParentException {
        var issueType = getIssueTypeForPage(newspaperPage);
        var result = dd.createDocStruct(rulesetTypeMapping.get(issueType.rulesetType()));

        createMetadata(partNumberType, newspaperPage.generateTitle(), result);
        createMetadata(numberType, newspaperPage.getNumber(), result);
        createMetadata(numberSortType, newspaperPage.getNumber(), result);
        // Sometimes the NewspaperPage ctr is not called, therefore the formatter is not initialized
        newspaperPage.setDateFormatter(this.dateFormat);
        createMetadata(dateIssuedType, w3cdtf.format(newspaperPage.getDate()), result);
        if (writePageTitle) {
            createMetadata(titleType, getTitleFromPage(newspaperPage, newspaperPage.getDate(), NewspaperPageType.ISSUE), result);
        }

        return result;
    }

    private DocStruct createNewSupplement(DigitalDocument dd, NewspaperPage parentIssue, NewspaperPage newspaperPage) throws TypeNotAllowedForParentException {
        var supplementType = getSupplementTypeForPage(newspaperPage);
        var result = dd.createDocStruct(rulesetTypeMapping.get(supplementType.rulesetType()));

        if (writePageTitle) {
            createMetadata(titleType, getTitleFromPage(newspaperPage, parentIssue.getDate(), NewspaperPageType.SUPPLEMENT), result);
        }

        return result;
    }

    private void createMetadata(MetadataType metadataType, String value, DocStruct docstruct) {
        // check whether the input metadataType is logPageNoType, if so modify value accordingly
        if (logPageNoType.equals(metadataType)) {
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

    private String getTitleFromPage(NewspaperPage page, LocalDate date, NewspaperPageType type) {
        var title = getTitlePatternForPage(page, type);
        var matcher = TITLE_GENERATOR_DATE_PATTERN.matcher(title);
        if (matcher.find()) {
            var datePattern = matcher.group(1);
            var dateFormat = DateTimeFormatter.ofPattern(datePattern);
            title = matcher.replaceAll(dateFormat.format(date));
        }
        return title;
    }

    private String getTitlePatternForPage(NewspaperPage page, NewspaperPageType type) {
        return switch (type) {
            case ISSUE -> getIssueTypeForPage(page).titlePattern();
            case SUPPLEMENT -> getSupplementTypeForPage(page).titlePattern();
            default -> throw new IllegalArgumentException("Can't get title pattern for page type \"" + type + "\"");
        };
    }

    private NewspaperIssueType getIssueTypeForPage(NewspaperPage page) {
        return this.issueTypes.stream()
                .filter(t -> t.label().equals(page.getIssueType()))
                .findFirst()
                .orElseThrow();
    }

    private NewspaperSupplementType getSupplementTypeForPage(NewspaperPage page) {
        return this.supplementTypes.stream()
                .filter(t -> t.label().equals(page.getSupplementType()))
                .findFirst()
                .orElseThrow();
    }
}
