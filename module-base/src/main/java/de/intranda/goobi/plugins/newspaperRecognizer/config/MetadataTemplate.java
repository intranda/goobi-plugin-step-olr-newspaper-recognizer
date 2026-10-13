package de.intranda.goobi.plugins.newspaperRecognizer.config;

/** One {@code <metadata>} entry of a {@code <generate>} element. */
public record MetadataTemplate(String key, String value, boolean skipIfEmpty) {
}
