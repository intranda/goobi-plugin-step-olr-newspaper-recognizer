package de.intranda.goobi.plugins.newspaperRecognizer.config;

import static org.junit.Assert.assertEquals;

import java.util.List;
import java.util.Map;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.FieldInfo;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.FieldItem;

public class FieldCatalogTest {
    private static final List<FieldItem> NOTES = List.of(new FieldItem("Beschädigt", "damaged"), new FieldItem("Fehlt", "missing"));

    /** Display rules as a map; metadata that is not listed is an input field. */
    public static DisplayRulesLookup display(Map<String, FieldDisplay> types) {
        return new DisplayRulesLookup() {
            @Override
            public FieldDisplay displayType(String metadata) {
                return types.getOrDefault(metadata, FieldDisplay.INPUT);
            }

            @Override
            public List<FieldItem> items(String metadata) {
                return "Note".equals(metadata) ? NOTES : List.of();
            }
        };
    }

    private static PluginConfiguration config(FieldDefinition... defaults) {
        return TestDocuments.config(List.of(defaults), Map.of());
    }

    @Test
    public void fieldsFor_visibleFieldsWithLabelDisplayAndPattern() {
        PluginConfiguration config = config(FieldDefinition.of("TitleDocMain", "Ausgabe {no}", false, true), FieldDefinition.of("Note", null, false, false),
                FieldDefinition.of("CurrentNoSorting", "{no}", true, false));
        FieldCatalog catalog = new FieldCatalog(config, TestDocuments.ruleset(), display(Map.of("Note", FieldDisplay.TEXTAREA)), "de");
        assertEquals(List.of(new FieldInfo("TitleDocMain", "Haupttitel", FieldDisplay.INPUT, false, "Ausgabe {no}", true, List.of()),
                new FieldInfo("Note", "Notiz", FieldDisplay.TEXTAREA, false, null, false, List.of())), catalog.fieldsFor("MorningIssue"));
        assertEquals(List.of(new FieldInfo("TitleDocMain", "Haupttitel", FieldDisplay.INPUT, false, "Ausgabe {no}", true, List.of())),
                catalog.fieldsFor("EveningIssue"));
    }

    @Test
    public void fieldsFor_requiredUnlessReadonly_select1WithItems() {
        PluginConfiguration config = config(FieldDefinition.of("TitleDocMain", null, false, false), FieldDefinition.of("Note", null, false, false));
        FieldCatalog editable = new FieldCatalog(config, TestDocuments.ruleset(), display(Map.of("Note", FieldDisplay.SELECT1)), "en");
        assertEquals(List.of(new FieldInfo("TitleDocMain", "Main title", FieldDisplay.INPUT, true, null, false, List.of()),
                new FieldInfo("Note", "Note", FieldDisplay.SELECT1, false, null, false, NOTES)), editable.fieldsFor("Article"));
        FieldCatalog readonly = new FieldCatalog(config, TestDocuments.ruleset(), display(Map.of("TitleDocMain", FieldDisplay.READONLY)), "en");
        assertEquals(new FieldInfo("TitleDocMain", "Main title", FieldDisplay.READONLY, false, null, false, List.of()), readonly.fieldsFor("Article").get(0));
    }

    @Test
    public void validate_patternOnVisibleSelect1_isAnError() {
        PluginConfiguration config = TestDocuments.config(List.of(FieldDefinition.of("TitleDocMain", "Ausgabe {no}", false, false),
                FieldDefinition.of("CurrentNoSorting", "{no}", true, false)),
                Map.of("Article", List.of(FieldDefinition.of("Note", null, false, false))));
        Map<String, FieldDisplay> select1 = Map.of("TitleDocMain", FieldDisplay.SELECT1, "CurrentNoSorting", FieldDisplay.SELECT1, "Note", FieldDisplay.SELECT1);
        assertEquals(List.of("Field \"TitleDocMain\" has a value pattern, but its display type is select1"),
                new FieldCatalog(config, TestDocuments.ruleset(), display(select1), "de").validate());
    }
}
