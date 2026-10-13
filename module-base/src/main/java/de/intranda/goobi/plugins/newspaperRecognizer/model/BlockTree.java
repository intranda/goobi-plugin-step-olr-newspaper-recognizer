package de.intranda.goobi.plugins.newspaperRecognizer.model;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;

/**
 * Builds the block tree from the flat page list. A page with {@code k} starts and depth {@code d} opens blocks on the levels
 * {@code d-k … d-1}; every block on a level {@code >= d-k} that was open before ends on the previous page.
 */
public final class BlockTree {

    private BlockTree() {
    }

    public static List<BlockNode> build(List<NewspaperPage> pages) throws InvalidPageDataException {
        List<BlockNode> roots = new ArrayList<>();
        Deque<BlockNode> open = new ArrayDeque<>();
        for (int i = 0; i < pages.size(); i++) {
            NewspaperPage page = pages.get(i);
            List<BlockStart> starts = page.getStarts() == null ? List.of() : page.getStarts();
            int depth = page.getDepth();
            if (depth < 0 || starts.size() > depth) {
                throw new InvalidPageDataException(describe(i, page) + ": depth " + depth + " with " + starts.size() + " block starts");
            }
            int continuing = depth - starts.size();
            if (continuing > open.size()) {
                throw new InvalidPageDataException(describe(i, page) + ": depth " + depth + " exceeds the enclosing blocks");
            }
            while (open.size() > continuing) {
                open.removeLast().setLastPage(i - 1);
            }
            for (BlockStart start : starts) {
                BlockNode parent = open.peekLast();
                BlockNode node = new BlockNode(start, open.size(), i, parent);
                if (parent == null) {
                    roots.add(node);
                } else {
                    parent.getChildren().add(node);
                }
                open.addLast(node);
            }
        }
        while (!open.isEmpty()) {
            open.removeLast().setLastPage(pages.size() - 1);
        }
        return roots;
    }

    public static List<BlockNode> flatten(List<BlockNode> roots) {
        List<BlockNode> result = new ArrayList<>();
        for (BlockNode node : roots) {
            result.add(node);
            result.addAll(flatten(node.getChildren()));
        }
        return result;
    }

    private static String describe(int index, NewspaperPage page) {
        return "Page " + (index + 1) + " (" + page.getFilename() + ")";
    }
}
