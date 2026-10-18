package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldDefinition;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.add;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.addMetadata;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.filenames;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.pageOf;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.snapshot;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.start;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volume;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volumeOf;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;

import java.util.Collections;
import java.util.List;
import java.util.Map;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.config.MetadataTemplate;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenAction;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenConflictKind;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenOperation;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Prefs;

public class MetsWriterTest {
    private final Prefs strict = TestDocuments.prefs();
    private final Prefs permissive = TestDocuments.permissivePrefs();
    private final RulesetTypes ruleset = TestDocuments.ruleset();
    private final DocStructRegistry registry = new DocStructRegistry();

    private PluginConfiguration config = TestDocuments.config(false, false);
    private DigitalDocument dd;
    private List<NewspaperPage> pages;

    private void load(DigitalDocument document, List<String> filenames) {
        dd = document;
        pages = new MetsReader(ruleset, config, "de").read(dd, filenames, registry).pages();
    }

    private void write(HiddenOperation... operations) throws Exception {
        new MetsWriter(ruleset, config).apply(dd, registry, BlockTree.build(pages), List.of(operations),
                pages.stream().map(NewspaperPage::getFilename).toList(), Collections.nCopies(pages.size(), ""));
    }

    private BlockStart startOn(int page, int index) {
        return pages.get(page).getStarts().get(index);
    }

    private static List<String> metadata(DocStruct ds) {
        return ds.getAllMetadata() == null ? List.of() : ds.getAllMetadata().stream().map(m -> m.getType().getName() + "=" + m.getValue()).toList();
    }

    private static List<String> types(DocStruct ds) {
        return ds.getAllChildren() == null ? List.of() : ds.getAllChildren().stream().map(c -> c.getType().getName()).toList();
    }

    private static List<String> images(DocStruct ds) {
        return PageIndex.targets(ds).stream().map(DocStruct::getImageName).toList();
    }

    /**
     * Pages 0-3: MorningIssue with a table of contents on pages 1 and 3 (hidden: gap), a supplement on 2-3 with an article on 3
     * (hidden: level 2), a second CurrentNo and a Note (hidden metadata). Pages 4-5: EveningIssue. Pages 6-7: no structure.
     * The volume also has a MorningIssue without pages (hidden data of the volume).
     */
    private DigitalDocument fixture() {
        DigitalDocument document = volume(strict, 8);
        DocStruct volume = volumeOf(document);
        DocStruct morning = add(strict, document, volume, "MorningIssue", 0, 1, 2, 3);
        addMetadata(strict, morning, "DateIssued", "1890-03-01");
        addMetadata(strict, morning, "CurrentNo", "1");
        addMetadata(strict, morning, "PartNumber", "Nr. 1");
        addMetadata(strict, morning, "TitleDocMain", "Morgenausgabe Nr. 1");
        addMetadata(strict, morning, "CurrentNo", "9");
        addMetadata(strict, morning, "Note", "n");
        add(strict, document, morning, "TableOfContents", 1, 3);
        DocStruct supplement = add(strict, document, morning, "NewspaperSupplement", 2, 3);
        DocStruct article = add(strict, document, supplement, "Article", 3);
        addMetadata(strict, article, "TitleDocMain", "Leitartikel");
        DocStruct evening = add(strict, document, volume, "EveningIssue", 4, 5);
        addMetadata(strict, evening, "DateIssued", "1890-03-01");
        addMetadata(strict, evening, "CurrentNo", "1");
        addMetadata(strict, evening, "PartNumber", "1");
        add(strict, document, volume, "MorningIssue");
        return document;
    }

    @Test
    public void roundTrip_withoutChanges_leavesDocumentIdentical() throws Exception {
        DigitalDocument document = fixture();
        String before = snapshot(document);
        load(document, filenames(8));
        write();
        assertEquals(before, snapshot(dd));
    }

    @Test
    public void unchangedSave_keepsPartNumberOfBlockWithoutNumber() throws Exception {
        // review finding 2
        DigitalDocument document = volume(strict, 1);
        DocStruct evening = add(strict, document, volumeOf(document), "EveningIssue", 0);
        addMetadata(strict, evening, "PartNumber", "Beilage A");
        load(document, filenames(1));
        write();
        assertEquals(List.of("PartNumber=Beilage A"), metadata(evening));
    }

