package de.intranda.goobi.plugins;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;
import de.intranda.goobi.plugins.newspaperRecognizer.MetsWriter;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperIssueType;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperMetadataWriteConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperSupplementType;
import de.sub.goobi.config.ConfigPlugins;
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
import ugh.exceptions.PreferencesException;
import ugh.exceptions.TypeNotAllowedAsChildException;
import ugh.exceptions.TypeNotAllowedForParentException;
import ugh.exceptions.WriteException;

import java.io.*;
import java.lang.reflect.Type;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

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

    private int tocDepth;

    private boolean loadAllImages;
    private boolean showWriteMetsButton;
    private boolean showDeletePageButton;
    private String dateFormatPattern;
    private DateTimeFormatter dateFormat;

    private String fileNameToDelete = null;
    private int fileIdToDelete;

    private List<NewspaperIssueType> issueTypes;
    private List<NewspaperSupplementType> supplementTypes;

    private transient Gson gson = new Gson();
    transient Type listType = new TypeToken<ArrayList<NewspaperPage>>() {
    }.getType();
    private transient List<NewspaperPage> pages;

    private transient MetsWriter metsWriter;

    /**
     * initialise, read config etc.
     */
    @Override
    public void initialize(Step step, String returnPath) {
        try {
            this.returnPath = returnPath;
            this.myStep = step;
            XMLConfiguration config = ConfigPlugins.getPluginConfig(PLUGIN_NAME);
            tocDepth = config.getInt("defaultDepth", 1);
            loadAllImages = config.getBoolean("loadAllImages", true);
            showWriteMetsButton = config.getBoolean("showWriteMetsButton", true);
            showDeletePageButton = config.getBoolean("showDeletePageButton", false);
            dateFormatPattern = config.getString("dateFormat", "dd.MM.yyyy");
            dateFormat = DateTimeFormatter.ofPattern(dateFormatPattern);

            HierarchicalConfiguration paginationConfig = config.configurationAt("pagination");
            boolean createNewPagination = paginationConfig.getBoolean("createNewPagination", true);
            String paginationType = paginationConfig.getString("type", "1");
            boolean useFakePagination = paginationConfig.getBoolean("useFakePagination", false);

            issueTypes = initializeIssueTypes(config.configurationsAt("issue"));
            supplementTypes = initializeSupplementTypes(config.configurationsAt("supplement"));

            metsWriter = new MetsWriter(step.getProzess(), issueTypes, supplementTypes, createNewPagination, paginationType, useFakePagination);
            metsWriter.initialize();

            loadPluginData();
        } catch (Exception e) {
            String message = "Error during plugin initialization";
            log.error(message, e);
            Helper.setFehlerMeldung(message, e);
        }
    }

    private List<NewspaperIssueType> initializeIssueTypes(List<HierarchicalConfiguration> config) {
        var result = config.stream()
                .map(this::parseIssueType)
                .toList();
        if (result.size() != result.stream()
                .map(NewspaperIssueType::label)
                .distinct()
                .count()) {
            throw new IllegalArgumentException("Issue type labels are not unique!");
        }
        return result;
    }

    private List<NewspaperSupplementType> initializeSupplementTypes(List<HierarchicalConfiguration> config) {
        var result = config.stream()
                .map(this::parseSupplementType)
                .toList();
        if (result.size() != result.stream()
                .map(NewspaperSupplementType::label)
                .distinct()
                .count()) {
            throw new IllegalArgumentException("Supplement type labels are not unique!");
        }
        return result;
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
        try {
            // try to delete the file from both the media and master folder
            Path filePathToDelete = Path.of(pr.getImagesTifDirectory(false), fileNameToDelete);
            if (StorageProvider.getInstance().isFileExists(filePathToDelete)) {
                StorageProvider.getInstance().deleteFile(filePathToDelete);
            }
            filePathToDelete = Path.of(pr.getImagesOrigDirectory(false), fileNameToDelete);
            if (StorageProvider.getInstance().isFileExists(filePathToDelete)) {
                StorageProvider.getInstance().deleteFile(filePathToDelete);
            }

            // delete the NewspaperPage object from pages
            pages.remove(fileIdToDelete);

        } catch (IOException | DAOException | SwapException e) {
            log.error("Exception happened trying to delete file \"{}\"", fileNameToDelete, e);
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

        if (StorageProvider.getInstance().isFileExists(manualF)) {
            log.info("Deleting {}", manualF);
            StorageProvider.getInstance().deleteFile(manualF);
        }
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

    public String getJsonData() throws DAOException, SwapException, IOException {
        if (this.pages.stream().anyMatch(p -> p.getImage() == null)) {
            Process process = this.myStep.getProzess();
            String imageDir = getImageDirectory(process);
            int order = 0;
            for (NewspaperPage page : pages) {
                Image image = new Image(process, imageDir, page.getFilename(), order++, 500);
                // Due to GSON serialization issues, we remove the `imagePath` property of the image to avoid its serialization. It's not required for our purposes anyway!
                image.setImagePath(null);
                page.setImage(image);
            }
            log.info(String.format("Counted %d issues", pages.stream().filter(p -> p.getIssueType() != null).count()));
        }

        return gson.toJson(this.pages);
    }

    public void setJsonData(String json) {
        log.info("saving json data");
        this.pages = gson.fromJson(json, listType);
        this.pages.forEach(this::initializePage);
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

    private void initializePage(NewspaperPage page) {
        page.setFrontendDateFormat(dateFormat);
        metsWriter.getIssueTypeForPage(page).ifPresent(page::setIssueType);
        metsWriter.getSupplementTypeForPage(page).ifPresent(page::setSupplementType);
    }

    public String saveMetsFile() {
        try {
            metsWriter.write(pages);
        } catch (TypeNotAllowedForParentException | TypeNotAllowedAsChildException | WriteException | SwapException | IOException | PreferencesException e) {
            String message = "An error occurred while persisting data into the Mets file";
            log.error(message, e);
            Helper.setFehlerMeldung(message, e);
        }
        return "";
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

    private void loadPluginData() throws SwapException, IOException {
        Process pr = this.myStep.getProzess();
        Path manualF = Paths.get(pr.getProcessDataDirectory() + ISSUE_RESULT_MANUAL_LOCATION);
        Path automaticF = Paths.get(pr.getProcessDataDirectory() + ISSUE_RESULT_LOCATION);

        // try manual plugin data first
        if (StorageProvider.getInstance().isFileExists(manualF)) {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(StorageProvider.getInstance().newInputStream(manualF)))) {
                this.pages = gson.fromJson(br, listType);
            }
        // otherwise try to load automatic analysis results
        } else if (StorageProvider.getInstance().isFileExists(automaticF)) {
            try (BufferedReader fr = new BufferedReader(new InputStreamReader(StorageProvider.getInstance().newInputStream(automaticF)))) {
                this.pages = gson.fromJson(new JsonReader(fr), listType);
            }

            this.pages.stream()
                    .filter(NewspaperPage::analysisIndicatesThisIsAnIssue)
                    .forEach(p -> p.setIssueTypeName(this.issueTypes.getFirst().label()));
        // if all else fails, create blank data
        } else {
            String imageDir = getImageDirectory(pr);
            List<Path> files = StorageProvider.getInstance().listFiles(imageDir);
            pages = new ArrayList<>();
            for (Path p : files) {
                NewspaperPage newPage = new NewspaperPage();
                newPage.setFilename(p.getFileName().toString());
                pages.add(newPage);
            }

            if (!StorageProvider.getInstance().isDirectory(manualF.getParent())) {
                StorageProvider.getInstance().createDirectories(manualF.getParent());
            }

            OutputStream out = StorageProvider.getInstance().newOutputStream(manualF);
            try (BufferedWriter bw = new BufferedWriter(new OutputStreamWriter(out))) {
                gson.toJson(this.pages, bw);
            }
        }

        if (!this.pages.isEmpty() && StringUtils.isBlank(this.pages.getFirst().getIssueTypeName())) {
            this.pages.getFirst().setIssueTypeName(this.issueTypes.getFirst().label());
        }

        this.pages.forEach(this::initializePage);
    }
}
