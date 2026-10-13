package de.intranda.goobi.plugins.newspaperRecognizer.ruleset;

import static java.util.stream.Collectors.toSet;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.Before;
import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;

public class RulesetTypesTest {
    private RulesetTypes ruleset;

    @Before
    public void setUp() {
        ruleset = TestDocuments.ruleset();
    }

    @Test
    public void allowedChildren_inRulesetOrder() {
        assertEquals(List.of("MorningIssue", "EveningIssue", "ExtraEdition", "TableOfContents"), ruleset.allowedChildren("NewspaperVolume"));
    }

    @Test
    public void allowedChildren_noneUnknownOrNull_empty() {
        assertEquals(List.of(), ruleset.allowedChildren("TableOfContents"));
        assertEquals(List.of(), ruleset.allowedChildren("Unknown"));
        assertEquals(List.of(), ruleset.allowedChildren(null));
    }

    @Test
    public void isAllowedChild_followsRuleset() {
        assertTrue(ruleset.isAllowedChild("MorningIssue", "NewspaperSupplement"));
        assertFalse(ruleset.isAllowedChild("EveningIssue", "TableOfContents"));
        assertFalse(ruleset.isAllowedChild("MorningIssue", null));
    }

    @Test
    public void label_inLanguage_fallsBackToInternalName() {
        assertEquals("Morgenausgabe", ruleset.label("MorningIssue", "de"));
        assertEquals("Morning issue", ruleset.label("MorningIssue", "en"));
        assertEquals("MorningIssue", ruleset.label("MorningIssue", "it"));
        assertEquals("Unknown", ruleset.label("Unknown", "de"));
    }

    @Test
    public void allLabels_coverEveryLanguage() {
        assertEquals(Set.of("Morgenausgabe", "Morning issue", "Edition"), ruleset.allLabels("MorningIssue"));
    }

    @Test
    public void cardinality_presentOnlyWhenAllowed() {
        assertEquals(Optional.of("1m"), ruleset.cardinality("MorningIssue", "DateIssued"));
        assertEquals(Optional.empty(), ruleset.cardinality("TableOfContents", "DateIssued"));
        assertEquals(Optional.empty(), ruleset.cardinality("MorningIssue", "Unknown"));
    }

    @Test
    public void required_for1mAndPlus() {
        assertTrue(ruleset.isRequired("MorningIssue", "DateIssued"));
        assertFalse(ruleset.isRequired("EveningIssue", "DateIssued"));
        assertTrue(ruleset.isRequired("ExtraEdition", "CurrentNo"));
        assertTrue(ruleset.isRequired("Article", "TitleDocMain"));
    }

    @Test
    public void datedNumberedPartNumbered_followConfiguredFields() {
        assertTrue(ruleset.isDated("MorningIssue"));
        assertTrue(ruleset.isDated("EveningIssue"));
        assertFalse(ruleset.isDated("ExtraEdition"));
        assertTrue(ruleset.isNumbered("ExtraEdition"));
        assertFalse(ruleset.isPartNumbered("ExtraEdition"));
        assertTrue(ruleset.isPartNumbered("MorningIssue"));
        assertFalse(ruleset.isDated("TableOfContents"));
        assertFalse(ruleset.isNumbered("TableOfContents"));
    }

    @Test
    public void noFieldsConfigured_nothingDatedOrNumbered() {
        RulesetTypes bare = new RulesetTypes(TestDocuments.prefs(), new FieldConfiguration(null, "dd.MM.yyyy", "yyyy-MM-dd", null, null));
        assertFalse(bare.isDated("MorningIssue"));
        assertFalse(bare.isNumbered("MorningIssue"));
        assertFalse(bare.isPartNumbered("MorningIssue"));
    }

    @Test
    public void info_describesTypeForFrontend() {
        TypeInfo info = ruleset.info("MorningIssue", "en");
        assertEquals("MorningIssue", info.name());
        assertEquals("Morning issue", info.label());
        assertTrue(info.dated());
        assertTrue(info.dateRequired());
        assertTrue(info.numbered());
        assertFalse(info.numberRequired());
        assertTrue(info.partNumbered());
        assertEquals(List.of("NewspaperSupplement", "TableOfContents"), info.children());
        assertTrue(info.allowedMetadata().contains("Note"));
        assertFalse(info.allowedMetadata().contains("physPageNumber"));
    }

    @Test
    public void catalog_containsEveryType() {
        assertEquals(Set.of("BoundBook", "page", "Newspaper", "NewspaperVolume", "MorningIssue", "EveningIssue", "ExtraEdition",
                "NewspaperSupplement", "TableOfContents", "Article"),
                ruleset.catalog("de").stream().map(TypeInfo::name).collect(toSet()));
    }

    @Test
    public void info_generatorLabel_isTheGermanLabelUsedForTheLabelPlaceholder() {
        assertEquals("Morgenausgabe", ruleset.info("MorningIssue", "en").generatorLabel());
        assertEquals(List.of(), ruleset.info("MorningIssue", "en").fields());
    }
}
