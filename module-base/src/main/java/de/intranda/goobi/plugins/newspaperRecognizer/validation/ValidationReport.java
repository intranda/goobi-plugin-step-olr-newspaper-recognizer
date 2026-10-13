package de.intranda.goobi.plugins.newspaperRecognizer.validation;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

import de.intranda.goobi.plugins.newspaperRecognizer.SaveResult;
import lombok.Getter;

/** Problems that block saving, each list holding readable block descriptions. */
@Getter
public class ValidationReport {
    private final List<String> missingType = new ArrayList<>();
    private final List<String> notAllowed = new ArrayList<>();
    private final List<String> invalidDates = new ArrayList<>();
    private final List<String> missingRequired = new ArrayList<>();
    private final List<String> duplicates = new ArrayList<>();

    public boolean isValid() {
        return result() == SaveResult.SUCCESS;
    }

    public SaveResult result() {
        if (!missingType.isEmpty()) {
            return SaveResult.MISSING_TYPE;
        }
        if (!notAllowed.isEmpty() || !invalidDates.isEmpty()) {
            return SaveResult.INVALID_DATA;
        }
        if (!missingRequired.isEmpty()) {
            return SaveResult.MISSING_REQUIRED;
        }
        if (!duplicates.isEmpty()) {
            return SaveResult.DUPLICATES;
        }
        return SaveResult.SUCCESS;
    }

    public String messageKey() {
        return switch (result()) {
            case MISSING_TYPE -> "plugin_newspaperRecognizer_save_missingType";
            case INVALID_DATA -> "plugin_newspaperRecognizer_save_invalidData";
            case MISSING_REQUIRED -> "plugin_newspaperRecognizer_save_missingRequired";
            case DUPLICATES -> "plugin_newspaperRecognizer_save_duplicates";
            default -> null;
        };
    }

    public List<String> details() {
        return Stream.of(
                missingType.stream().map(b -> "Missing type: " + b),
                notAllowed.stream().map(b -> "Type not allowed here: " + b),
                invalidDates.stream().map(b -> "Invalid date: " + b),
                missingRequired.stream().map(b -> "Missing required value: " + b),
                duplicates.stream().map(b -> "Duplicate: " + b))
                .flatMap(s -> s)
                .toList();
    }
}
