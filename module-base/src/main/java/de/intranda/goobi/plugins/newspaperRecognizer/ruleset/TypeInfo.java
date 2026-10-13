package de.intranda.goobi.plugins.newspaperRecognizer.ruleset;

import java.util.Collection;
import java.util.List;

/**
 * What the frontend needs to know about one ruleset type. {@code managedMetadata} (what the plugin writes for this type) and
 * {@code fields} (the visible metadata fields) come from the plugin configuration, see {@link #withConfiguration}.
 * {@code generatorLabel} is the label the {@code {label}} placeholder uses.
 */
public record TypeInfo(String name, String label, String generatorLabel, boolean dated, boolean numbered, boolean partNumbered,
        boolean dateRequired, boolean numberRequired, List<String> children, List<String> allowedMetadata, List<String> managedMetadata,
        List<FieldInfo> fields) {

    public TypeInfo withConfiguration(Collection<String> managed, List<FieldInfo> visibleFields) {
        return new TypeInfo(name, label, generatorLabel, dated, numbered, partNumbered, dateRequired, numberRequired, children, allowedMetadata,
                List.copyOf(managed), List.copyOf(visibleFields));
    }
}
