package de.intranda.goobi.plugins.newspaperRecognizer.validation;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.page;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.start;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import java.util.List;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.SaveResult;
import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;

public class BlockValidatorTest {

    private static BlockStart block(String type, String date, String number) {
        BlockStart start = start(null, type);
        start.setDate(date);
        start.setNumber(number);
        return start;
    }

    private static ValidationReport validate(boolean preventDuplicates, NewspaperPage... pages) throws Exception {
        return new BlockValidator(TestDocuments.ruleset(), "NewspaperVolume", preventDuplicates).validate(BlockTree.build(List.of(pages)));
    }

    @Test
    public void validBlocks_success() throws Exception {
        ValidationReport report = validate(true, page("1", 1, block("MorningIssue", "1890-03-01", "1")), page("2", 1, block("EveningIssue", "1890-03-01", "1")),
                page("3", 1, block("TableOfContents", null, null)));
        assertTrue(report.isValid());
        assertEquals(SaveResult.SUCCESS, report.result());
    }

    @Test
    public void untypedBlock_missingType() throws Exception {
        ValidationReport report = validate(false, page("1", 1, block(null, null, null)));
        assertEquals(List.of("Block on page 1 (level 0)"), report.getMissingType());
        assertEquals(SaveResult.MISSING_TYPE, report.result());
        assertEquals("plugin_newspaperRecognizer_save_missingType", report.messageKey());
    }

    @Test
    public void typeNotAllowedBelowParent_invalidData() throws Exception {
        ValidationReport report = validate(false, page("1", 2, block("EveningIssue", null, null), block("TableOfContents", null, null)));
        assertEquals(List.of("Block on page 1 (level 1)"), report.getNotAllowed());
        assertEquals(SaveResult.INVALID_DATA, report.result());
    }

    @Test
    public void unparsedDate_invalidData() throws Exception {
        BlockStart start = block("MorningIssue", null, null);
        start.setDateRaw("1890");
        ValidationReport report = validate(false, page("1", 1, start));
        assertEquals(List.of("Block on page 1 (level 0)"), report.getInvalidDates());
        assertEquals(SaveResult.INVALID_DATA, report.result());
    }

    @Test
    public void requiredDateMissing_onlyWhereRequired() throws Exception {
        ValidationReport report = validate(false, page("1", 1, block("MorningIssue", null, "1")), page("2", 1, block("EveningIssue", null, "1")));
        assertEquals(List.of("Block on page 1 (level 0)"), report.getMissingRequired());
        assertEquals(SaveResult.MISSING_REQUIRED, report.result());
    }

    @Test
    public void requiredNumberMissing() throws Exception {
        ValidationReport report = validate(false, page("1", 1, block("ExtraEdition", null, " ")));
        assertEquals(List.of("Block on page 1 (level 0)"), report.getMissingRequired());
    }

    @Test
    public void duplicates_sameTypeDateNumberAmongSiblings() throws Exception {
        ValidationReport report = validate(true, page("1", 1, block("MorningIssue", "1890-03-01", "1")), page("2", 1, block("MorningIssue", "1890-03-01", "1")));
        assertEquals(List.of("Block on page 1 (level 0)", "Block on page 2 (level 0)"), report.getDuplicates());
        assertEquals(SaveResult.DUPLICATES, report.result());
    }

    @Test
    public void duplicates_ignoredWhenNotPrevented() throws Exception {
        assertTrue(validate(false, page("1", 1, block("MorningIssue", "1890-03-01", "1")), page("2", 1, block("MorningIssue", "1890-03-01", "1"))).isValid());
    }

    @Test
    public void duplicates_notAcrossParents_notWithoutValues() throws Exception {
        assertTrue(validate(true,
                page("1", 2, block("MorningIssue", "1890-03-01", "1"), block("TableOfContents", null, null)),
                page("2", 2, block("TableOfContents", null, null)),
                page("3", 2, block("MorningIssue", "1890-03-02", "2"), block("NewspaperSupplement", null, null)),
                page("4", 1, block("EveningIssue", "1890-03-02", "2")),
                page("5", 2, block("NewspaperSupplement", null, null))).isValid());
    }

    @Test
    public void missingType_winsOverOtherProblems() throws Exception {
        ValidationReport report = validate(true, page("1", 1, block(null, null, null)), page("2", 1, block("MorningIssue", null, null)));
        assertEquals(SaveResult.MISSING_TYPE, report.result());
        assertEquals(List.of("Missing type: Block on page 1 (level 0)", "Missing required value: Block on page 2 (level 0)"), report.details());
    }
}