    @Test
    public void unchangedSave_keepsPositionOfHiddenStructures() throws Exception {
        // review finding 4: a table of contents with a gap is hidden data of the volume and keeps its place
        DigitalDocument document = volume(strict, 4);
        DocStruct volume = volumeOf(document);
        add(strict, document, volume, "EveningIssue", 0, 1);
        add(strict, document, volume, "TableOfContents", 2, 3);
        add(strict, document, volume, "TableOfContents", 0, 2);
        String before = snapshot(document);
        load(document, filenames(4));
        write();
        assertEquals(before, snapshot(dd));
    }

    @Test
    public void newBlock_getsManagedMetadataInOrder() throws Exception {
        config = TestDocuments.config(false, true);
        load(volume(strict, 2), filenames(2));
        BlockStart start = start(null, "MorningIssue");
        start.setDate("1890-03-02");
        start.setPrefix("Nr. ");
        start.setNumber("2");
        start.setSuffix("a");
        pages.get(0).getStarts().add(start);
        pages.forEach(p -> p.setDepth(1));
        write();
        DocStruct issue = volumeOf(dd).getAllChildren().get(0);
        assertEquals(List.of("DateIssued=1890-03-02", "CurrentNo=2", "PartNumber=Nr. 2a", "TitleDocMain=Morgenausgabe Nr. 2a"), metadata(issue));
        assertEquals(List.of("0001.tif", "0002.tif"), images(issue));
    }

    @Test
    public void storeFormat_usedForDate() throws Exception {
        FieldConfiguration fields = new FieldConfiguration("DateIssued", "dd.MM.yyyy", "dd.MM.yyyy", "CurrentNo", "PartNumber");
        config = new PluginConfiguration(true, false, false, TestDocuments.PAGINATION_DISABLED, fields, List.of(), Map.of(), List.of());
        load(volume(strict, 1), filenames(1));
        BlockStart start = start(null, "EveningIssue");
        start.setDate("1890-03-02");
        pages.get(0).getStarts().add(start);
        pages.get(0).setDepth(1);
        write();
        assertEquals(List.of("DateIssued=02.03.1890"), metadata(volumeOf(dd).getAllChildren().get(0)));
    }

    @Test
    public void typeChange_keepsDocStruct_andDropsOldManagedMetadata() throws Exception {
        DigitalDocument document = volume(strict, 1);
        DocStruct morning = add(strict, document, volumeOf(document), "MorningIssue", 0);
        addMetadata(strict, morning, "CurrentNo", "1");
        addMetadata(strict, morning, "TitleDocMain", "Morgenausgabe 1");
        load(document, filenames(1));
        startOn(0, 0).setType("EveningIssue");
        write();
        assertSame(morning, volumeOf(dd).getAllChildren().get(0));
        assertEquals("EveningIssue", morning.getType().getName());
        assertEquals(List.of("CurrentNo=1", "PartNumber=1"), metadata(morning));
    }

    @Test
    public void typeChange_toTypeWithoutDateField_removesDate() throws Exception {
        DigitalDocument document = volume(strict, 1);
        DocStruct morning = add(strict, document, volumeOf(document), "MorningIssue", 0);
        addMetadata(strict, morning, "DateIssued", "1890-03-01");
        addMetadata(strict, morning, "CurrentNo", "1");
        load(document, filenames(1));
        startOn(0, 0).setType("ExtraEdition");
        write();
        assertEquals("ExtraEdition", morning.getType().getName());
        assertEquals(List.of("CurrentNo=1"), metadata(morning));
    }

    @Test
    public void changedNumber_keepsSecondInstance() throws Exception {
        load(fixture(), filenames(8));
        startOn(0, 0).setNumber("5");
        write();
        DocStruct morning = volumeOf(dd).getAllChildren().get(0);
        assertEquals(List.of("DateIssued=1890-03-01", "CurrentNo=5", "PartNumber=Nr. 5", "TitleDocMain=Morgenausgabe Nr. 5", "CurrentNo=9", "Note=n"),
                metadata(morning));
    }

    @Test
    public void emptyNumber_removesManagedNumberMetadata() throws Exception {
        load(fixture(), filenames(8));
        startOn(4, 0).setNumber(null);
        write();
        DocStruct evening = volumeOf(dd).getAllChildren().get(1);
        assertEquals(List.of("DateIssued=1890-03-01"), metadata(evening));
    }

    @Test
    public void removedBlock_isDetachedWithItsReferences() throws Exception {
        load(fixture(), filenames(8));
        pages.get(4).getStarts().clear();
        pages.get(4).setDepth(0);
        pages.get(5).setDepth(0);
        write();
        assertEquals(List.of("MorningIssue", "MorningIssue"), types(volumeOf(dd)));
        assertEquals(1, pageOf(dd, 4).getAllFromReferences(PageIndex.LOGICAL_PHYSICAL).size());
    }

