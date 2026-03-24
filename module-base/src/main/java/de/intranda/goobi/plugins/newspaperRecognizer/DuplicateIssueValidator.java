package de.intranda.goobi.plugins.newspaperRecognizer;

import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import org.apache.commons.lang3.StringUtils;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

public class DuplicateIssueValidator {

    private DuplicateIssueValidator() {
    }

    /**
     * Find duplicate issues: pages that share the same issue type name and date string.
     * Pages with blank issue type or blank date are excluded from the check.
     *
     * @param pages list of newspaper pages to check
     * @return map where key is "issueTypeName|dateStr" and value is the list of duplicate pages (size >= 2)
     */
    public static Map<String, List<NewspaperPage>> findDuplicates(List<NewspaperPage> pages) {
        return pages.stream()
                .filter(p -> StringUtils.isNotBlank(p.getIssueTypeName()))
                .filter(p -> p.getMetadata() != null && StringUtils.isNotBlank(p.getMetadata().dateStr()))
                .collect(Collectors.groupingBy(p -> p.getIssueTypeName() + "|" + p.getMetadata().dateStr()))
                .entrySet()
                .stream()
                .filter(e -> e.getValue().size() >= 2)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /**
     * Check whether any duplicate issues exist.
     *
     * @param pages list of newspaper pages to check
     * @return true if at least one pair of pages shares the same issue type and date
     */
    public static boolean hasDuplicates(List<NewspaperPage> pages) {
        return !findDuplicates(pages).isEmpty();
    }
}
