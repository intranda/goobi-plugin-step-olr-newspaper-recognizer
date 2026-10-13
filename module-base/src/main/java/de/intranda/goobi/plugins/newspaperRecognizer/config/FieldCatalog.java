package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.FieldInfo;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/** The visible metadata fields per type as the frontend shows them: configuration, ruleset and metadata display rules combined. */
public class FieldCatalog {
    private final PluginConfiguration config;
    private final RulesetTypes ruleset;
    private final DisplayRulesLookup display;
    private final String language;

    public FieldCatalog(PluginConfiguration config, RulesetTypes ruleset, DisplayRulesLookup display, String language) {
        this.config = config;
        this.ruleset = ruleset;
        this.display = display;
        this.language = language;
    }

    public List<FieldInfo> fieldsFor(String type) {
        return config.visibleFieldsFor(type, ruleset).stream().map(field -> {
            FieldDisplay shown = display.displayType(field.key());
            return new FieldInfo(field.key(), ruleset.metadataLabel(field.key(), language), shown,
                    shown != FieldDisplay.READONLY && ruleset.isRequired(type, field.key()), field.value(), field.skipIfEmpty(),
                    shown == FieldDisplay.SELECT1 ? display.items(field.key()) : List.of());
        }).toList();
    }

    /** A select1 field can only show one of its values, so it cannot show a generated one. */
    public List<String> validate() {
        List<String> errors = new ArrayList<>();
        Stream.concat(config.defaults().stream(), config.types().values().stream().flatMap(List::stream))
                .filter(f -> !f.hidden() && f.hasPattern() && display.displayType(f.key()) == FieldDisplay.SELECT1)
                .map(FieldDefinition::key)
                .distinct()
                .forEach(key -> errors.add("Field \"" + key + "\" has a value pattern, but its display type is select1"));
        return errors;
    }
}
