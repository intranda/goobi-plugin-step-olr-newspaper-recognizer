package de.intranda.goobi.plugins.newspaperRecognizer.config;

/**
 * One {@code <field>} of {@code <defaults>} or {@code <type>}. A field with a role is the date or number field of a block; the others
 * are metadata fields. {@code value} is the generator pattern, {@code null} for a plain editable field. {@code format},
 * {@code storeFormat} and {@code partKey} are only used by role fields.
 */
public record FieldDefinition(String key, String role, String value, boolean hidden, boolean skipIfEmpty, String format,
        String storeFormat, String partKey) {
    public static final String ROLE_DATE = "date";
    public static final String ROLE_NUMBER = "number";

    /** A metadata field without role. */
    public static FieldDefinition of(String key, String value, boolean hidden, boolean skipIfEmpty) {
        return new FieldDefinition(key, null, value, hidden, skipIfEmpty, null, null, null);
    }

    public boolean hasPattern() {
        return value != null;
    }
}
