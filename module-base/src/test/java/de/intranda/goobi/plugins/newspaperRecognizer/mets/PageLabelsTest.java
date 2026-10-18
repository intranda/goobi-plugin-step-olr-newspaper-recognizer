package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.page;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.pageOf;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volume;
import static org.junit.Assert.assertEquals;

import java.util.List;
import java.util.Map;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.PluginDataLoader;
import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import ugh.dl.DigitalDocument;
import ugh.dl.Prefs;
import ugh.exceptions.UGHException;

public class PageLabelsTest {
    private final Prefs prefs = TestDocuments.prefs();

    @Test
    public void read_mapsUncountedMissingAndValues() throws UGHException {
        DigitalDocument dd = volume(prefs, 4);
        MetadataAccess.setFirst(pageOf(dd, 0), prefs.getMetadataTypeByName("logicalPageNumber"), "uncounted");
        MetadataAccess.setFirst(pageOf(dd, 1), prefs.getMetadataTypeByName("logicalPageNumber"), null);
        MetadataAccess.setFirst(pageOf(dd, 2), prefs.getMetadataTypeByName("logicalPageNumber"), " 5 ");
        MetadataAccess.setFirst(pageOf(dd, 3), prefs.getMetadataTypeByName("logicalPageNumber"), "1r");
        assertEquals(Map.of("0001.tif", "–", "0002.tif", "", "0003.tif", "5", "0004.tif", "1r"), PageLabels.read(dd));
    }

    @Test
    public void read_keepsRawNotation() throws UGHException {
        DigitalDocument dd = volume(prefs, 2);
        MetadataAccess.setFirst(pageOf(dd, 0), prefs.getMetadataTypeByName("logicalPageNumber"), "[ 3 ]");
        MetadataAccess.setFirst(pageOf(dd, 1), prefs.getMetadataTypeByName("logicalPageNumber"), "-");
        assertEquals(Map.of("0001.tif", "[ 3 ]", "0002.tif", "-"), PageLabels.read(dd));
    }

    @Test
    public void normalize_variants() {
        assertEquals("–", PageLabels.normalize("uncounted"));
        assertEquals("–", PageLabels.normalize("-"));
        assertEquals("–", PageLabels.normalize("–"));
        assertEquals("[3]", PageLabels.normalize(" [ 3 ] "));
        assertEquals("S. 5", PageLabels.normalize("S. 5"));
        assertEquals("", PageLabels.normalize(null));
    }

    @Test
    public void applyLabels_setsLabelsOrEmpty() {
        List<NewspaperPage> pages = List.of(page("0001.tif", 0), page("0002.tif", 0), page("0003.tif", 0));
        PluginDataLoader.applyLabels(pages, Map.of("0001.tif", "–", "0003.tif", "7"));
        assertEquals("–", pages.get(0).getLabel());
        assertEquals("", pages.get(1).getLabel());
        assertEquals("7", pages.get(2).getLabel());
    }
}
