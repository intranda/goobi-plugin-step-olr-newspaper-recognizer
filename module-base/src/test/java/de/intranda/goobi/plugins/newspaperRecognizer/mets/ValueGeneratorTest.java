package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.page;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.start;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.List;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.config.MetadataTemplate;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;

public class ValueGeneratorTest {
    private final ValueGenerator generator = new ValueGenerator(TestDocuments.ruleset());

    private static BlockStart issue(String type, String date, String prefix, String number, String suffix) {
        BlockStart start = start("b1", type);
        start.setDate(date);
        start.setPrefix(prefix);
        start.setNumber(number);
        start.setSuffix(suffix);
        return start;
    }

    /** A level-0 block of the given start and, if {@code child} is not null, one child block. Returns the innermost block. */
    private static BlockNode block(BlockStart parent, BlockStart child) throws Exception {
        List<BlockNode> roots = child == null
                ? BlockTree.build(List.of(page("1", 1, parent)))
                : BlockTree.build(List.of(page("1", 1, parent), page("2", 2, child)));
        return child == null ? roots.get(0) : roots.get(0).getChildren().get(0);
    }

    private String generate(BlockNode block, String value, boolean skipIfEmpty) {
        return generator.generate(new MetadataTemplate("TitleDocMain", value, skipIfEmpty), block).orElse(null);
    }

    @Test
    public void constantText_unchanged() throws Exception {
        assertEquals("Inhaltsverzeichnis", generate(block(start("b1", "TableOfContents"), null), "Inhaltsverzeichnis", false));
    }

    @Test
    public void ownDateAndNumber() throws Exception {
        BlockNode block = block(issue("MorningIssue", "1890-03-01", null, "12", null), null);
        assertEquals("Morgenausgabe 12 vom 01.03.1890", generate(block, "Morgenausgabe {no} vom {date:dd.MM.yyyy}", false));
    }

    @Test
    public void partNumber_prefixNumberSuffix() throws Exception {
        BlockNode block = block(issue("MorningIssue", null, "Nr. ", "12", "a"), null);
        assertEquals("Nr. 12a", generate(block, "{partNo}", false));
    }

    @Test
    public void child_takesDateAndNumberFromParent() throws Exception {
        BlockNode supplement = block(issue("MorningIssue", "1890-03-01", null, "12", null), start("b2", "NewspaperSupplement"));
        assertEquals("Beilage zur 12. Ausgabe vom 01.03.1890", generate(supplement, "Beilage zur {no}. Ausgabe vom {date:dd.MM.yyyy}", false));
    }

    @Test
    public void parentPlaceholders_lookOnlyAtDirectParent() throws Exception {
        BlockNode toc = block(issue("MorningIssue", "1890-03-01", null, "12", null), start("b2", "TableOfContents"));
        assertEquals("12 Morgenausgabe", generate(toc, "{parent.no} {parent.label}", false));
        BlockNode issue = block(issue("MorningIssue", "1890-03-01", null, "12", null), null);
        assertEquals("[MISSING]", generate(issue, "{parent.no}", false));
    }

    @Test
    public void label_inMetadataLanguage() throws Exception {
        assertEquals("Abendausgabe", generate(block(start("b1", "EveningIssue"), null), "{label}", false));
    }

    @Test
    public void missingValue_withoutSkip_isMarked() throws Exception {
        assertEquals("Nr. [MISSING]", generate(block(start("b1", "MorningIssue"), null), "Nr. {no}", false));
    }

    @Test
    public void missingValue_withSkip_writesNothing() throws Exception {
        assertNull(generate(block(start("b1", "MorningIssue"), null), "{no}", true));
    }

    @Test
    public void valuesOfTypeWithoutField_areIgnored() throws Exception {
        BlockStart toc = start("b1", "TableOfContents");
        toc.setNumber("5");
        toc.setDate("1890-03-01");
        assertEquals("[MISSING] [MISSING]", generate(block(toc, null), "{no} {date:yyyy}", false));
    }

    @Test
    public void invalidDatePattern_treatedAsMissing() throws Exception {
        assertEquals("[MISSING]", generate(block(issue("MorningIssue", "1890-03-01", null, null, null), null), "{date:ppp}", false));
    }

    @Test
    public void partNumber_nullWithoutNumber() {
        assertNull(ValueGenerator.partNumber(issue("MorningIssue", null, "Nr. ", " ", "a")));
    }
}
