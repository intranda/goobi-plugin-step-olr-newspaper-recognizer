package de.intranda.goobi.plugins;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.page;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.start;
import static org.easymock.EasyMock.anyObject;
import static org.easymock.EasyMock.eq;
import static org.easymock.EasyMock.expect;
import static org.easymock.EasyMock.expectLastCall;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.powermock.api.easymock.PowerMock;
import org.powermock.core.classloader.annotations.PowerMockIgnore;
import org.powermock.core.classloader.annotations.PrepareForTest;
import org.powermock.modules.junit4.PowerMockRunner;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import de.intranda.goobi.plugins.newspaperRecognizer.LoadedState;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PaginationConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PaginationRule;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.PluginDataLoader;
import de.intranda.goobi.plugins.newspaperRecognizer.SaveResult;
import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenAction;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenConflictKind;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.PluginData;
import de.intranda.goobi.plugins.newspaperRecognizer.data.SaveRequest;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.DocStructRegistry;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsStore;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.MetsWriter;
import de.intranda.goobi.plugins.newspaperRecognizer.mets.UnresolvedHiddenDataException;
import de.sub.goobi.helper.Helper;
import ugh.dl.DigitalDocument;
import ugh.dl.Fileformat;

@RunWith(PowerMockRunner.class)
@PrepareForTest({ Helper.class })
@PowerMockIgnore({ "javax.management.*", "javax.xml.*", "org.xml.*", "org.w3c.*", "javax.net.ssl.*" })
public class NewspaperRecognizerPluginTest {
    private NewspaperRecognizerPlugin plugin;
    private MetsWriter metsWriter;
    private MetsStore metsStore;
    private PluginDataLoader loader;
    private Fileformat fileformat;
    private DocStructRegistry registry;

    @Before
    public void setUp() {
        PowerMock.mockStaticNice(Helper.class);
        metsWriter = PowerMock.createMock(MetsWriter.class);
        metsStore = PowerMock.createMock(MetsStore.class);
        loader = PowerMock.createMock(PluginDataLoader.class);
        fileformat = PowerMock.createMock(Fileformat.class);
        registry = new DocStructRegistry();
        DigitalDocument dd = TestDocuments.volume(TestDocuments.prefs(), 2);
        plugin = new NewspaperRecognizerPlugin();
        plugin.setConfiguration(TestDocuments.config(true));
        plugin.setRuleset(TestDocuments.ruleset());
        plugin.setMetsWriter(metsWriter);
        plugin.setMetsStore(metsStore);
        plugin.setLoader(loader);
        plugin.setRegistry(registry);
        plugin.setState(new LoadedState(fileformat, dd, "NewspaperVolume", new PluginData()));
    }

    private void request(NewspaperPage... pages) {
        SaveRequest request = new SaveRequest();
        request.setPages(new ArrayList<>(List.of(pages)));
        plugin.setSaveRequest(request);
    }

    private static BlockStart issue(String date, String number) {
        BlockStart start = start(null, "MorningIssue");
        start.setDate(date);
        start.setNumber(number);
        return start;
    }

