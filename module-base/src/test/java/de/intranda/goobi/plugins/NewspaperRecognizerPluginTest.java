package de.intranda.goobi.plugins;

import de.intranda.goobi.plugins.newspaperRecognizer.MetsWriter;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPageMetadata;
import de.sub.goobi.helper.Helper;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.powermock.api.easymock.PowerMock;
import org.powermock.core.classloader.annotations.PowerMockIgnore;
import org.powermock.core.classloader.annotations.PrepareForTest;
import org.powermock.modules.junit4.PowerMockRunner;

import java.util.ArrayList;
import java.util.List;

import static org.easymock.EasyMock.anyString;
import static org.easymock.EasyMock.expect;
import static org.easymock.EasyMock.expectLastCall;
import static org.junit.Assert.assertEquals;

@RunWith(PowerMockRunner.class)
@PrepareForTest({Helper.class})
@PowerMockIgnore({"javax.management.*", "javax.xml.*", "org.xml.*", "org.w3c.*", "javax.net.ssl.*"})
public class NewspaperRecognizerPluginTest {

    private NewspaperRecognizerPlugin plugin;
    private MetsWriter metsWriter;

    @Before
    public void setUp() {
        plugin = new NewspaperRecognizerPlugin();
        metsWriter = PowerMock.createMock(MetsWriter.class);
        plugin.setMetsWriter(metsWriter);
    }

    private NewspaperPage createPage(String issueTypeName, String dateStr) {
        NewspaperPage page = new NewspaperPage();
        page.setIssueTypeName(issueTypeName);
        page.setMetadata(new NewspaperPageMetadata(dateStr, null, null, null));
        return page;
    }

    @Test
    public void save_withDuplicatesAndPreventEnabled_blocksWrite() throws Exception {
        plugin.setPreventDuplicateIssues(true);
        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(createPage("IssueA", "01.01.2025"));
        pages.add(createPage("IssueA", "01.01.2025"));
        plugin.setPages(pages);

        PowerMock.mockStatic(Helper.class);
        expect(Helper.getTranslation("plugin_newspaperRecognizer_duplicateIssueWarning")).andReturn("Duplicate issues found");
        Helper.setFehlerMeldung("Duplicate issues found");
        expectLastCall().once();
        PowerMock.replayAll();

        String result = plugin.save();

        assertEquals("", result);
        PowerMock.verifyAll();
        // metsWriter.write() should NOT have been called — no expectation was set, so EasyMock would fail if it was called
    }

    @Test
    public void save_withoutDuplicatesAndPreventEnabled_proceedsNormally() throws Exception {
        plugin.setPreventDuplicateIssues(true);
        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(createPage("IssueA", "01.01.2025"));
        pages.add(createPage("IssueA", "02.01.2025"));
        plugin.setPages(pages);

        metsWriter.write(pages);
        expectLastCall().once();
        PowerMock.replayAll();

        String result = plugin.save();

        assertEquals("", result);
        PowerMock.verifyAll();
    }

    @Test
    public void save_withDuplicatesButPreventDisabled_proceedsNormally() throws Exception {
        plugin.setPreventDuplicateIssues(false);
        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(createPage("IssueA", "01.01.2025"));
        pages.add(createPage("IssueA", "01.01.2025"));
        plugin.setPages(pages);

        metsWriter.write(pages);
        expectLastCall().once();
        PowerMock.replayAll();

        String result = plugin.save();

        assertEquals("", result);
        PowerMock.verifyAll();
    }

    // --- Supplement duplicate save tests ---

    private NewspaperPage createSupplementPage(String issueTypeName, String dateStr, String supplementTypeName) {
        NewspaperPage page = new NewspaperPage();
        page.setIssueTypeName(issueTypeName);
        page.setMetadata(new NewspaperPageMetadata(dateStr, null, null, null));
        page.setSupplementTypeName(supplementTypeName);
        return page;
    }

    @Test
    public void save_withDuplicateSupplementsAndPreventEnabled_blocksWrite() throws Exception {
        plugin.setPreventDuplicateIssues(false);
        plugin.setPreventDuplicateSupplements(true);
        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(createPage("IssueA", "01.01.2025"));
        NewspaperPage supp1 = new NewspaperPage();
        supp1.setSupplementTypeName("Kultur");
        pages.add(supp1);
        NewspaperPage supp2 = new NewspaperPage();
        supp2.setSupplementTypeName("Kultur");
        pages.add(supp2);
        plugin.setPages(pages);

        PowerMock.mockStatic(Helper.class);
        expect(Helper.getTranslation("plugin_newspaperRecognizer_duplicateSupplementWarning")).andReturn("Duplicate supplements found");
        Helper.setFehlerMeldung("Duplicate supplements found");
        expectLastCall().once();
        PowerMock.replayAll();

        String result = plugin.save();

        assertEquals("", result);
        PowerMock.verifyAll();
    }

    @Test
    public void save_withoutDuplicateSupplementsAndPreventEnabled_proceedsNormally() throws Exception {
        plugin.setPreventDuplicateIssues(false);
        plugin.setPreventDuplicateSupplements(true);
        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(createPage("IssueA", "01.01.2025"));
        NewspaperPage supp1 = new NewspaperPage();
        supp1.setSupplementTypeName("Kultur");
        pages.add(supp1);
        NewspaperPage supp2 = new NewspaperPage();
        supp2.setSupplementTypeName("Sport");
        pages.add(supp2);
        plugin.setPages(pages);

        metsWriter.write(pages);
        expectLastCall().once();
        PowerMock.replayAll();

        String result = plugin.save();

        assertEquals("", result);
        PowerMock.verifyAll();
    }

    @Test
    public void save_withDuplicateSupplementsButPreventDisabled_proceedsNormally() throws Exception {
        plugin.setPreventDuplicateIssues(false);
        plugin.setPreventDuplicateSupplements(false);
        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(createPage("IssueA", "01.01.2025"));
        NewspaperPage supp1 = new NewspaperPage();
        supp1.setSupplementTypeName("Kultur");
        pages.add(supp1);
        NewspaperPage supp2 = new NewspaperPage();
        supp2.setSupplementTypeName("Kultur");
        pages.add(supp2);
        plugin.setPages(pages);

        metsWriter.write(pages);
        expectLastCall().once();
        PowerMock.replayAll();

        String result = plugin.save();

        assertEquals("", result);
        PowerMock.verifyAll();
    }
}
