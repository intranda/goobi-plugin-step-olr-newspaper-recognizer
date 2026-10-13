package de.intranda.goobi.plugins.newspaperRecognizer.model;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.page;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.start;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertSame;
import static org.junit.Assert.assertThrows;
import static org.junit.Assert.assertTrue;

import java.util.List;

import org.junit.Test;

public class BlockTreeTest {

    @Test
    public void singleBlockOverAllPages() throws Exception {
        List<BlockNode> roots = BlockTree.build(List.of(page("1", 1, start("b1", "MorningIssue")), page("2", 1), page("3", 1)));
        assertEquals(1, roots.size());
        BlockNode block = roots.get(0);
        assertEquals("b1", block.id());
        assertEquals(0, block.getLevel());
        assertEquals(0, block.getFirstPage());
        assertEquals(2, block.getLastPage());
        assertNull(block.getParent());
    }

    @Test
    public void childBlock_pagesAfterItBackInParent() throws Exception {
        List<BlockNode> roots = BlockTree.build(List.of(
                page("1", 1, start("b1", "MorningIssue")),
                page("2", 1),
                page("3", 2, start("b2", "NewspaperSupplement")),
                page("4", 2),
                page("5", 1),
                page("6", 1, start(null, null))));
        assertEquals(2, roots.size());
        BlockNode issue = roots.get(0);
        assertEquals(4, issue.getLastPage());
        BlockNode supplement = issue.getChildren().get(0);
        assertEquals(1, supplement.getLevel());
        assertEquals(2, supplement.getFirstPage());
        assertEquals(3, supplement.getLastPage());
        assertSame(issue, supplement.getParent());
        assertEquals(5, roots.get(1).getFirstPage());
        assertNull(roots.get(1).type());
    }

    @Test
    public void twoStartsOnOnePage_outermostFirst() throws Exception {
        List<BlockNode> roots = BlockTree.build(List.of(page("1", 2, start("b1", "MorningIssue"), start("b2", "TableOfContents")), page("2", 1)));
        assertEquals("b1", roots.get(0).id());
        BlockNode toc = roots.get(0).getChildren().get(0);
        assertEquals("b2", toc.id());
        assertEquals(0, toc.getFirstPage());
        assertEquals(0, toc.getLastPage());
        assertEquals(1, roots.get(0).getLastPage());
    }

    @Test
    public void depthZeroPages_belongToNoBlock() throws Exception {
        List<BlockNode> roots = BlockTree.build(List.of(page("1", 0), page("2", 1, start("b1", "MorningIssue")), page("3", 0), page("4", 1, start("b2", "EveningIssue"))));
        assertEquals(2, roots.size());
        assertEquals(1, roots.get(0).getFirstPage());
        assertEquals(1, roots.get(0).getLastPage());
        assertEquals(3, roots.get(1).getFirstPage());
    }

    @Test
    public void containsChecksRange() throws Exception {
        BlockNode block = BlockTree.build(List.of(page("1", 0), page("2", 1, start("b1", "MorningIssue")), page("3", 1))).get(0);
        assertTrue(block.contains(1, 2));
        assertFalse(block.contains(0, 1));
    }

    @Test
    public void moreStartsThanDepth_invalid() {
        InvalidPageDataException e = assertThrows(InvalidPageDataException.class,
                () -> BlockTree.build(List.of(page("1", 1, start(null, "MorningIssue"), start(null, "TableOfContents")))));
        assertEquals("Page 1 (1): depth 1 with 2 block starts", e.getMessage());
    }

    @Test
    public void depthWithoutEnclosingBlock_invalid() {
        InvalidPageDataException e = assertThrows(InvalidPageDataException.class,
                () -> BlockTree.build(List.of(page("1", 1, start(null, "MorningIssue")), page("2", 2))));
        assertEquals("Page 2 (2): depth 2 exceeds the enclosing blocks", e.getMessage());
    }

    @Test
    public void nullStarts_treatedAsNone() throws Exception {
        var page = page("1", 0);
        page.setStarts(null);
        assertEquals(List.of(), BlockTree.build(List.of(page)));
    }

    @Test
    public void flatten_preOrder() throws Exception {
        List<BlockNode> roots = BlockTree.build(List.of(
                page("1", 1, start("a", "MorningIssue")), page("2", 2, start("b", "NewspaperSupplement")), page("3", 1, start("c", "EveningIssue"))));
        assertEquals(List.of("a", "b", "c"), BlockTree.flatten(roots).stream().map(BlockNode::id).toList());
    }
}
