package de.intranda.goobi.plugins.newspaper;

import java.util.List;

public record NewspaperIssueType(String rulesetType, String label, List<NewspaperMetadataWriteConfiguration> customMetadata) {
}
