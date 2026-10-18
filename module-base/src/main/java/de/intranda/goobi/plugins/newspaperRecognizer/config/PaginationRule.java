package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.util.List;

/**
 * The numbering of one structure type.
 *
 * @param beginsWith the values a block of the type may begin with, e.g. {@code 1}, {@code i} or {@code [1]}
 * @param continueInParent whether the numbering of the parent block continues through a block of this type
 */
public record PaginationRule(List<String> beginsWith, boolean continueInParent) {
}
