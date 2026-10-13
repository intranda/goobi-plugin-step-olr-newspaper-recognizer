package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.add;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.addMetadata;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.filenames;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.start;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volume;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volumeOf;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import java.util.List;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenAction;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenConflictKind;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenOperation;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Prefs;

public class HiddenDataResolverTest {
    private final Prefs strict = TestDocuments.prefs();
    private final Prefs permissive = TestDocuments.permissivePrefs();
    private final MetsReader reader = new MetsReader(TestDocuments.ruleset(), TestDocuments.config(false), "de");
    private final HiddenDataResolver resolver = new HiddenDataResolver(TestDocuments.ruleset(), TestDocuments.config(false));
    private final DocStructRegistry registry = new DocStructRegistry();

    private DigitalDocument dd;
    private List<NewspaperPage> pages;

    private void load(DigitalDocument document, int pageCount) {
        dd = document;
        pages = reader.read(dd, filenames(pageCount), registry).pages();
    }

    private String id(int page, int index) {
        return pages.get(page).getStarts().get(index).getId();
    }

    private void unblock(int first, int last) {
        for (int i = first; i <= last; i++) {
            pages.get(i).getStarts().clear();
            pages.get(i).setDepth(0);
        }
    }

    private List<String> resolve(HiddenOperation... operations) throws Exception {
        Resolution resolution = resolver.resolve("NewspaperVolume", registry, BlockTree.build(pages), List.of(operations),
                PageIndex.of(dd, filenames(pages.size())));
        return resolution.steps().stream().map(HiddenDataResolverTest::describe).toList();
    }

    private static String describe(HiddenStep step) {
        return switch (step) {
            case HiddenStep.RemoveStructure s -> "remove " + s.structure().getType().getName();
            case HiddenStep.RemoveMetadata m -> "remove metadata " + MetadataAccess.typeName(m.entry()) + "=" + MetadataAccess.value(m.entry());
            case HiddenStep.Shorten s -> "shorten " + s.structure().getType().getName() + " to " + s.firstPage() + "-" + s.lastPage();
            case HiddenStep.Rehome r -> "move " + r.structure().getType().getName() + " to "
                    + (r.target() == null ? "volume" : r.target().type() + "@" + r.target().getFirstPage());
        };
    }

    private static HiddenOperation op(String blockId, HiddenConflictKind kind, HiddenAction action) {
        return new HiddenOperation(blockId, kind, action);
    }

    /** MorningIssue [0-3] with a table of contents on pages 1 and 3 (a gap, so hidden), a second CurrentNo and a Note. */
    private DocStruct issueWithHiddenData() {
        DigitalDocument document = volume(strict, 4);
        DocStruct issue = add(strict, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3);
        addMetadata(strict, issue, "CurrentNo", "1");
        addMetadata(strict, issue, "CurrentNo", "9");
        addMetadata(strict, issue, "Note", "n");
        add(strict, document, issue, "TableOfContents", 1, 3);
        load(document, 4);
        return issue;
    }

    @Test
    public void noHiddenData_noSteps() throws Exception {
        DigitalDocument document = volume(strict, 2);
        add(strict, document, volumeOf(document), "MorningIssue", 0, 1);
        load(document, 2);
        unblock(0, 1);
        assertEquals(List.of(), resolve());
    }

    @Test
    public void deletedBlockWithHiddenData_withoutOperation_unresolved() {
        issueWithHiddenData();
        unblock(0, 3);
        UnresolvedHiddenDataException e = assertThrows(UnresolvedHiddenDataException.class, this::resolve);
        assertEquals(List.of("Removed MorningIssue on pages 1-4 contains additional data"), e.getProblems());
    }

    @Test
    public void deletedBlock_removeAll() throws Exception {
        issueWithHiddenData();
        String issue = id(0, 0);
        unblock(0, 3);
        assertEquals(List.of("remove TableOfContents"), resolve(op(issue, HiddenConflictKind.DELETED, HiddenAction.REMOVE_ALL)));
    }

    @Test
    public void deletedBlock_rehomeToCoveringBlock() throws Exception {
        DigitalDocument document = volume(strict, 6);
        DocStruct issue = add(strict, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3, 4, 5);
        DocStruct supplement = add(strict, document, issue, "NewspaperSupplement", 2, 3);
        add(strict, document, supplement, "Article", 3);
        load(document, 6);
        String oldSupplement = id(2, 0);
        pages.get(2).getStarts().clear();
        pages.get(2).getStarts().add(start(null, "NewspaperSupplement"));
        for (int i = 2; i <= 5; i++) {
            pages.get(i).setDepth(2);
        }
        assertEquals(List.of("move Article to NewspaperSupplement@2"), resolve(op(oldSupplement, HiddenConflictKind.DELETED, HiddenAction.REHOME)));
    }

