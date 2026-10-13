package de.intranda.goobi.plugins;

import java.io.IOException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

import org.apache.commons.configuration.XMLConfiguration;
import org.goobi.beans.Process;
import org.goobi.beans.Step;
import org.goobi.managedbeans.StepBean;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;

import com.google.gson.Gson;

import de.intranda.goobi.plugins.newspaperRecognizer.LoadedState;
import de.intranda.goobi.plugins.newspaperRecognizer.PluginDataLoader;
import de.intranda.goobi.plugins.newspaperRecognizer.SaveResult;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.PluginData;
import de.intranda.goobi.plugins.newspaperRecognizer.data.SaveRequest;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.DocStructRegistry;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsReader;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsStore;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsWriter;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.ProcessMetsStore;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.UnresolvedHiddenDataException;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;
import de.intranda.goobi.plugins.newspaperRecognizer.model.InvalidPageDataException;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import de.intranda.goobi.plugins.newspaperRecognizer.validation.BlockValidator;
import de.intranda.goobi.plugins.newspaperRecognizer.validation.ValidationReport;
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
import ugh.dl.Prefs;

@PluginImplementation
@Log4j2
@Data
@EqualsAndHashCode(callSuper = false)
public class NewspaperRecognizerPlugin extends AbstractStepPlugin implements IStepPlugin, IPlugin {
    private static final long serialVersionUID = -4130813487217128097L;
    private static final String PLUGIN_NAME = "intranda_step_newspaperRecognizer";
    private static final String GUI = "/uii/plugin_newspaperRecognizer.xhtml";
    private static final String ISSUE_RESULT_MANUAL_LOCATION = "/taskmanager/issues_result_manual.json";

    private PluginConfiguration configuration;
    private List<String> configErrors = new ArrayList<>();
    private String language = "en";
    private SaveResult saveResult = SaveResult.NONE;

    private String fileNameToDelete = null;
    private int fileIdToDelete;

    private transient Gson gson = new Gson();
    private transient RulesetTypes ruleset;
    private transient MetsWriter metsWriter;
    private transient MetsStore metsStore;
    private transient PluginDataLoader loader;
    private transient DocStructRegistry registry = new DocStructRegistry();
    private transient LoadedState state;
    private transient SaveRequest saveRequest;

