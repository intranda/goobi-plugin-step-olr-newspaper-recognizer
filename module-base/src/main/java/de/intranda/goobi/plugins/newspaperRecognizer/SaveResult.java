package de.intranda.goobi.plugins.newspaperRecognizer;

/**
 * Outcome of the last save. The GUI reads it after the save request has been answered, because a refused or failed write is
 * otherwise indistinguishable from a successful one.
 */
public enum SaveResult {
    NONE,
    SUCCESS,
    CONFIG_ERROR,
    INVALID_DATA,
    MISSING_TYPE,
    MISSING_REQUIRED,
    DUPLICATES,
    UNRESOLVED_HIDDEN_DATA,
    ERROR
}
