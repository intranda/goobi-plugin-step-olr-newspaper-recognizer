package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.List;

public record NewspaperIssueType(String rulesetType, String label, List<NewspaperMetadataWriteConfiguration> customMetadata) {
}
