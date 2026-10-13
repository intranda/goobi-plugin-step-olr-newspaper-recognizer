package de.intranda.goobi.plugins.newspaperRecognizer.model;

import static org.junit.Assert.assertEquals;

import java.util.List;
import java.util.Map;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;

public class InitialBlocksTest {

    @Test
    public void firstPageAndDetectedPagesStartUntypedBlocks() {
        List<NewspaperPage> pages = InitialBlocks.fromAnalysis(List.of("1", "2", "3", "4"), Map.of("1", 0.5, "3", -0.9, "4", -0.1));
        assertEquals(List.of(1, 1, 1, 1), pages.stream().map(NewspaperPage::getDepth).toList());
        assertEquals(List.of(1, 0, 1, 0), pages.stream().map(p -> p.getStarts().size()).toList());
        assertEquals(null, pages.get(2).getStarts().get(0).getType());
        assertEquals(-0.9, pages.get(2).getResult(), 0.0);
        assertEquals(0.0, pages.get(1).getResult(), 0.0);
    }

    @Test
    public void noImages_noPages() {
        assertEquals(List.of(), InitialBlocks.fromAnalysis(List.of(), Map.of()));
    }
}
