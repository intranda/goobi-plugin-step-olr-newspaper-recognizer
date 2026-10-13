package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.List;

/** A message for the user: a message key plus the values for its {0}, {1}, … placeholders. */
public record Notice(String key, List<String> params) {
}
