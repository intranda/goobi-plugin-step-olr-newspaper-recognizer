package de.intranda.goobi.plugins.newspaperRecognizer;

import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
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

    /**
     * Find duplicate supplements within issues: supplement head pages that share
     * the same supplementTypeName within the same issue.
     * An "issue" is defined as a page with issueTypeName set, plus all following
     * pages until the next issue page.
     *
     * @param pages list of newspaper pages to check
     * @return map where key is "issueIndex|supplementTypeName" and value is the
     *         list of duplicate supplement head pages (size >= 2)
     */
    public static Map<String, List<NewspaperPage>> findDuplicateSupplements(List<NewspaperPage> pages) {
        int currentIssueIndex = -1;
        Map<String, List<NewspaperPage>> groups = new LinkedHashMap<>();

        for (int i = 0; i < pages.size(); i++) {
            NewspaperPage page = pages.get(i);
            if (StringUtils.isNotBlank(page.getIssueTypeName())) {
                currentIssueIndex = i;
            }
            if (currentIssueIndex >= 0 && StringUtils.isNotBlank(page.getSupplementTypeName())) {
                String key = currentIssueIndex + "|" + page.getSupplementTypeName();
                groups.computeIfAbsent(key, k -> new ArrayList<>()).add(page);
            }
        }

        return groups.entrySet()
                .stream()
                .filter(e -> e.getValue().size() >= 2)
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    /**
     * Check whether any duplicate supplements exist within any issue.
     *
     * @param pages list of newspaper pages to check
     * @return true if at least one issue contains two supplement head pages with the same type
     */
    public static boolean hasDuplicateSupplements(List<NewspaperPage> pages) {
        return !findDuplicateSupplements(pages).isEmpty();
    }
}
