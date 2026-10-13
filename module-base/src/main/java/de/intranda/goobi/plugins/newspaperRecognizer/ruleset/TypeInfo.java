package de.intranda.goobi.plugins.newspaperRecognizer.ruleset;

import java.util.Collection;
import java.util.List;

/**
 * What the frontend needs to know about one ruleset type. {@code managedMetadata} (what the plugin writes for this type) comes from
 * the plugin configuration, see {@link #withManagedMetadata(Collection)}.
 */
public record TypeInfo(String name, String label, boolean dated, boolean numbered, boolean partNumbered, boolean dateRequired,
        boolean numberRequired, List<String> children, List<String> allowedMetadata, List<String> managedMetadata) {

    public TypeInfo withManagedMetadata(Collection<String> managed) {
        return new TypeInfo(name, label, dated, numbered, partNumbered, dateRequired, numberRequired, children, allowedMetadata, List.copyOf(managed));
    }
}
