package de.intranda.goobi.plugins.newspaperRecognizer;

import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPageMetadata;
import org.junit.Test;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

public class DuplicateIssueValidatorTest {

    private NewspaperPage createPage(String issueTypeName, String dateStr) {
        NewspaperPage page = new NewspaperPage();
        page.setIssueTypeName(issueTypeName);
        page.setMetadata(new NewspaperPageMetadata(dateStr, null, null, null));
        return page;
    }

    @Test
    public void noDuplicates_distinctTypeDateCombinations() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "02.01.2025"),
                createPage("IssueB", "01.01.2025")
        );

        Map<String, List<NewspaperPage>> result = DuplicateIssueValidator.findDuplicates(pages);
        assertTrue(result.isEmpty());
        assertFalse(DuplicateIssueValidator.hasDuplicates(pages));
    }

    @Test
    public void duplicateDetected_sameTypeAndDate() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "02.01.2025")
        );

        Map<String, List<NewspaperPage>> result = DuplicateIssueValidator.findDuplicates(pages);
        assertEquals(1, result.size());
        assertTrue(result.containsKey("IssueA|01.01.2025"));
        assertEquals(2, result.get("IssueA|01.01.2025").size());
        assertTrue(DuplicateIssueValidator.hasDuplicates(pages));
    }

    @Test
    public void sameTypeDifferentDates_noDuplicates() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "02.01.2025")
        );

        assertFalse(DuplicateIssueValidator.hasDuplicates(pages));
    }

    @Test
    public void sameDateDifferentTypes_noDuplicates() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueB", "01.01.2025")
        );

        assertFalse(DuplicateIssueValidator.hasDuplicates(pages));
    }

    @Test
    public void emptyDateExcludedFromCheck() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", ""),
                createPage("IssueA", ""),
                createPage("IssueA", null)
        );

        assertFalse(DuplicateIssueValidator.hasDuplicates(pages));
    }

    @Test
    public void nullIssueTypeNameExcludedFromCheck() {
        NewspaperPage page1 = createPage(null, "01.01.2025");
        NewspaperPage page2 = createPage(null, "01.01.2025");
        NewspaperPage page3 = createPage("", "01.01.2025");

        List<NewspaperPage> pages = List.of(page1, page2, page3);
        assertFalse(DuplicateIssueValidator.hasDuplicates(pages));
    }

    @Test
    public void multipleDuplicateGroups() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "01.01.2025"),
                createPage("IssueB", "03.01.2025"),
                createPage("IssueB", "03.01.2025")
        );

        Map<String, List<NewspaperPage>> result = DuplicateIssueValidator.findDuplicates(pages);
        assertEquals(2, result.size());
        assertTrue(result.containsKey("IssueA|01.01.2025"));
        assertTrue(result.containsKey("IssueB|03.01.2025"));
    }

    @Test
    public void emptyPageList_noDuplicates() {
        assertFalse(DuplicateIssueValidator.hasDuplicates(Collections.emptyList()));
        assertTrue(DuplicateIssueValidator.findDuplicates(Collections.emptyList()).isEmpty());
    }

    @Test
    public void hasDuplicates_returnsBooleanCorrectly() {
        List<NewspaperPage> noDups = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "02.01.2025")
        );
        assertFalse(DuplicateIssueValidator.hasDuplicates(noDups));

        List<NewspaperPage> withDups = List.of(
                createPage("IssueA", "01.01.2025"),
                createPage("IssueA", "01.01.2025")
        );
        assertTrue(DuplicateIssueValidator.hasDuplicates(withDups));
    }

    @Test
    public void pageWithNullMetadata_excluded() {
        NewspaperPage page1 = new NewspaperPage();
        page1.setIssueTypeName("IssueA");
        // metadata is null by default

        NewspaperPage page2 = createPage("IssueA", "01.01.2025");

        List<NewspaperPage> pages = new ArrayList<>();
        pages.add(page1);
        pages.add(page2);

        assertFalse(DuplicateIssueValidator.hasDuplicates(pages));
    }

    // --- Supplement duplicate tests ---

    private NewspaperPage createSupplementPage(String supplementTypeName) {
        NewspaperPage page = new NewspaperPage();
        page.setSupplementTypeName(supplementTypeName);
        return page;
    }

    @Test
    public void noDuplicateSupplements_distinctTypes() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createSupplementPage("Kultur"),
                createSupplementPage("Sport")
        );

        assertTrue(DuplicateIssueValidator.findDuplicateSupplements(pages).isEmpty());
        assertFalse(DuplicateIssueValidator.hasDuplicateSupplements(pages));
    }

    @Test
    public void duplicateSupplementDetected_sameTypeInSameIssue() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createSupplementPage("Kultur"),
                createSupplementPage("Kultur")
        );

        Map<String, List<NewspaperPage>> result = DuplicateIssueValidator.findDuplicateSupplements(pages);
        assertEquals(1, result.size());
        assertTrue(result.containsKey("0|Kultur"));
        assertEquals(2, result.get("0|Kultur").size());
        assertTrue(DuplicateIssueValidator.hasDuplicateSupplements(pages));
    }

    @Test
    public void sameSupplementTypeInDifferentIssues_noDuplicate() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                createSupplementPage("Kultur"),
                createPage("IssueA", "02.01.2025"),
                createSupplementPage("Kultur")
        );

        assertTrue(DuplicateIssueValidator.findDuplicateSupplements(pages).isEmpty());
        assertFalse(DuplicateIssueValidator.hasDuplicateSupplements(pages));
    }

    @Test
    public void noSupplementHeadPages_noDuplicate() {
        List<NewspaperPage> pages = List.of(
                createPage("IssueA", "01.01.2025"),
                new NewspaperPage()
        );

        assertTrue(DuplicateIssueValidator.findDuplicateSupplements(pages).isEmpty());
    }

    @Test
    public void hasDuplicateSupplements_returnsBooleanCorrectly() {
        List<NewspaperPage> noDups = List.of(
                createPage("IssueA", "01.01.2025"),
                createSupplementPage("Kultur"),
                createSupplementPage("Sport")
        );
        assertFalse(DuplicateIssueValidator.hasDuplicateSupplements(noDups));

        List<NewspaperPage> withDups = List.of(
                createPage("IssueA", "01.01.2025"),
                createSupplementPage("Kultur"),
                createSupplementPage("Kultur")
        );
        assertTrue(DuplicateIssueValidator.hasDuplicateSupplements(withDups));
    }

    @Test
    public void supplementBeforeAnyIssue_excluded() {
        List<NewspaperPage> pages = List.of(
                createSupplementPage("Kultur"),
                createSupplementPage("Kultur"),
                createPage("IssueA", "01.01.2025")
        );

        assertTrue(DuplicateIssueValidator.findDuplicateSupplements(pages).isEmpty());
        assertFalse(DuplicateIssueValidator.hasDuplicateSupplements(pages));
    }

    @Test
    public void emptyPageList_noDuplicateSupplements() {
        assertFalse(DuplicateIssueValidator.hasDuplicateSupplements(Collections.emptyList()));
        assertTrue(DuplicateIssueValidator.findDuplicateSupplements(Collections.emptyList()).isEmpty());
    }
}