    @Test
    public void deletedBlock_rehomeWithoutHome_unresolved() {
        DigitalDocument document = volume(strict, 4);
        DocStruct issue = add(strict, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3);
        DocStruct supplement = add(strict, document, issue, "NewspaperSupplement", 2, 3);
        add(strict, document, supplement, "Article", 3);
        load(document, 4);
        String oldSupplement = id(2, 0);
        pages.get(2).getStarts().clear();
        pages.get(2).setDepth(1);
        pages.get(3).setDepth(1);
        UnresolvedHiddenDataException e = assertThrows(UnresolvedHiddenDataException.class,
                () -> resolve(op(oldSupplement, HiddenConflictKind.DELETED, HiddenAction.REHOME)));
        assertEquals(List.of("No place for the additional Article of NewspaperSupplement on pages 3-4"), e.getProblems());
    }

    @Test
    public void typeChange_compatibleHiddenData_noOperationNeeded() throws Exception {
        DigitalDocument document = volume(strict, 1);
        DocStruct issue = add(strict, document, volumeOf(document), "MorningIssue", 0);
        addMetadata(strict, issue, "CurrentNo", "1");
        addMetadata(strict, issue, "CurrentNo", "9");
        load(document, 1);
        pages.get(0).getStarts().get(0).setType("EveningIssue");
        assertEquals(List.of(), resolve());
    }

    @Test
    public void typeChange_withoutOperation_unresolved() {
        issueWithHiddenData();
        pages.get(0).getStarts().get(0).setType("EveningIssue");
        UnresolvedHiddenDataException e = assertThrows(UnresolvedHiddenDataException.class, this::resolve);
        assertEquals(List.of("The new type of MorningIssue on pages 1-4 does not allow its additional data"), e.getProblems());
    }

    @Test
    public void typeChange_keepAllowed_removesOnlyIncompatibleData() throws Exception {
        issueWithHiddenData();
        pages.get(0).getStarts().get(0).setType("EveningIssue");
        assertEquals(List.of("remove TableOfContents", "remove metadata Note=n"), resolve(op(id(0, 0), HiddenConflictKind.TYPE, HiddenAction.KEEP_ALLOWED)));
    }

    @Test
    public void typeChange_removeAll() throws Exception {
        issueWithHiddenData();
        pages.get(0).getStarts().get(0).setType("EveningIssue");
        assertEquals(List.of("remove TableOfContents", "remove metadata CurrentNo=9", "remove metadata Note=n"),
                resolve(op(id(0, 0), HiddenConflictKind.TYPE, HiddenAction.REMOVE_ALL)));
    }

    @Test
    public void boundary_withoutOperation_unresolved() {
        issueWithHiddenData();
        pages.get(2).getStarts().add(start(null, "MorningIssue"));
        UnresolvedHiddenDataException e = assertThrows(UnresolvedHiddenDataException.class, this::resolve);
        assertEquals(List.of("The new pages of MorningIssue on pages 1-4 leave additional structures outside the block"), e.getProblems());
    }

    @Test
    public void boundary_shorten_clipsOrRemoves() throws Exception {
        DigitalDocument document = volume(permissive, 4);
        DocStruct issue = add(permissive, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3);
        add(permissive, document, issue, "TableOfContents", 1, 3);
        add(permissive, document, issue, "Article", 3);
        load(document, 4);
        String old = id(0, 0);
        pages.get(2).getStarts().add(start(null, "MorningIssue"));
        assertEquals(List.of("shorten TableOfContents to 0-1", "remove Article"), resolve(op(old, HiddenConflictKind.BOUNDARY, HiddenAction.SHORTEN)));
    }

    @Test
    public void boundary_rehome() throws Exception {
        DigitalDocument document = volume(permissive, 4);
        DocStruct issue = add(permissive, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3);
        add(permissive, document, issue, "Article", 3);
        load(document, 4);
        String old = id(0, 0);
        pages.get(2).getStarts().add(start(null, "MorningIssue"));
        pages.get(3).getStarts().add(start(null, "NewspaperSupplement"));
        pages.get(3).setDepth(2);
        assertEquals(List.of("move Article to NewspaperSupplement@3"), resolve(op(old, HiddenConflictKind.BOUNDARY, HiddenAction.REHOME)));
    }

    @Test
    public void explicitRemoveAll_withoutOtherChanges() throws Exception {
        issueWithHiddenData();
        assertEquals(List.of("remove TableOfContents", "remove metadata CurrentNo=9", "remove metadata Note=n"),
                resolve(op(id(0, 0), HiddenConflictKind.EXPLICIT, HiddenAction.REMOVE_ALL)));
    }
}
