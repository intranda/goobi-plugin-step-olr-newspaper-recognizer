package de.intranda.goobi.plugins.newspaperRecognizer.ruleset;

import java.util.List;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldDisplay;

/**
 * A visible metadata field of a type, for the frontend. {@code pattern} is the generator pattern, {@code null} for a plain editable
 * field; {@code required} is false for readonly fields, which the user cannot fill.
 */
public record FieldInfo(String key, String label, FieldDisplay display, boolean required, String pattern, boolean skipIfEmpty,
        List<FieldItem> items) {
}
