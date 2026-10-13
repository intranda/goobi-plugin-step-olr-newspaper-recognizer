package de.intranda.goobi.plugins.newspaperRecognizer.data;

/** A hidden structure as listed in the UI. Pages are indices into the page list, -1 if the structure has no pages. */
public record HiddenStructureInfo(String key, String type, String label, int firstPage, int lastPage, String title) {
}
