package de.intranda.goobi.plugins.newspaperRecognizer.config;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.commons.configuration.XMLConfiguration;
import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;

public class PaginationConfigurationTest {

    private static XMLConfiguration load(String body) throws ConfigurationException {
        XMLConfiguration config = new XMLConfiguration();
        config.setDelimiterParsingDisabled(true);
        config.load(new StringReader("<config_plugin>" + body + "</config_plugin>"));
        return config;
    }

    private static PaginationConfiguration parse(String body, List<String> errors) throws ConfigurationException {
        return PaginationConfiguration.parse(load(body), errors);
    }

    private static PaginationConfiguration parse(String body) throws ConfigurationException {
        return parse(body, new ArrayList<>());
    }

    @Test
    public void parse_missingElement_allDefaults() throws Exception {
        List<String> errors = new ArrayList<>();
        PaginationConfiguration config = parse("", errors);
        assertTrue(config.enabled());
        assertTrue(config.automatic());
        assertEquals(List.of("–"), config.withoutBlock());
        assertTrue(config.rules().isEmpty());
        assertTrue(errors.isEmpty());
        assertEquals(PaginationConfiguration.defaults(), config);
    }

    @Test
    public void parse_countThroughVolume_defaultFalse() throws Exception {
        assertFalse(parse("<pagination/>").countThroughVolume());
    }

    @Test
    public void parse_countThroughVolume_true() throws Exception {
        assertTrue(parse("<pagination countThroughVolume=\"true\"/>").countThroughVolume());
    }

    @Test
    public void parse_rules_splitBeginsWithOnWhitespace() throws Exception {
        PaginationConfiguration config = parse("""
                <pagination>
                    <rule docstruct="X" beginsWith=" – 1 " />
                    <rule docstruct="Y" beginsWith="i" continueInParent="true" />
                </pagination>
                """);
        assertEquals(List.of("–", "1"), config.rules().get("X").beginsWith());
        assertFalse(config.rules().get("X").continueInParent());
        assertEquals(List.of("i"), config.rules().get("Y").beginsWith());
        assertTrue(config.rules().get("Y").continueInParent());
    }

    @Test
    public void parse_withoutBlockAndFlags() throws Exception {
        PaginationConfiguration config = parse("""
                <pagination enabled="false" automatic="false">
                    <withoutBlock beginsWith="[1]" />
                </pagination>
                """);
        assertFalse(config.enabled());
        assertFalse(config.automatic());
        assertEquals(List.of("[1]"), config.withoutBlock());
    }

    @Test
    public void parse_duplicateRule_error() throws Exception {
        List<String> errors = new ArrayList<>();
        parse("""
                <pagination>
                    <rule docstruct="X" beginsWith="1" />
                    <rule docstruct="X" beginsWith="i" />
                </pagination>
                """, errors);
        assertEquals(1, errors.size());
        assertTrue(errors.get(0), errors.get(0).contains("Duplicate <rule docstruct=\"X\">"));
    }

    @Test
    public void parse_emptyBeginsWith_error() throws Exception {
        List<String> errors = new ArrayList<>();
        parse("<pagination><rule docstruct=\"X\" beginsWith=\"  \" /></pagination>", errors);
        assertEquals(1, errors.size());
        assertTrue(errors.get(0), errors.get(0).contains("beginsWith"));
    }

    @Test
    public void parse_removedElements_errorPointsToUpdateNotes() throws Exception {
        for (String element : List.of("<createNewPagination>true</createNewPagination>", "<type>1</type>",
                "<useFakePagination>false</useFakePagination>")) {
            List<String> errors = new ArrayList<>();
            parse("<pagination>" + element + "</pagination>", errors);
            assertEquals(element, 1, errors.size());
            assertTrue(errors.get(0), errors.get(0).contains("no longer supported"));
            assertTrue(errors.get(0), errors.get(0).contains("update notes"));
        }
    }

    @Test
    public void parse_removedElementEmptyForm_error() throws Exception {
        List<String> errors = new ArrayList<>();
        parse("<pagination><useFakePagination/></pagination>", errors);
        assertEquals(1, errors.size());
        assertTrue(errors.get(0), errors.get(0).contains("no longer supported"));
    }

    @Test
    public void validate_unknownDocstruct_error() throws Exception {
        PaginationConfiguration config = parse("<pagination><rule docstruct=\"Nope\" beginsWith=\"1\" /></pagination>");
        List<String> errors = config.validate(TestDocuments.ruleset());
        assertEquals(1, errors.size());
        assertTrue(errors.get(0), errors.get(0).contains("Unknown structure type \"Nope\" in <rule>"));
    }
}
