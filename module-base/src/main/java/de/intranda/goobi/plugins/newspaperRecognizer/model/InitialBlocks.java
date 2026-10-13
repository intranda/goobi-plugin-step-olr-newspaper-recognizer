package de.intranda.goobi.plugins.newspaperRecognizer.model;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;

/** Blocks for a volume without logical structure: the first page and every page the analysis marks start an untyped block. */
public final class InitialBlocks {

    private InitialBlocks() {
    }

    public static List<NewspaperPage> fromAnalysis(List<String> filenames, Map<String, Double> results) {
        List<NewspaperPage> pages = new ArrayList<>();
        for (int i = 0; i < filenames.size(); i++) {
            NewspaperPage page = new NewspaperPage();
            page.setFilename(filenames.get(i));
            page.setResult(results.getOrDefault(filenames.get(i), 0.0));
            page.setDepth(1);
            if (i == 0 || page.analysisIndicatesThisIsAnIssue()) {
                page.getStarts().add(new BlockStart());
            }
            pages.add(page);
        }
        return pages;
    }
}
