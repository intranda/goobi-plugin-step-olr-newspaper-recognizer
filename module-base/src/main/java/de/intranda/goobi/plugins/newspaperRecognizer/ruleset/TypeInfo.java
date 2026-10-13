package de.intranda.goobi.plugins.newspaperRecognizer.ruleset;

import java.util.List;

/** What the frontend needs to know about one ruleset type. */
public record TypeInfo(String name, String label, boolean dated, boolean numbered, boolean partNumbered, boolean dateRequired,
        boolean numberRequired, List<String> children, List<String> allowedMetadata) {
}