    @Test
    public void childBlock_movesToNewParent_whenItsParentIsRemoved() throws Exception {
        DigitalDocument document = volume(strict, 4);
        add(strict, document, volumeOf(document), "MorningIssue", 0, 1);
        DocStruct second = add(strict, document, volumeOf(document), "MorningIssue", 2, 3);
        DocStruct supplement = add(strict, document, second, "NewspaperSupplement", 3);
        load(document, filenames(4));
        pages.get(2).getStarts().clear();
        write();
        DocStruct first = volumeOf(dd).getAllChildren().get(0);
        assertEquals(1, volumeOf(dd).getAllChildren().size());
        assertSame(supplement, first.getAllChildren().get(0));
        assertEquals(List.of("0001.tif", "0002.tif", "0003.tif", "0004.tif"), images(first));
    }

    @Test
    public void hiddenStructures_keptWhenStillInside() throws Exception {
        load(fixture(), filenames(8));
        startOn(0, 0).setDate("1890-03-02");
        write();
        DocStruct morning = volumeOf(dd).getAllChildren().get(0);
        assertEquals(List.of("TableOfContents", "NewspaperSupplement"), types(morning));
        assertEquals(List.of("Article"), types(morning.getAllChildren().get(1)));
    }

    @Test
    public void rehome_movesStructureToCoveringBlock() throws Exception {
        load(fixture(), filenames(8));
        String supplement = startOn(2, 0).getId();
        pages.get(2).getStarts().clear();
        pages.get(2).getStarts().add(start(null, "NewspaperSupplement"));
        pages.get(1).getStarts().add(start(null, "NewspaperSupplement"));
        pages.get(1).setDepth(2);
        write(new HiddenOperation(supplement, HiddenConflictKind.DELETED, HiddenAction.REHOME));
        DocStruct morning = volumeOf(dd).getAllChildren().get(0);
        assertEquals(List.of("TableOfContents", "NewspaperSupplement", "NewspaperSupplement"), types(morning));
        assertEquals(List.of(), types(morning.getAllChildren().get(1)));
        assertEquals(List.of("Article"), types(morning.getAllChildren().get(2)));
    }

    @Test
    public void shorten_dropsReferencesOutsideTheBlock() throws Exception {
        load(fixture(), filenames(8));
        String morning = startOn(0, 0).getId();
        pages.get(2).getStarts().add(0, start(null, "EveningIssue"));
        write(new HiddenOperation(morning, HiddenConflictKind.BOUNDARY, HiddenAction.SHORTEN));
        DocStruct issue = volumeOf(dd).getAllChildren().get(0);
        assertEquals(List.of("TableOfContents"), types(issue));
        assertEquals(List.of("0002.tif"), images(issue.getAllChildren().get(0)));
    }

    @Test
    public void unresolvedHiddenData_changesNothing() {
        DigitalDocument document = fixture();
        String before = snapshot(document);
        load(document, filenames(8));
        for (int i = 0; i <= 3; i++) {
            pages.get(i).getStarts().clear();
            pages.get(i).setDepth(0);
        }
        assertThrows(UnresolvedHiddenDataException.class, this::write);
        assertEquals(before, snapshot(dd));
    }

    @Test
    public void physicalPages_reconciledByFilename() throws Exception {
        DigitalDocument document = volume(strict, 4);
        add(strict, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3);
        load(document, List.of("0002.tif", "0003.tif", "0005.tif"));
        pages.get(2).setDepth(1);
        write();
        List<DocStruct> physical = dd.getPhysicalDocStruct().getAllChildren();
        assertEquals(List.of("0002.tif", "0003.tif", "0005.tif"), physical.stream().map(DocStruct::getImageName).toList());
        assertEquals(List.of("1", "2", "3"), physical.stream().map(p -> MetadataAccess.firstValue(p, "physPageNumber")).toList());
        assertEquals(List.of("0002.tif", "0003.tif", "0005.tif"), images(volumeOf(dd).getAllChildren().get(0)));
        assertEquals(List.of("0002.tif", "0003.tif", "0005.tif"), images(volumeOf(dd)));
        assertEquals(1, physical.get(2).getAllContentFileReferences().size());
        assertEquals("uncounted", MetadataAccess.firstValue(physical.get(2), "logicalPageNumber"));
    }

    private void writeLabels(String... labels) throws Exception {
        new MetsWriter(ruleset, config).apply(dd, registry, BlockTree.build(pages), List.of(), pages.stream().map(NewspaperPage::getFilename).toList(),
                List.of(labels));
    }

