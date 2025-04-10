package de.intranda.goobi.plugins.newspaper;

import java.util.List;

public record NewspaperSupplementType(String rulesetType, String label, List<NewspaperMetadataWriteConfiguration> customMetadata) {
}
