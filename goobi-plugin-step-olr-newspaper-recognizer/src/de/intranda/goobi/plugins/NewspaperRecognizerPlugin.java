package de.intranda.goobi.plugins;

import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.FileReader;
import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.goobi.beans.Process;
import org.goobi.beans.Step;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;
import org.joda.time.DateTime;
import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;

import de.sub.goobi.config.ConfigPlugins;
import de.sub.goobi.forms.HelperForm;
import de.sub.goobi.helper.Helper;
import de.sub.goobi.helper.exceptions.DAOException;
import de.sub.goobi.helper.exceptions.SwapException;
import de.sub.goobi.metadaten.Image;
import lombok.Data;
import lombok.extern.log4j.Log4j;
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
import ugh.exceptions.PreferencesException;
import ugh.exceptions.ReadException;
import ugh.exceptions.TypeNotAllowedAsChildException;
import ugh.exceptions.TypeNotAllowedForParentException;
import ugh.exceptions.WriteException;

@PluginImplementation
@Log4j
@Data
public class NewspaperRecognizerPlugin extends AbstractStepPlugin implements IStepPlugin, IPlugin {
    private static final String PLUGIN_NAME = "intranda_step_newspaperRecognizer";
    private static final String GUI = "/uii/plugin_newspaperRecognizer.xhtml";
    private static final DateTimeFormatter w3cdtf = DateTimeFormat.forPattern("yyyy-MM-dd");

    private int tocDepth = 0;

    private String returnPath;

    private Gson gson = new Gson();
    Type listType = new TypeToken<ArrayList<NewspaperPage>>() {
    }.getType();
    private List<NewspaperPage> pages;

    /**
     * initialise, read config etc.
     */
    @Override
    public void initialize(Step step, String returnPath) {
        this.returnPath = returnPath;
        this.myStep = step;
        tocDepth = ConfigPlugins.getPluginConfig(this).getInt("defaultDepth", 1);
        try {
            readExportedFile();
        } catch (IOException | InterruptedException | SwapException | DAOException e) {
            // TODO Auto-generated catch block
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
        return PLUGIN_NAME;
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

    public String getJsonData() {
        return gson.toJson(this.pages);
    }

    public void setJsonData(String json) {
        log.info("saving json data");
        this.pages = gson.fromJson(json, listType);
        Process pr = this.myStep.getProzess();
        try {
            String manualF = pr.getProcessDataDirectory() + "/taskmanager/issues_result_manual.json";
            try (BufferedWriter bw = Files.newBufferedWriter(Paths.get(manualF))) {
                bw.write(json);
            }
        } catch (IOException | InterruptedException | SwapException | DAOException e) {
            // TODO Auto-generated catch block
            log.error(e);
        }
    }

    private void readExportedFile() throws IOException, InterruptedException, SwapException, DAOException {
        Process pr = this.myStep.getProzess();
        String imageDir = pr.getImagesTifDirectory(false);
        if (!Files.exists(Paths.get(imageDir))) {
            imageDir = pr.getImagesOrigDirectory(false);
        }
        Path manualF = Paths.get(pr.getProcessDataDirectory() + "/taskmanager/issues_result_manual.json");
        if (Files.exists(manualF)) {
            try (BufferedReader br = Files.newBufferedReader(manualF)) {
                this.pages = gson.fromJson(br, listType);
            }
        } else {
            String resultF = pr.getProcessDataDirectory() + "/taskmanager/issues_result.json";
            try (FileReader fr = new FileReader(resultF)) {
                this.pages = gson.fromJson(new JsonReader(fr), listType);
            }
            log.info(pages.size());

            for (NewspaperPage page : pages) {
                page.guessIssue();
            }
        }
        int order = 0;
        int count = 0;
        String contextPath = getContextPath();
        NewspaperPage currentIssue = null;
        for (NewspaperPage page : pages) {
            if (count == 0) {
                page.setIssue(true);
            }
            log.info(page.getResult());
            if (page.isIssue()) {
                currentIssue = page;
                count++;
            } else {
                if (currentIssue != null) {
                    currentIssue.addPage(page);
                }
            }
            Image image = new Image(imageDir + "/" + page.getFilename(), order++, "", page.getFilename(), page.getFilename());
            String thumbUrl = createImageUrl(image, 400, "image/jpeg", contextPath);
            image.setThumbnailUrl(thumbUrl);
            String largeThumbUrl = createImageUrl(image, 1600, "image/jpeg", contextPath);
            image.setLargeThumbnailUrl(largeThumbUrl);
            page.setImage(image);
        }
        log.info(String.format("Counted %d issues", count));
    }

    private String getContextPath() {
        HelperForm hf = (HelperForm) Helper.getManagedBeanValue("#{HelperForm}");
        return hf.getServletPathWithHostAsUrl();
    }

    private String createImageUrl(Image currentImage, Integer size, String format, String baseUrl) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append("/cs").append("?action=").append("image").append("&format=").append(format).append("&sourcepath=").append("file://" + currentImage
                .getImageName()).append("&width=").append(size).append("&height=").append(size);
        return url.toString();
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
            System.out.println(page.getFilenameAsTif() + " - " + page.getResult() + " - " + page.isIssue());
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
        } catch (ReadException | PreferencesException | WriteException | IOException | InterruptedException | SwapException | DAOException e) {
            log.error(e);
            return "";
        }
        Prefs prefs = process.getRegelsatz().getPreferences();

        DocStructType pageType = prefs.getDocStrctTypeByName("page");
        DocStructType issueType = prefs.getDocStrctTypeByName("NewspaperIssue");
        DocStructType supplementType = prefs.getDocStrctTypeByName("NewspaperSupplement");
        MetadataType partNumberType = prefs.getMetadataTypeByName("PartNumber");
        MetadataType dateIssuedType = prefs.getMetadataTypeByName("DateIssued");
        MetadataType numberType = prefs.getMetadataTypeByName("CurrentNo");
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
                if (oldLogPage.size() > 0) {
                    createMetadata(physPageNoType, oldLogPage.get(0).getValue(), page);
                } else {
                    createMetadata(logPageNoType, "uncounted", page);
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
                try {
                    currentIssue = dd.createDocStruct(issueType);

                    volume.addChild(currentIssue);
                } catch (TypeNotAllowedAsChildException | TypeNotAllowedForParentException e) {
                    log.error(e);
                    return "";
                }
                createMetadata(partNumberType, newspaperPage.generateTitle(), currentIssue);

                createMetadata(numberType, newspaperPage.getNumber(), currentIssue);

                createMetadata(dateIssuedType, w3cdtf.print(newspaperPage.getDate()), currentIssue);

                createMetadata(titleType, getTitleFromDate(newspaperPage.getDate()), currentIssue);
            }
            if (newspaperPage.isSupplementTitle()) {
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
            // link pages to issue and volume
            currentIssue.addReferenceTo(page, "logical_physical");
            volume.addReferenceTo(page, "logical_physical");

        }

        try {
            process.writeMetadataFile(fileformat);
        } catch (WriteException | PreferencesException | IOException | InterruptedException | SwapException | DAOException e) {
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

    private static String getTitleFromDate(DateTime dateTime) {
        StringBuilder sb = new StringBuilder();
        sb.append("Ausgabe vom ");

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