    @Test
    public void save_withConfigErrors_reportsConfigError() {
        plugin.setConfigErrors(List.of("Unknown metadata \"Datum\" in <fields>"));
        request(page("0001.tif", 1, issue("1890-03-01", "1")));
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.CONFIG_ERROR, plugin.getSaveResult());
        PowerMock.verifyAll();
    }

    @Test
    public void save_untypedBlock_reportsMissingType() {
        request(page("0001.tif", 1, start(null, null)));
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.MISSING_TYPE, plugin.getSaveResult());
        PowerMock.verifyAll();
    }

    @Test
    public void save_duplicates_reportsDuplicates() {
        request(page("0001.tif", 1, issue("1890-03-01", "1")), page("0002.tif", 1, issue("1890-03-01", "1")));
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.DUPLICATES, plugin.getSaveResult());
        PowerMock.verifyAll();
    }

    @Test
    public void save_invalidPageData_reportsInvalidData() {
        request(page("0001.tif", 2));
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.INVALID_DATA, plugin.getSaveResult());
        PowerMock.verifyAll();
    }

    @Test
    public void save_unresolvedHiddenData_reportsItWithoutWriting() throws Exception {
        request(page("0001.tif", 1, issue("1890-03-01", "1")));
        metsWriter.apply(anyObject(), anyObject(), anyObject(), anyObject(), anyObject(), anyObject());
        expectLastCall().andThrow(new UnresolvedHiddenDataException(List.of("Removed MorningIssue on pages 1-1 contains additional data")));
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.UNRESOLVED_HIDDEN_DATA, plugin.getSaveResult());
        PowerMock.verifyAll();
    }

    @Test
    public void save_success_writesAndReloads() throws Exception {
        NewspaperPage first = page("0001.tif", 1, issue("1890-03-01", "1"));
        first.setLabel("7");
        NewspaperPage second = page("0002.tif", 1);
        second.setLabel(null);
        request(first, second);
        metsWriter.apply(anyObject(), anyObject(), anyObject(), anyObject(), eq(List.of("0001.tif", "0002.tif")), eq(List.of("7", "")));
        expectLastCall().once();
        metsStore.write(fileformat);
        expectLastCall().once();
        LoadedState reloaded = new LoadedState(fileformat, TestDocuments.volume(TestDocuments.prefs(), 1), "NewspaperVolume", new PluginData());
        expect(loader.load(registry)).andReturn(reloaded);
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.SUCCESS, plugin.getSaveResult());
        assertSame(reloaded, plugin.getState());
        PowerMock.verifyAll();
    }

    @Test
    public void save_writeFails_reportsErrorAndReloads() throws Exception {
        request(page("0001.tif", 1, issue("1890-03-01", "1")));
        metsWriter.apply(anyObject(), anyObject(), anyObject(), anyObject(), anyObject(), anyObject());
        expectLastCall().once();
        metsStore.write(fileformat);
        expectLastCall().andThrow(new IOException("disk full"));
        expect(loader.load(registry)).andReturn(new LoadedState(fileformat, TestDocuments.volume(TestDocuments.prefs(), 1), "NewspaperVolume", new PluginData()));
        PowerMock.replayAll();
        plugin.save();
        assertEquals(SaveResult.ERROR, plugin.getSaveResult());
        PowerMock.verifyAll();
    }

    @Test
    public void paginationJson_containsSettingsAndResolvedRules() {
        PluginConfiguration base = TestDocuments.config(true);
        PaginationConfiguration pagination = new PaginationConfiguration(true, false, List.of("\u2013"),
                Map.of("NewspaperSupplement", new PaginationRule(List.of("i"), false)));
        plugin.setConfiguration(new PluginConfiguration(base.loadAllImages(), base.showDeletePageButton(), base.preventDuplicates(), pagination,
                base.fields(), base.defaults(), base.types(), base.parseErrors()));
        JsonObject json = JsonParser.parseString(plugin.getPaginationJson()).getAsJsonObject();
        assertEquals(true, json.get("enabled").getAsBoolean());
        assertEquals(false, json.get("automatic").getAsBoolean());
        assertEquals("[\"\u2013\"]", json.get("withoutBlock").toString());
        JsonObject rules = json.getAsJsonObject("rules");
        assertEquals("[\"1\"]", rules.getAsJsonObject("MorningIssue").get("beginsWith").toString());
        assertEquals("[\"i\"]", rules.getAsJsonObject("NewspaperSupplement").get("beginsWith").toString());
        assertEquals(false, rules.getAsJsonObject("NewspaperSupplement").get("continueInParent").getAsBoolean());
    }

    @Test
    public void paginationJson_withoutRulesetOrConfiguration_isNull() {
        assertEquals("null", new NewspaperRecognizerPlugin().getPaginationJson());
    }

    @Test
    public void setJsonData_readsPagesAndOperations() {
        plugin.setJsonData("""
                {"pages":[{"filename":"0001.tif","depth":1,"label":"7","starts":[{"id":"b1","type":"MorningIssue","date":"1890-03-01"}]}],
                 "operations":[{"blockId":"b1","kind":"TYPE","action":"KEEP_ALLOWED"}]}
                """);
        SaveRequest request = plugin.getSaveRequest();
        assertEquals("7", request.getPages().get(0).getLabel());
        assertEquals("1890-03-01", request.getPages().get(0).getStarts().get(0).getDate());
        assertEquals(HiddenConflictKind.TYPE, request.getOperations().get(0).getKind());
        assertEquals(HiddenAction.KEEP_ALLOWED, request.getOperations().get(0).getAction());
    }
}