    private void setLabel(int page, String value) throws Exception {
        MetadataAccess.setFirst(TestDocuments.pageOf(dd, page), strict.getMetadataTypeByName("logicalPageNumber"), value);
    }

    private List<String> labelsInMets() {
        return dd.getPhysicalDocStruct().getAllChildren().stream().map(p -> MetadataAccess.firstValue(p, "logicalPageNumber")).toList();
    }

    private void enablePagination() {
        config = TestDocuments.config(false, true);
    }

    @Test
    public void labels_changedLabelWritten() throws Exception {
        enablePagination();
        load(volume(strict, 2), filenames(2));
        writeLabels("1", "7");
        assertEquals(List.of("1", "7"), labelsInMets());
    }

    @Test
    public void labels_untouchedRawTextKept() throws Exception {
        enablePagination();
        load(volume(strict, 4), filenames(4));
        setLabel(0, " 5 ");
        setLabel(1, "[ 3 ]");
        setLabel(2, "uncounted");
        setLabel(3, "1r");
        writeLabels("5", "[3]", "\u2013", "1r");
        assertEquals(List.of(" 5 ", "[ 3 ]", "uncounted", "1r"), labelsInMets());
    }

    @Test
    public void labels_dashWrittenAsUncounted() throws Exception {
        enablePagination();
        load(volume(strict, 1), filenames(1));
        setLabel(0, "3");
        writeLabels("\u2013");
        assertEquals(List.of("uncounted"), labelsInMets());
    }

    @Test
    public void labels_emptyNotWritten() throws Exception {
        enablePagination();
        load(volume(strict, 1), filenames(1));
        setLabel(0, null);
        writeLabels("");
        assertEquals(Collections.singletonList(null), labelsInMets());
    }

    @Test
    public void labels_newPageUncountedUnlessLabelled() throws Exception {
        enablePagination();
        load(volume(strict, 1), filenames(3));
        writeLabels("1", "", "4");
        assertEquals(List.of("1", "uncounted", "4"), labelsInMets());
    }

    @Test
    public void labels_disabled_existingUntouched_newPagesUncounted() throws Exception {
        config = TestDocuments.config(false, false);
        load(volume(strict, 1), filenames(2));
        writeLabels("9", "9");
        assertEquals(List.of("1", "uncounted"), labelsInMets());
    }

    @Test
    public void labels_enabled_emptyLabels_noAutomaticPaginationOnSave() throws Exception {
        config = TestDocuments.config(false, true);
        DigitalDocument document = volume(strict, 6);
        DocStruct morning = add(strict, document, volumeOf(document), "MorningIssue", 0, 1, 2, 3);
        add(strict, document, morning, "NewspaperSupplement", 2, 3);
        load(document, filenames(6));
        startOn(0, 0).setDate("1890-03-01");
        write();
        assertEquals(List.of("1", "2", "3", "4", "5", "6"), labelsInMets());
    }

    @Test
    public void volumeHiddenStructures_untouched() throws Exception {
        config = TestDocuments.config(false, false);
        DigitalDocument document = volume(permissive, 6);
        DocStruct volume = volumeOf(document);
        DocStruct article = add(permissive, document, volume, "Article", 5);
        addMetadata(permissive, article, "TitleDocMain", "Fremd");
        DocStruct morning = add(permissive, document, volume, "MorningIssue", 0, 1);
        addMetadata(permissive, morning, "DateIssued", "1890-03-01");
        load(document, filenames(6));
        startOn(0, 0).setDate("1890-03-02");
        write();
        assertEquals(List.of("Article", "MorningIssue"), types(volumeOf(dd)));
        assertSame(article, volumeOf(dd).getAllChildren().get(0));
        assertEquals(List.of("TitleDocMain=Fremd"), metadata(article));
        assertEquals(List.of("0006.tif"), images(article));
    }

    private static final List<FieldDefinition> VISIBLE = List.of(FieldDefinition.of("TitleDocMain", "Ausgabe {no}", false, false),
            FieldDefinition.of("Note", null, false, false), FieldDefinition.of("CurrentNoSorting", "{no}", true, false));

