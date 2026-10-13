package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.add;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.addMetadata;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.filenames;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volume;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volumeOf;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import java.util.List;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenMetadataInfo;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenStructureInfo;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.Notice;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Prefs;

public class MetsReaderTest {
    private final Prefs strict = TestDocuments.prefs();
    private final Prefs permissive = TestDocuments.permissivePrefs();
    private final MetsReader reader = new MetsReader(TestDocuments.ruleset(), TestDocuments.config(false), "de");
    private final DocStructRegistry registry = new DocStructRegistry();

    private ReadResult read(DigitalDocument dd, int pages) {
        return reader.read(dd, filenames(pages), registry);
    }

    private static BlockStart startOn(ReadResult result, int page, int index) {
        return result.pages().get(page).getStarts().get(index);
    }

    @Test
    public void readsBlocksAndChildBlocks() {
        DigitalDocument dd = volume(strict, 6);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0, 1, 2, 3);
        DocStruct supplement = add(strict, dd, morning, "NewspaperSupplement", 2, 3);
        add(strict, dd, volumeOf(dd), "EveningIssue", 4, 5);

        ReadResult result = read(dd, 6);

        assertEquals(List.of(1, 1, 2, 2, 1, 1), result.pages().stream().map(NewspaperPage::getDepth).toList());
        assertEquals(List.of(1, 0, 1, 0, 1, 0), result.pages().stream().map(p -> p.getStarts().size()).toList());
        assertEquals("MorningIssue", startOn(result, 0, 0).getType());
        assertEquals("NewspaperSupplement", startOn(result, 2, 0).getType());
        assertEquals("EveningIssue", startOn(result, 4, 0).getType());
        assertEquals(morning, registry.get(startOn(result, 0, 0).getId()).orElseThrow());
        assertTrue(registry.isBlock(supplement));
        assertTrue(result.volumeHidden().isEmpty());
        assertEquals(List.of(), result.notices());
    }

    @Test
    public void readsDateNumberPrefixSuffix() {
        DigitalDocument dd = volume(strict, 1);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0);
        addMetadata(strict, morning, "DateIssued", "1890-03-01");
        addMetadata(strict, morning, "CurrentNo", "12");
        addMetadata(strict, morning, "PartNumber", "Nr. 12a");

        BlockStart start = startOn(read(dd, 1), 0, 0);

        assertEquals("1890-03-01", start.getDate());
        assertEquals("12", start.getNumber());
        assertEquals("Nr. ", start.getPrefix());
        assertEquals("a", start.getSuffix());
        assertNull(start.getDateRaw());
    }

    @Test
    public void prefixSuffixEmpty_whenNumberNotInPartNumber() {
        DigitalDocument dd = volume(strict, 1);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0);
        addMetadata(strict, morning, "CurrentNo", "12");
        addMetadata(strict, morning, "PartNumber", "XII");

        BlockStart start = startOn(read(dd, 1), 0, 0);

        assertNull(start.getPrefix());
        assertNull(start.getSuffix());
    }

    @Test
    public void unparsableDate_keptAsRaw() {
        DigitalDocument dd = volume(strict, 1);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0);
        addMetadata(strict, morning, "DateIssued", "1890");

        ReadResult result = read(dd, 1);

        assertNull(startOn(result, 0, 0).getDate());
        assertEquals("1890", startOn(result, 0, 0).getDateRaw());
        assertEquals(List.of(new Notice("plugin_newspaperRecognizer_notice_unparsableDate", List.of("Morgenausgabe", "1", "1890"))), result.notices());
    }

    @Test
    public void secondInstanceOfManagedMetadata_isHidden() {
        DigitalDocument dd = volume(strict, 1);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0);
        addMetadata(strict, morning, "CurrentNo", "12");
        addMetadata(strict, morning, "CurrentNo", "13");

        BlockStart start = startOn(read(dd, 1), 0, 0);

        assertEquals("12", start.getNumber());
        assertEquals(List.of("CurrentNo=13"), start.getHidden().getMetadata().stream().map(m -> m.type() + "=" + m.value()).toList());
    }

    @Test
    public void foreignMetadata_isHidden_templateKeysAreNot() {
        DigitalDocument dd = volume(strict, 1);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0);
        addMetadata(strict, morning, "TitleDocMain", "Morgenausgabe 12");
        addMetadata(strict, morning, "Note", "Seite 3 fehlt");

        List<HiddenMetadataInfo> hidden = startOn(read(dd, 1), 0, 0).getHidden().getMetadata();

        assertEquals(1, hidden.size());
        assertEquals("Note", hidden.get(0).type());
        assertEquals("Notiz", hidden.get(0).label());
        assertEquals("Seite 3 fehlt", hidden.get(0).value());
    }

    @Test
    public void level2Structure_isHiddenStructureOfChild() {
        DigitalDocument dd = volume(strict, 4);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0, 1, 2, 3);
        DocStruct supplement = add(strict, dd, morning, "NewspaperSupplement", 2, 3);
        DocStruct article = add(strict, dd, supplement, "Article", 3);
        addMetadata(strict, article, "TitleDocMain", "Leitartikel");

        List<HiddenStructureInfo> hidden = startOn(read(dd, 4), 2, 0).getHidden().getStructures();

        assertEquals(1, hidden.size());
        assertEquals("Article", hidden.get(0).type());
        assertEquals("Artikel", hidden.get(0).label());
        assertEquals(3, hidden.get(0).firstPage());
        assertEquals(3, hidden.get(0).lastPage());
        assertEquals("Leitartikel", hidden.get(0).title());
    }

    @Test
    public void childOfNoLongerAllowedType_isHidden() {
        DigitalDocument dd = volume(permissive, 2);
        DocStruct morning = add(permissive, dd, volumeOf(dd), "MorningIssue", 0, 1);
        add(permissive, dd, morning, "Article", 1);

        ReadResult result = read(dd, 2);

        assertEquals(List.of(1, 1), result.pages().stream().map(NewspaperPage::getDepth).toList());
        assertEquals(List.of("Article"), startOn(result, 0, 0).getHidden().getStructures().stream().map(HiddenStructureInfo::type).toList());
    }

    @Test
    public void unmappableVolumeChildren_becomeVolumeHidden() {
        DigitalDocument dd = volume(permissive, 8);
        DocStruct volume = volumeOf(dd);
        add(permissive, dd, volume, "Article", 0);
        add(permissive, dd, volume, "MorningIssue");
        add(permissive, dd, volume, "MorningIssue", 2, 4);
        add(permissive, dd, volume, "MorningIssue", 5, 6);
        add(permissive, dd, volume, "EveningIssue", 6, 7);

        ReadResult result = read(dd, 8);

        assertEquals(List.of(0, 0, 0, 0, 0, 1, 1, 0), result.pages().stream().map(NewspaperPage::getDepth).toList());
        assertEquals(List.of("Article", "MorningIssue", "MorningIssue", "EveningIssue"),
                result.volumeHidden().getStructures().stream().map(HiddenStructureInfo::type).toList());
        assertEquals(-1, result.volumeHidden().getStructures().get(1).firstPage());
        assertEquals(List.of(new Notice("plugin_newspaperRecognizer_notice_volumeHidden", List.of("4"))), result.notices());
    }

    @Test
    public void pagesMissingFromImageList_areIgnored() {
        DigitalDocument dd = volume(strict, 4);
        add(strict, dd, volumeOf(dd), "MorningIssue", 2, 3);

        ReadResult result = reader.read(dd, filenames(3), registry);

        assertEquals(List.of(0, 0, 1), result.pages().stream().map(NewspaperPage::getDepth).toList());
    }

    @Test
    public void hiddenKeysAreUnique() {
        DigitalDocument dd = volume(strict, 2);
        DocStruct morning = add(strict, dd, volumeOf(dd), "MorningIssue", 0, 1);
        addMetadata(strict, morning, "Note", "a");
        addMetadata(strict, morning, "Note", "b");

        List<HiddenMetadataInfo> hidden = startOn(read(dd, 2), 0, 0).getHidden().getMetadata();

        assertEquals(2, hidden.stream().map(HiddenMetadataInfo::key).distinct().count());
    }
}
