package de.intranda.goobi.plugins.newspaperRecognizer.config;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.io.File;
import java.io.StringReader;
import java.util.List;

import org.apache.commons.configuration.ConfigurationException;
import org.apache.commons.configuration.XMLConfiguration;
import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;

public class PluginConfigurationTest {
    private static final String ROLES = """
            <field key="DateIssued" role="date" format="dd.MM.yyyy" storeFormat="yyyy-MM-dd" />
            <field key="CurrentNo" role="number" partKey="PartNumber" />
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

    private static List<String> keys(List<FieldDefinition> fields) {
        return fields.stream().map(FieldDefinition::key).toList();
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
        assertEquals(List.of(), config.defaults());
        assertTrue(config.types().isEmpty());
    }

    @Test
    public void parse_roleFields_becomeTheFieldConfiguration() throws Exception {
        PluginConfiguration config = parse("<preventDuplicates>true</preventDuplicates>"
                + "<pagination><createNewPagination>false</createNewPagination><type>i</type></pagination>"
                + "<defaults>" + ROLES + "</defaults>");
        assertTrue(config.preventDuplicates());
        assertFalse(config.pagination().createNewPagination());
        assertEquals("i", config.pagination().type());
        assertEquals(TestDocuments.FIELDS, config.fields());
        assertEquals(List.of(), config.defaults());
    }

    @Test
    public void parse_fieldAttributes_keepCommasHiddenAndSkipIfEmpty() throws Exception {
        PluginConfiguration config = parse("""
                <defaults>
                    <field key="TitleDocMain" value="Ausgabe {partNo}, {date:dd.MM.yyyy}" />
                    <field key="CurrentNoSorting" value="{no}" hidden="true" skipIfEmpty="true" />
                    <field key="Note" />
                </defaults>
                """);
        assertEquals(List.of(FieldDefinition.of("TitleDocMain", "Ausgabe {partNo}, {date:dd.MM.yyyy}", false, false),
                FieldDefinition.of("CurrentNoSorting", "{no}", true, true),
                FieldDefinition.of("Note", null, false, false)), config.defaults());
        assertTrue(config.defaults().get(0).hasPattern());
        assertFalse(config.defaults().get(2).hasPattern());
    }

    @Test
    public void fieldsFor_defaultsOrder_overridesInPlace_typeFieldsAtTheEnd() throws Exception {
        PluginConfiguration config = parse("""
                <defaults>
                    <field key="TitleDocMain" value="Ausgabe {partNo}" />
                    <field key="CurrentNoSorting" value="{no}" hidden="true" />
                </defaults>
                <type docstruct="MorningIssue">
                    <field key="Note" />
                    <field key="TitleDocMain" value="Morgenausgabe {partNo}" />
                </type>
                """);
        List<FieldDefinition> morning = config.fieldsFor("MorningIssue");
        assertEquals(List.of("TitleDocMain", "CurrentNoSorting", "Note"), keys(morning));
        assertEquals("Morgenausgabe {partNo}", morning.get(0).value());
        assertEquals("Ausgabe {partNo}", config.fieldsFor("EveningIssue").get(0).value());
    }

    @Test
    public void fieldsForWithRuleset_onlyMetadataTheTypeAllows() throws Exception {
        PluginConfiguration config = parse("""
                <defaults>
                    <field key="TitleDocMain" />
                    <field key="Note" />
                    <field key="CurrentNoSorting" value="{no}" hidden="true" />
                </defaults>
                """);
        assertEquals(List.of("TitleDocMain", "Note", "CurrentNoSorting"), keys(config.fieldsFor("MorningIssue", TestDocuments.ruleset())));
        assertEquals(List.of("TitleDocMain", "CurrentNoSorting"), keys(config.fieldsFor("EveningIssue", TestDocuments.ruleset())));
        assertEquals(List.of("TitleDocMain"), keys(config.fieldsFor("TableOfContents", TestDocuments.ruleset())));
        assertEquals(List.of("TitleDocMain", "Note"), keys(config.visibleFieldsFor("MorningIssue", TestDocuments.ruleset())));
    }

    @Test
    public void templatesFor_areTheHiddenGeneratedFields() throws Exception {
        PluginConfiguration config = parse("""
                <defaults>
                    <field key="TitleDocMain" value="Ausgabe {partNo}" />
                    <field key="CurrentNoSorting" value="{no}" hidden="true" skipIfEmpty="true" />
                </defaults>
                """);
        assertEquals(List.of(new MetadataTemplate("CurrentNoSorting", "{no}", true)), config.templatesFor("MorningIssue"));
    }

    @Test
    public void managedMetadata_roleMetadataThenFieldKeys() throws Exception {
        PluginConfiguration config = parse("<defaults>" + ROLES + "<field key=\"TitleDocMain\" /></defaults>"
                + "<type docstruct=\"MorningIssue\"><field key=\"Note\" /></type>");
        assertEquals(List.of("DateIssued", "CurrentNo", "PartNumber", "TitleDocMain", "Note"), List.copyOf(config.managedMetadata("MorningIssue")));
        assertEquals(List.of("CurrentNo", "TitleDocMain"), List.copyOf(config.managedMetadata("ExtraEdition", TestDocuments.ruleset())));
    }

    @Test
    public void validate_validConfig_noErrors() throws Exception {
        assertEquals(List.of(), validate("<defaults>" + ROLES + "<field key=\"TitleDocMain\" value=\"Ausgabe {partNo} vom {date:dd.MM.yyyy}\" />"
                + "<field key=\"CurrentNoSorting\" value=\"{no}\" hidden=\"true\" /></defaults>"
                + "<type docstruct=\"TableOfContents\"><field key=\"TitleDocMain\" /></type>"));
    }

    @Test
    public void validate_oldElements_pointToTheNewFormat() throws Exception {
        assertEquals(List.of("The elements <fields> and <generate> are no longer supported, use <defaults> and <type> with <field> (see the update notes)"),
                validate("<fields><date metadata=\"DateIssued\" /></fields><generate docstruct=\"MorningIssue\" />"));
    }

    @Test
    public void validate_roleFieldErrors() throws Exception {
        assertEquals(List.of("Role field \"DateIssued\" is only allowed in <defaults> (found in <type docstruct=\"MorningIssue\">)"),
                validate("<type docstruct=\"MorningIssue\"><field key=\"DateIssued\" role=\"date\" /></type>"));
        assertEquals(List.of("More than one field with role \"date\" in <defaults>"),
                validate("<defaults><field key=\"DateIssued\" role=\"date\" /><field key=\"Note\" role=\"date\" /></defaults>"));
        assertEquals(List.of("Unknown role \"title\" of field \"TitleDocMain\""), validate("<defaults><field key=\"TitleDocMain\" role=\"title\" /></defaults>"));
        assertEquals(List.of("Field \"CurrentNo\" is already the field with role \"number\""),
                validate("<defaults>" + ROLES + "<field key=\"CurrentNo\" value=\"{no}\" /></defaults>"));
    }

    @Test
    public void validate_fieldErrors() throws Exception {
        assertEquals(List.of("Field \"TitleDocMain\" is hidden but has no value pattern"),
                validate("<defaults><field key=\"TitleDocMain\" hidden=\"true\" /></defaults>"));
        assertEquals(List.of("<field> without key in <defaults>"), validate("<defaults><field value=\"x\" /></defaults>"));
        assertEquals(List.of("Duplicate field \"Note\" in <type docstruct=\"MorningIssue\">"),
                validate("<type docstruct=\"MorningIssue\"><field key=\"Note\" /><field key=\"Note\" /></type>"));
        assertEquals(List.of("Duplicate <type docstruct=\"MorningIssue\">"),
                validate("<type docstruct=\"MorningIssue\" /><type docstruct=\"MorningIssue\" />"));
    }

    @Test
    public void validate_rulesetErrors() throws Exception {
        assertEquals(List.of("Unknown structure type \"Unknown\" in <type>"), validate("<type docstruct=\"Unknown\" />"));
        assertEquals(List.of("Unknown metadata \"Datum\" in field"), validate("<defaults><field key=\"Datum\" /></defaults>"));
        assertEquals(List.of("Metadata \"physPageNumber\" is not allowed for any structure type of the volume"),
                validate("<defaults><field key=\"physPageNumber\" /></defaults>"));
        assertEquals(List.of("Metadata \"Note\" is not allowed for structure type \"EveningIssue\" in <type>"),
                validate("<type docstruct=\"EveningIssue\"><field key=\"Note\" /></type>"));
    }

    @Test
    public void validate_datePatterns() throws Exception {
        assertEquals(List.of("Invalid date pattern \"{\" in field \"DateIssued\" (format)", "Invalid date pattern \"{\" in field \"DateIssued\" (storeFormat)"),
                validate("<defaults><field key=\"DateIssued\" role=\"date\" format=\"{\" storeFormat=\"{\" /></defaults>"));
        // visible generated values are computed in the browser, which only knows d, dd, M, MM, yy and yyyy
        assertEquals(List.of("Date pattern \"MMMM yyyy\" of the visible field \"TitleDocMain\" is not supported (use d, dd, M, MM, yy, yyyy)"),
                validate("<defaults><field key=\"TitleDocMain\" value=\"Ausgabe vom {date:MMMM yyyy}\" /></defaults>"));
        assertEquals(List.of(), validate("<defaults><field key=\"TitleDocMain\" value=\"{date:MMMM yyyy}\" hidden=\"true\" /></defaults>"));
    }

    @Test
    public void validate_partKeyWithoutNumber_andVolumeWithoutChildren() throws Exception {
        assertEquals(List.of("Attribute partKey is only allowed on the field with role \"number\""),
                validate("<defaults><field key=\"DateIssued\" role=\"date\" partKey=\"PartNumber\" /></defaults>"));
        assertEquals(List.of("Structure type \"TableOfContents\" allows no child types"),
                parse("<defaults>" + ROLES + "</defaults>").validate(TestDocuments.ruleset(), "TableOfContents"));
    }

    @Test
    public void installConfig_isValid() throws Exception {
        XMLConfiguration config = new XMLConfiguration();
        config.setDelimiterParsingDisabled(true);
        config.load(new File("../install/plugin_intranda_step_newspaperRecognizer.xml"));
        PluginConfiguration parsed = PluginConfiguration.parse(config);
        assertEquals(List.of(), parsed.validate(TestDocuments.ruleset(), "NewspaperVolume"));
        assertEquals(TestDocuments.FIELDS, parsed.fields());
    }
}
