package de.intranda.goobi.plugins.newspaperRecognizer.config;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.StringReader;
import java.util.List;
import java.util.Set;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.commons.configuration.XMLConfiguration;
import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;

public class PluginConfigurationTest {
    private static final String FIELDS = """
            <fields>
                <date metadata="DateIssued" format="dd.MM.yyyy" storeFormat="yyyy-MM-dd" />
                <number metadata="CurrentNo" partMetadata="PartNumber" />
            </fields>
            """;

    private static PluginConfiguration parse(String body) throws ConfigurationException {
        XMLConfiguration config = new XMLConfiguration();
        config.setDelimiterParsingDisabled(true);
        config.load(new StringReader("<config_plugin>" + body + "</config_plugin>"));
        return PluginConfiguration.parse(config);
    }

    private static List<String> validate(String body) throws ConfigurationException {
        return parse(body).validate(TestDocuments.ruleset(), "NewspaperVolume");
    }

    @Test
    public void parse_emptyConfig_usesDefaults() throws Exception {
        PluginConfiguration config = parse("");
        assertTrue(config.loadAllImages());
        assertFalse(config.showDeletePageButton());
        assertFalse(config.preventDuplicates());
        assertTrue(config.pagination().createNewPagination());
        assertEquals("1", config.pagination().type());
        assertFalse(config.pagination().useFakePagination());
        assertEquals(new FieldConfiguration(null, "dd.MM.yyyy", "yyyy-MM-dd", null, null), config.fields());
        assertTrue(config.templates().isEmpty());
    }

    @Test
    public void parse_readsFieldsAndOptions() throws Exception {
        PluginConfiguration config = parse("<preventDuplicates>true</preventDuplicates>"
                + "<pagination><createNewPagination>false</createNewPagination><type>i</type></pagination>" + FIELDS);
        assertTrue(config.preventDuplicates());
        assertFalse(config.pagination().createNewPagination());
        assertEquals("i", config.pagination().type());
        assertEquals(TestDocuments.FIELDS, config.fields());
    }

    @Test
    public void parse_templatesKeepOrderCommasAndSkipIfEmpty() throws Exception {
        PluginConfiguration config = parse("""
                <generate docstruct="MorningIssue">
                    <metadata key="CurrentNoSorting" value="{no}" skipIfEmpty="true" />
                    <metadata key="TitleDocMain" value="Morgenausgabe {partNo}, {date:dd.MM.yyyy}" />
                </generate>
                """);
        assertEquals(List.of(new MetadataTemplate("CurrentNoSorting", "{no}", true),
                new MetadataTemplate("TitleDocMain", "Morgenausgabe {partNo}, {date:dd.MM.yyyy}", false)),
                config.templatesFor("MorningIssue"));
        assertEquals(List.of(), config.templatesFor("EveningIssue"));
    }

    @Test
    public void managedMetadata_fieldsThenTemplateKeys() throws Exception {
        PluginConfiguration config = parse(FIELDS + "<generate docstruct=\"MorningIssue\"><metadata key=\"TitleDocMain\" value=\"x\" /></generate>");
        assertEquals(List.of("DateIssued", "CurrentNo", "PartNumber", "TitleDocMain"), List.copyOf(config.managedMetadata("MorningIssue")));
        assertEquals(Set.of("DateIssued", "CurrentNo", "PartNumber"), config.managedMetadata("EveningIssue"));
    }

    @Test
    public void managedMetadataForType_onlyFieldsTheTypeAllows() throws Exception {
        PluginConfiguration config = parse(FIELDS + "<generate docstruct=\"ExtraEdition\"><metadata key=\"TitleDocMain\" value=\"x\" /></generate>");
        assertEquals(List.of("CurrentNo", "TitleDocMain"), List.copyOf(config.managedMetadata("ExtraEdition", TestDocuments.ruleset())));
        assertEquals(Set.of(), config.managedMetadata("TableOfContents", TestDocuments.ruleset()));
    }

    @Test
    public void validate_validConfig_noErrors() throws Exception {
        assertEquals(List.of(), validate(FIELDS + "<generate docstruct=\"MorningIssue\"><metadata key=\"TitleDocMain\" value=\"x\" /></generate>"));
    }

    @Test
    public void validate_duplicateGenerate() throws Exception {
        assertEquals(List.of("Duplicate <generate docstruct=\"MorningIssue\">"),
                validate(FIELDS + "<generate docstruct=\"MorningIssue\" /><generate docstruct=\"MorningIssue\" />"));
    }

    @Test
    public void validate_unknownGenerateType() throws Exception {
        assertEquals(List.of("Unknown structure type \"Unknown\" in <generate>"), validate(FIELDS + "<generate docstruct=\"Unknown\" />"));
    }

    @Test
    public void validate_metadataNotAllowedForType() throws Exception {
        assertEquals(List.of("Metadata \"Note\" is not allowed for structure type \"EveningIssue\" in <generate>"),
                validate(FIELDS + "<generate docstruct=\"EveningIssue\"><metadata key=\"Note\" value=\"x\" /></generate>"));
    }

    @Test
    public void validate_templateKeyAlreadyWrittenByFields() throws Exception {
        assertEquals(List.of("Metadata \"CurrentNo\" in <generate docstruct=\"MorningIssue\"> is already written by <fields>"),
                validate(FIELDS + "<generate docstruct=\"MorningIssue\"><metadata key=\"CurrentNo\" value=\"{no}\" /></generate>"));
    }

    @Test
    public void validate_unknownFieldMetadata() throws Exception {
        assertEquals(List.of("Unknown metadata \"Datum\" in <fields>"), validate("<fields><date metadata=\"Datum\" /></fields>"));
    }

    @Test
    public void validate_invalidDatePatterns() throws Exception {
        assertEquals(List.of("Invalid date pattern \"{\" in <fields><date format>", "Invalid date pattern \"{\" in <fields><date storeFormat>"),
                validate("<fields><date metadata=\"DateIssued\" format=\"{\" storeFormat=\"{\" /></fields>"));
    }

    @Test
    public void validate_partMetadataWithoutNumberMetadata() throws Exception {
        assertEquals(List.of("<number partMetadata> requires <number metadata>"), validate("<fields><number partMetadata=\"PartNumber\" /></fields>"));
    }

    @Test
    public void validate_volumeTypeWithoutChildren() throws Exception {
        assertEquals(List.of("Structure type \"TableOfContents\" allows no child types"),
                parse(FIELDS).validate(TestDocuments.ruleset(), "TableOfContents"));
    }
}