    @Override
    public void initialize(Step step, String returnPath) {
        try {
            this.returnPath = returnPath;
            this.myStep = step;
            this.saveResult = SaveResult.NONE;
            this.registry = new DocStructRegistry();
            XMLConfiguration config = ConfigPlugins.getPluginConfig(PLUGIN_NAME);
            configuration = PluginConfiguration.parse(config);
            Locale locale = Helper.getSessionLocale();
            language = locale == null ? "en" : locale.getLanguage();
            Prefs prefs = step.getProzess().getRegelsatz().getPreferences();
            ruleset = new RulesetTypes(prefs, configuration.fields());
            metsStore = new ProcessMetsStore(step.getProzess());
            metsWriter = new MetsWriter(ruleset, configuration);
            loader = new PluginDataLoader(step.getProzess(), metsStore, new MetsReader(ruleset, configuration, language), ruleset, configuration);
            state = loader.load(registry);
            configErrors = configuration.validate(ruleset, state.volumeType());
            for (String error : configErrors) {
                log.error("Configuration error in {}: {}", PLUGIN_NAME, error);
            }
            if (!configErrors.isEmpty()) {
                saveResult = SaveResult.CONFIG_ERROR;
            }
        } catch (Exception e) {
            String message = "Error during plugin initialization";
            log.error(message, e);
            Helper.setFehlerMeldung(message, e);
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

    public boolean isLoadAllImages() {
        return configuration == null || configuration.loadAllImages();
    }

    public boolean isShowDeletePageButton() {
        return configuration != null && configuration.showDeletePageButton();
    }

    public boolean isPreventDuplicates() {
        return configuration != null && configuration.preventDuplicates();
    }

    public String getDateFormatPattern() {
        return configuration == null ? "dd.MM.yyyy" : configuration.fields().dateFormat();
    }

    public String getVolumeType() {
        return state == null ? "" : state.volumeType();
    }

    public String getTypeCatalogJson() {
        if (ruleset == null) {
            return "[]";
        }
        return gson.toJson(ruleset.catalog(language)
                .stream()
                .map(type -> type.withManagedMetadata(configuration.managedMetadata(type.name(), ruleset)))
                .toList());
    }

    public String getConfigErrorsJson() {
        return gson.toJson(configErrors);
    }

    public String getJsonData() throws DAOException, SwapException, IOException {
        if (state == null) {
            return gson.toJson(new PluginData());
        }
        List<NewspaperPage> pages = state.data().getPages();
        if (pages.stream().anyMatch(p -> p.getImage() == null)) {
            Process process = this.myStep.getProzess();
            String imageDir = process.getImagesTifDirectory(true);
            int order = 0;
            for (NewspaperPage page : pages) {
                Image image = new Image(process, imageDir, page.getFilename(), order++, 500);
                // Due to GSON serialization issues, we remove the `imagePath` property of the image to avoid its serialization. It's not required for our purposes anyway!
                image.setImagePath(null);
                page.setImage(image);
            }
        }
        return gson.toJson(state.data());
    }

    public void setJsonData(String json) {
        this.saveRequest = gson.fromJson(json, SaveRequest.class);
    }

    public String save() {
        if (!configErrors.isEmpty()) {
            saveResult = SaveResult.CONFIG_ERROR;
            Helper.setFehlerMeldung(Helper.getTranslation("plugin_newspaperRecognizer_save_configError"));
            return "";
        }
        if (saveRequest == null || state == null) {
            saveResult = SaveResult.INVALID_DATA;
            Helper.setFehlerMeldung(Helper.getTranslation("plugin_newspaperRecognizer_save_invalidData"));
            return "";
        }
        try {
            List<BlockNode> roots = BlockTree.build(saveRequest.getPages());
            ValidationReport report = new BlockValidator(ruleset, state.volumeType(), configuration).validate(roots);
            if (!report.isValid()) {
                saveResult = report.result();
                report.details().forEach(detail -> log.info("Save refused: {}", detail));
                Helper.setFehlerMeldung(Helper.getTranslation(report.messageKey()));
                return "";
            }
            List<String> filenames = saveRequest.getPages().stream().map(NewspaperPage::getFilename).toList();
            metsWriter.apply(state.digitalDocument(), registry, roots, saveRequest.getOperations(), filenames);
            metsStore.write(state.fileformat());
            saveResult = SaveResult.SUCCESS;
            Helper.setMeldung(Helper.getTranslation("dataSavedSuccessfully"));
            reload();
        } catch (InvalidPageDataException e) {
            saveResult = SaveResult.INVALID_DATA;
            log.warn("Save refused: {}", e.getMessage());
            Helper.setFehlerMeldung(Helper.getTranslation("plugin_newspaperRecognizer_save_invalidData") + ": " + e.getMessage());
        } catch (UnresolvedHiddenDataException e) {
            saveResult = SaveResult.UNRESOLVED_HIDDEN_DATA;
            log.warn("Save refused: {}", e.getMessage());
            Helper.setFehlerMeldung(Helper.getTranslation("plugin_newspaperRecognizer_save_unresolvedHiddenData") + ": " + e.getMessage());
        } catch (Exception e) {
            saveResult = SaveResult.ERROR;
            String message = "An error occurred while persisting data into the Mets file";
            log.error(message, e);
            Helper.setFehlerMeldung(message, e);
            // the in-memory document may be half-changed: start again from the file
            reload();
        }
        return "";
    }

    private void reload() {
        try {
            state = loader.load(registry);
        } catch (Exception e) {
            String message = "Error reloading the METS file";
            log.error(message, e);
            Helper.setFehlerMeldung(message, e);
        }
    }

    public void deleteFile() {
        log.debug("deleting file: {}", fileNameToDelete);
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
            if (state != null && fileIdToDelete >= 0 && fileIdToDelete < state.data().getPages().size()) {
                state.data().getPages().remove(fileIdToDelete);
            }
        } catch (IOException | DAOException | SwapException e) {
            log.error("Exception happened trying to delete file \"{}\"", fileNameToDelete, e);
        }
    }

    public String deleteManualDataAndStartAutoAnalysis() throws IOException, InterruptedException, SwapException, DAOException {
        log.info("deleteManualDataAndStartAutoAnalysis - start");
        StepBean stepBean = (StepBean) Helper.getBeanByName("AktuelleSchritteForm", StepBean.class);
        String result = stepBean.SchrittDurchBenutzerZurueckgeben();
        deleteManualData();
        this.myStep.setBearbeitungsstatusEnum(StepStatus.LOCKED);
        StepManager.saveStep(myStep);
        Optional<Step> maybePreviousStep = this.myStep.getProzess()
                .getSchritte()
                .stream()
                .filter(step -> step.getReihenfolge() < this.myStep.getReihenfolge())
                .max(Comparator.comparing(Step::getReihenfolge));
        if (maybePreviousStep.isPresent()) {
            final Step previousStep = maybePreviousStep.get();
            Optional<Step> maybePreviousPreviousStep = previousStep.getProzess()
                    .getSchritte()
                    .stream()
                    .filter(step -> step.getReihenfolge() < previousStep.getReihenfolge())
                    .max(Comparator.comparing(Step::getReihenfolge));
            if (maybePreviousPreviousStep.isPresent()) {
                previousStep.setBearbeitungsstatusEnum(StepStatus.LOCKED);
                StepManager.saveStep(previousStep);
                HelperSchritte hs = new HelperSchritte();
                hs.CloseStepObjectAutomatic(maybePreviousPreviousStep.get());
            }
        }
        log.info("deleteManualDataAndStartAutoAnalysis - returning {}", result);
        return result;
    }

    private void deleteManualData() throws IOException, SwapException, DAOException {
        Path manual = Paths.get(this.myStep.getProzess().getProcessDataDirectory() + ISSUE_RESULT_MANUAL_LOCATION);
        if (StorageProvider.getInstance().isFileExists(manual)) {
            log.info("Deleting {}", manual);
            StorageProvider.getInstance().deleteFile(manual);
        }
    }
}
