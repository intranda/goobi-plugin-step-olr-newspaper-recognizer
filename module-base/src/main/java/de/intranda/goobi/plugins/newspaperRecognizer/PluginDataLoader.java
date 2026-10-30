package de.intranda.goobi.plugins.newspaperRecognizer;

import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.goobi.beans.Process;

import com.google.gson.JsonElement;
import com.google.gson.JsonParser;

import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenSummary;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.PluginData;
import de.intranda.goobi.plugins.newspaperRecognizer.legacy.ConversionResult;
import de.intranda.goobi.plugins.newspaperRecognizer.legacy.LegacyDataConverter;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.DocStructRegistry;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsReader;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsStore;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.PageLabels;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.PageIndex;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.ReadResult;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.VolumeLocator;
import de.intranda.goobi.plugins.newspaperRecognizer.model.InitialBlocks;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import de.sub.goobi.helper.NIOFileUtils;
import de.sub.goobi.helper.StorageProvider;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Fileformat;

/** Decides where the session state comes from. Never writes anything. */
public class PluginDataLoader {
    static final String ISSUE_RESULT_LOCATION = "/taskmanager/issues_result.json";
    static final String ISSUE_RESULT_MANUAL_LOCATION = "/taskmanager/issues_result_manual.json";

    private final Process process;
    private final MetsStore store;
    private final MetsReader reader;
    private final RulesetTypes ruleset;
    private final PluginConfiguration config;

    public PluginDataLoader(Process process, MetsStore store, MetsReader reader, RulesetTypes ruleset, PluginConfiguration config) {
        this.process = process;
        this.store = store;
        this.reader = reader;
        this.ruleset = ruleset;
        this.config = config;
    }

    public LoadedState load(DocStructRegistry registry) throws Exception {
        Fileformat fileformat = store.read();
        DigitalDocument dd = fileformat.getDigitalDocument();
        DocStruct volume = VolumeLocator.find(dd);
        String volumeType = volume.getType().getName();
        List<String> filenames = imageFilenames();
        Map<String, Double> analysis = readAnalysis();
        PluginData data;
        Path manual = Paths.get(process.getProcessDataDirectory() + ISSUE_RESULT_MANUAL_LOCATION);
        if (!PageIndex.children(volume).isEmpty()) {
            ReadResult read = reader.read(dd, filenames, registry);
            data = new PluginData(read.pages(), new ArrayList<>(read.notices()), read.volumeHidden());
        } else if (StorageProvider.getInstance().isFileExists(manual)) {
            registry.clear();
            ConversionResult converted = new LegacyDataConverter(ruleset, config.fields().dateFormat())
                    .convert(readJson(manual).getAsJsonArray(), volumeType, filenames);
            data = new PluginData(converted.pages(), new ArrayList<>(converted.notices()), new HiddenSummary());
        } else {
            registry.clear();
            data = new PluginData(InitialBlocks.fromAnalysis(filenames, analysis), new ArrayList<>(), new HiddenSummary());
        }
        for (NewspaperPage page : data.getPages()) {
            page.setResult(analysis.getOrDefault(page.getFilename(), 0.0));
        }
        applyLabels(data.getPages(), PageLabels.read(dd));
        return new LoadedState(fileformat, dd, volumeType, data);
    }

    /** Pages that are not in the mets are uncounted. */
    public static void applyLabels(List<NewspaperPage> pages, Map<String, String> labels) {
        for (NewspaperPage page : pages) {
            page.setLabel(labels.getOrDefault(page.getFilename(), PageLabels.UNCOUNTED));
        }
    }

    private List<String> imageFilenames() throws Exception {
        return StorageProvider.getInstance()
                .list(process.getImagesTifDirectory(true), NIOFileUtils.imageNameFilter)
                .stream()
                .map(name -> Path.of(name).getFileName().toString())
                .toList();
    }

    private Map<String, Double> readAnalysis() throws Exception {
        Map<String, Double> result = new HashMap<>();
        Path automatic = Paths.get(process.getProcessDataDirectory() + ISSUE_RESULT_LOCATION);
        if (!StorageProvider.getInstance().isFileExists(automatic)) {
            return result;
        }
        for (JsonElement element : readJson(automatic).getAsJsonArray()) {
            if (element.isJsonObject() && element.getAsJsonObject().has("filename") && element.getAsJsonObject().has("result")) {
                result.put(element.getAsJsonObject().get("filename").getAsString(), element.getAsJsonObject().get("result").getAsDouble());
            }
        }
        return result;
    }

    private static JsonElement readJson(Path path) throws Exception {
        try (InputStreamReader in = new InputStreamReader(StorageProvider.getInstance().newInputStream(path), StandardCharsets.UTF_8)) {
            return JsonParser.parseReader(in);
        }
    }
}
