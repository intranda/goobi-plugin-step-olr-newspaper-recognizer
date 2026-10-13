package de.intranda.goobi.plugins.newspaperRecognizer.config;

/**
 * Which metadata the date and number fields of a block write, and the date formats used.
 * A {@code null} metadata name means the field does not exist for any type.
 */
public record FieldConfiguration(String dateMetadata, String dateFormat, String storeFormat, String numberMetadata,
        String partNumberMetadata) {
    public static final String DEFAULT_DATE_FORMAT = "dd.MM.yyyy";
    public static final String DEFAULT_STORE_FORMAT = "yyyy-MM-dd";
}