    @Test
    public void visibleValues_writtenAfterRoleFields_beforeHiddenFields() throws Exception {
        config = TestDocuments.config(VISIBLE, Map.of());
        load(volume(strict, 1), filenames(1));
        BlockStart start = start(null, "MorningIssue");
        start.setDate("1890-03-02");
        start.setNumber("2");
        start.getValues().put("TitleDocMain", " Sonderausgabe ");
        start.getValues().put("Note", "Beschädigt");
        pages.get(0).getStarts().add(start);
        pages.get(0).setDepth(1);
        write();
        assertEquals(List.of("DateIssued=1890-03-02", "CurrentNo=2", "PartNumber=2", "TitleDocMain=Sonderausgabe", "Note=Beschädigt", "CurrentNoSorting=2"),
                metadata(volumeOf(dd).getAllChildren().get(0)));
    }

    @Test
    public void visibleValues_emptyRemoves_missingKeyKeeps() throws Exception {
        config = TestDocuments.config(VISIBLE, Map.of());
        DigitalDocument document = volume(strict, 1);
        DocStruct morning = add(strict, document, volumeOf(document), "MorningIssue", 0);
        addMetadata(strict, morning, "DateIssued", "1890-03-02");
        addMetadata(strict, morning, "TitleDocMain", "Sonderausgabe");
        addMetadata(strict, morning, "Note", "Beschädigt");
        load(document, filenames(1));
        startOn(0, 0).getValues().put("TitleDocMain", "");
        startOn(0, 0).getValues().remove("Note");
        write();
        assertEquals(List.of("DateIssued=1890-03-02", "Note=Beschädigt", "CurrentNoSorting=[MISSING]"), metadata(volumeOf(dd).getAllChildren().get(0)));
    }

    @Test
    public void values_ofUnconfiguredOrHiddenOrDisallowedFields_ignored() throws Exception {
        config = TestDocuments.config(VISIBLE, Map.of());
        load(volume(strict, 1), filenames(1));
        BlockStart start = start(null, "EveningIssue");
        start.getValues().put("Note", "nicht erlaubt");
        start.getValues().put("CurrentNoSorting", "99");
        start.getValues().put("PartNumber", "Nr. 99");
        pages.get(0).getStarts().add(start);
        pages.get(0).setDepth(1);
        write();
        assertEquals(List.of("CurrentNoSorting=[MISSING]"), metadata(volumeOf(dd).getAllChildren().get(0)));
    }

    /** MorningIssue on page 1 with a date and the given metadata, loaded with a config where only MorningIssue has the fields. */
    private void morningWithFields(List<FieldDefinition> morningFields, String... metadata) {
        config = TestDocuments.config(List.of(), Map.of("MorningIssue", morningFields));
        DigitalDocument document = volume(strict, 1);
        DocStruct morning = add(strict, document, volumeOf(document), "MorningIssue", 0);
        addMetadata(strict, morning, "DateIssued", "1890-03-02");
        for (int i = 0; i < metadata.length; i += 2) {
            addMetadata(strict, morning, metadata[i], metadata[i + 1]);
        }
        load(document, filenames(1));
    }

    @Test
    public void typeChange_userValueOfAFieldTheNewTypeDoesNotShow_keptWithTheValueShown() throws Exception {
        morningWithFields(List.of(FieldDefinition.of("TitleDocMain", null, false, false)), "TitleDocMain", "Sonderausgabe");
        startOn(0, 0).setType("EveningIssue");
        startOn(0, 0).getValues().put("TitleDocMain", "Sonderausgabe 2");
        write();
        DocStruct evening = volumeOf(dd).getAllChildren().get(0);
        assertEquals("EveningIssue", evening.getType().getName());
        assertEquals(List.of("DateIssued=1890-03-02", "TitleDocMain=Sonderausgabe 2"), metadata(evening));
    }

    @Test
    public void typeChange_generatedOrBlankValueOfAFieldTheNewTypeDoesNotShow_removed() throws Exception {
        morningWithFields(List.of(FieldDefinition.of("TitleDocMain", "Morgenausgabe vom {date:dd.MM.yyyy}", false, false)),
                "TitleDocMain", "Morgenausgabe vom 02.03.1890");
        startOn(0, 0).setType("EveningIssue");
        startOn(0, 0).getValues().remove("TitleDocMain");
        write();
        assertEquals(List.of("DateIssued=1890-03-02"), metadata(volumeOf(dd).getAllChildren().get(0)));

        morningWithFields(List.of(FieldDefinition.of("TitleDocMain", null, false, false)), "TitleDocMain", "Sonderausgabe");
        startOn(0, 0).setType("EveningIssue");
        startOn(0, 0).getValues().put("TitleDocMain", " ");
        write();
        assertEquals(List.of("DateIssued=1890-03-02"), metadata(volumeOf(dd).getAllChildren().get(0)));
    }
}
