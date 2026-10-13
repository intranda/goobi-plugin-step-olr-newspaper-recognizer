package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.add;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.filenames;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.pageOf;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volume;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volumeOf;
import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.List;
import java.util.Map;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Prefs;

public class PageIndexTest {
    private final Prefs prefs = TestDocuments.prefs();

    @Test
    public void of_mapsPagesOfImageListOnly() {
        DigitalDocument dd = volume(prefs, 4);
        Map<DocStruct, Integer> index = PageIndex.of(dd, List.of("0002.tif", "0001.tif", "0004.tif"));
        assertEquals(Integer.valueOf(1), index.get(pageOf(dd, 0)));
        assertEquals(Integer.valueOf(0), index.get(pageOf(dd, 1)));
        assertNull(index.get(pageOf(dd, 2)));
        assertEquals(Integer.valueOf(2), index.get(pageOf(dd, 3)));
    }

    @Test
    public void ownPagesAndSubtreeRange() {
        DigitalDocument dd = volume(prefs, 6);
        DocStruct issue = add(prefs, dd, volumeOf(dd), "MorningIssue", 1, 2);
        DocStruct supplement = add(prefs, dd, issue, "NewspaperSupplement");
        add(prefs, dd, supplement, "Article", 4);
        Map<DocStruct, Integer> index = PageIndex.of(dd, filenames(6));
        assertEquals(List.of(1, 2), PageIndex.ownPages(issue, index));
        assertEquals(List.of(), PageIndex.ownPages(supplement, index));
        assertArrayEquals(new int[] { 4, 4 }, PageIndex.subtreeRange(supplement, index));
        assertArrayEquals(new int[] { 1, 4 }, PageIndex.subtreeRange(issue, index));
        assertNull(PageIndex.subtreeRange(add(prefs, dd, volumeOf(dd), "TableOfContents"), index));
    }

    @Test
    public void children_neverNull() {
        DigitalDocument dd = volume(prefs, 1);
        assertEquals(List.of(), PageIndex.children(add(prefs, dd, volumeOf(dd), "TableOfContents", 0)));
    }
}
