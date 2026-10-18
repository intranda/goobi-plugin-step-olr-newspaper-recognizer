package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.HashMap;
import java.util.Map;

import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;

/** The page labels (logicalPageNumber) of the physical pages, by image name. */
public final class PageLabels {
    public static final String TYPE = "logicalPageNumber";
    public static final String UNCOUNTED = "–";

    private PageLabels() {
    }

    public static Map<String, String> read(DigitalDocument dd) {
        Map<String, String> result = new HashMap<>();
        for (DocStruct page : PageIndex.children(dd.getPhysicalDocStruct())) {
            if (page.getImageName() != null) {
                result.putIfAbsent(page.getImageName(), normalize(MetadataAccess.firstValue(page, TYPE)));
            }
        }
        return result;
    }

    /** Trims, unifies the uncounted spellings and removes the blanks inside square brackets. */
    public static String normalize(String label) {
        if (label == null) {
            return "";
        }
        String trimmed = label.trim();
        if ("uncounted".equals(trimmed) || "-".equals(trimmed) || UNCOUNTED.equals(trimmed)) {
            return UNCOUNTED;
        }
        if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
            return "[" + trimmed.substring(1, trimmed.length() - 1).trim() + "]";
        }
        return trimmed;
    }
}
