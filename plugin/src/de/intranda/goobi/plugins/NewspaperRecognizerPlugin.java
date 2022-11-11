package de.intranda.goobi.plugins;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.lang.reflect.Type;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

import org.apache.commons.configuration.HierarchicalConfiguration;
import org.goobi.beans.Process;
import org.goobi.beans.Step;
import org.goobi.managedbeans.StepBean;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;
import org.joda.time.LocalDateTime;
import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;

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
    private static final DateTimeFormatter w3cdtf = DateTimeFormat.forPattern("yyyy-MM-dd");

    private int tocDepth = 0;

    private boolean loadAllImages;
    private boolean showWriteMetsButton = true;
    private boolean createNewPagination;

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
        HierarchicalConfiguration config = ConfigPlugins.getPluginConfig(PLUGIN_NAME);
        tocDepth = config.getInt("defaultDepth", 1);
        loadAllImages = true;
        showWriteMetsButton = config.getBoolean("showWriteMetsButton", true);
        createNewPagination = config.getBoolean("createNewPagination", true);
        try {
            readExportedFile();
        } catch (Exception e) {
            log.error(e);
        }
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
        Path manualF = Paths.get(pr.getProcessDataDirectory() + "/taskmanager/issues_result_manual.json");

        log.info("Deleting {}", manualF);
        StorageProvider.getInstance().deleteFile(manualF);
    }

    public boolean pageNumberCountEqual() {
        String imageDir = getImageDirectory(this.myStep.getProzess());
        return this.pages.size() == StorageProvider.getInstance().list(imageDir).size();
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
                } else {
                    if (currentIssue != null) {
                        currentIssue.addPage(page);
                    }
                }
                //                try {
                //                    Image image = new Image(pr, imageDirName, page.getFilename(), order++, 400);
                //                    page.setImage(image);
                //                } catch (IOException | SwapException | DAOException e) {
                //                    log.error(e);
                //                }

                Image image = new Image(imageDir + "/" + page.getFilename(), order++, "", page.getFilename(), page.getFilename());
                String thumbUrl = createImageUrl(image, 400, "jpeg", contextPath, getStep().getProcessId(), imageDirName);
                image.setThumbnailUrl(thumbUrl);
                String largeThumbUrl = createImageUrl(image, 1600, "jpeg", contextPath, getStep().getProcessId(), imageDirName);
                image.setLargeThumbnailUrl(largeThumbUrl);
                page.setImage(image);
            }
            log.info(String.format("Counted %d issues", count));
        }
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
            String manualF = pr.getProcessDataDirectory() + "/taskmanager/issues_result_manual.json";
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
        Path manualF = Paths.get(pr.getProcessDataDirectory() + "/taskmanager/issues_result_manual.json");
        Path automaticF = Paths.get(pr.getProcessDataDirectory() + "/taskmanager/issues_result.json");
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
                pages.add(new NewspaperPage(p.getFileName().toString()));
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

        Gson gson = new Gson();
        Type nt = new TypeToken<Collection<NewspaperPage>>() {
        }.getType();
        Collection<NewspaperPage> pages = gson.fromJson(new JsonReader(new FileReader(
                "/Users/steffen/git/goobi-plugin-step-olr-newspaper-recognizer/goobi-plugin-step-olr-newspaper-recognizer/doc/demmta_1911.json")),
                nt);

        for (NewspaperPage page : pages) {
            page.setIssue(page.guessIssue());
        }

    }

    public String saveMetsFile() {
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
        Prefs prefs = process.getRegelsatz().getPreferences();

        DocStructType pageType = prefs.getDocStrctTypeByName("page");
        DocStructType issueType = prefs.getDocStrctTypeByName("NewspaperIssue");
        DocStructType supplementType = prefs.getDocStrctTypeByName("NewspaperSupplement");
        MetadataType partNumberType = prefs.getMetadataTypeByName("PartNumber");
        MetadataType dateIssuedType = prefs.getMetadataTypeByName("DateIssued");
        if (dateIssuedType == null) {
            dateIssuedType = prefs.getMetadataTypeByName("PublicationYear");
        }
        MetadataType numberType = prefs.getMetadataTypeByName("CurrentNo");
        MetadataType numberSortType = prefs.getMetadataTypeByName("CurrentNoSorting");
        MetadataType titleType = prefs.getMetadataTypeByName("TitleDocMain");

        MetadataType logPageNoType = prefs.getMetadataTypeByName("logicalPageNumber");
        MetadataType physPageNoType = prefs.getMetadataTypeByName("physPageNumber");

        DocStruct anchor = dd.getLogicalDocStruct();
        DocStruct volume = anchor.getAllChildren().get(0);
        if (volume.getAllChildren() != null) {
            List<DocStruct> children = new ArrayList<>(volume.getAllChildren());
            for (DocStruct child : children) {
                volume.removeChild(child);
                volume.removeReferenceTo(child);
            }
        }
        FileSet fs = dd.getFileSet();
        if (fs.getAllFiles() != null) {
            List<ContentFile> files = new ArrayList<>(fs.getAllFiles());
            for (ContentFile inImage : files) {
                fs.removeFile(inImage);
            }
        }
        DocStruct boundBook = dd.getPhysicalDocStruct();
        List<DocStruct> bbChildren = null;
        if (boundBook.getAllChildren() != null) {
            bbChildren = new ArrayList<>(boundBook.getAllChildren());
            for (DocStruct child : bbChildren) {
                boundBook.removeChild(child);
                volume.removeReferenceTo(child);
            }
        }

        DocStruct currentIssue = null;
        DocStruct currentSupplement = null;

        // create entry for each page
        int currentPageNo = 0;
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
            if (bbChildren != null) {
                DocStruct oldPage = bbChildren.get(i);
                List<Metadata> oldPhysPage = (List<Metadata>) oldPage.getAllMetadataByType(physPageNoType);
                if (oldPhysPage.size() > 0) {
                    createMetadata(physPageNoType, oldPhysPage.get(0).getValue(), page);
                } else {
                    createMetadata(physPageNoType, "" + (i + 1), page);
                }

                List<Metadata> oldLogPage = (List<Metadata>) oldPage.getAllMetadataByType(logPageNoType);
                if (!createNewPagination) {
                    if (oldLogPage.size() > 0) {
                        createMetadata(logPageNoType, oldLogPage.get(0).getValue(), page);
                    } else {
                        createMetadata(logPageNoType, "uncounted", page);
                    }
                }
            } else {
                createMetadata(physPageNoType, "" + (i + 1), page);
                createMetadata(logPageNoType, "uncounted", page);
            }
            if (newspaperPage.isIssue()) {
                currentSupplement = null;
            }
            // create new issue if needed
            if (currentIssue == null || newspaperPage.isIssue()) {
                currentPageNo = 1;
                try {
                    currentIssue = dd.createDocStruct(issueType);

                    volume.addChild(currentIssue);
                } catch (TypeNotAllowedAsChildException | TypeNotAllowedForParentException e) {
                    log.error(e);
                    return "";
                }
                createMetadata(partNumberType, newspaperPage.generateTitle(), currentIssue);

                createMetadata(numberType, newspaperPage.getNumber(), currentIssue);
                createMetadata(numberSortType, newspaperPage.getNumber(), currentIssue);

                createMetadata(dateIssuedType, w3cdtf.print(newspaperPage.getDate()), currentIssue);

                createMetadata(titleType, getTitleFromPage(newspaperPage), currentIssue);
            }
            if (newspaperPage.isSupplementTitle()) {
                currentPageNo = 1;
                try {
                    currentSupplement = dd.createDocStruct(supplementType);
                    currentIssue.addChild(currentSupplement);
                } catch (TypeNotAllowedAsChildException | TypeNotAllowedForParentException e) {
                    log.error(e);
                    return "";
                }
            }
            if (currentSupplement != null) {
                currentSupplement.addReferenceTo(page, "logical_physical");
            }
            if (createNewPagination) {
                createMetadata(logPageNoType, Integer.toString(currentPageNo), page);
            }
            // link pages to issue and volume
            currentIssue.addReferenceTo(page, "logical_physical");
            volume.addReferenceTo(page, "logical_physical");

            currentPageNo++;
        }

        try {
            process.writeMetadataFile(fileformat);
        } catch (Exception e) {
            log.error(e);
            return "";
        }
        return "";

    }

    private void createMetadata(MetadataType metadataType, String value, DocStruct docstruct) {
        try {
            Metadata physPageNo = new Metadata(metadataType);
            physPageNo.setValue(value);
            docstruct.addMetadata(physPageNo);
        } catch (MetadataTypeNotAllowedException e) {
            log.error(e);
        }
    }

    private static String getTitleFromPage(NewspaperPage page) {
        LocalDateTime dateTime = page.getDate();
        StringBuilder sb = new StringBuilder();
        sb.append(page.getIssueType());
        sb.append(" vom ");

        switch (dateTime.dayOfWeek().get()) {
            case 1:
                sb.append("Montag, den ");
                break;
            case 2:
                sb.append("Dienstag, den ");
                break;
            case 3:
                sb.append("Mittwoch, den ");
                break;
            case 4:
                sb.append("Donnerstag, den ");
                break;
            case 5:
                sb.append("Freitag, den ");
                break;
            case 6:
                sb.append("Samstag, den ");
                break;
            default:
                sb.append("Sonntag, den ");
                break;
        }
        switch (dateTime.dayOfMonth().get()) {
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
            case 8:
            case 9:
                sb.append("0" + dateTime.dayOfMonth().get() + ". ");
                break;
            default:
                sb.append(dateTime.dayOfMonth().get() + ". ");
                break;
        }

        switch (dateTime.monthOfYear().get()) {
            case 1:
                sb.append("Januar ");
                break;
            case 2:
                sb.append("Februar ");
                break;
            case 3:
                sb.append("März ");
                break;
            case 4:
                sb.append("April ");
                break;
            case 5:
                sb.append("Mai ");
                break;
            case 6:
                sb.append("Juni ");
                break;
            case 7:
                sb.append("Juli ");
                break;
            case 8:
                sb.append("August ");
                break;
            case 9:
                sb.append("September ");
                break;
            case 10:
                sb.append("Oktober ");
                break;
            case 11:
                sb.append("November ");
                break;
            default:
                sb.append("Dezember ");
                break;
        }
        sb.append(dateTime.getYear());
        return sb.toString();
    }

}
