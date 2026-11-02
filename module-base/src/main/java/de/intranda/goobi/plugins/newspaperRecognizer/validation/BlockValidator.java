package de.intranda.goobi.plugins.newspaperRecognizer.validation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.config.DisplayRulesLookup;
import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldDefinition;
import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldDisplay;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/** Checks the blocks before anything is written. Mirrors {@code validateBlocks} in {@code lib/logic/blocks.mjs}. */
public class BlockValidator {
    private final RulesetTypes ruleset;
    private final String volumeType;
    private final boolean preventDuplicates;
    private final Function<String, List<FieldDefinition>> visibleFields;

    /** Without metadata fields. */
    public BlockValidator(RulesetTypes ruleset, String volumeType, boolean preventDuplicates) {
        this(ruleset, volumeType, preventDuplicates, type -> List.of());
    }

    public BlockValidator(RulesetTypes ruleset, String volumeType, PluginConfiguration config) {
        this(ruleset, volumeType, config, DisplayRulesLookup.INPUT_ONLY);
    }

    /** Readonly fields are not checked, the user cannot fill them. */
    public BlockValidator(RulesetTypes ruleset, String volumeType, PluginConfiguration config, DisplayRulesLookup display) {
        this(ruleset, volumeType, config.preventDuplicates(), type -> config.visibleFieldsFor(type, ruleset)
                .stream()
                .filter(f -> display.displayType(f.key()) != FieldDisplay.READONLY)
                .toList());
    }

    private BlockValidator(RulesetTypes ruleset, String volumeType, boolean preventDuplicates,
            Function<String, List<FieldDefinition>> visibleFields) {
        this.ruleset = ruleset;
        this.volumeType = volumeType;
        this.preventDuplicates = preventDuplicates;
        this.visibleFields = visibleFields;
    }

    public ValidationReport validate(List<BlockNode> roots) {
        ValidationReport report = new ValidationReport();
        validateSiblings(roots, volumeType, report);
        return report;
    }

    private void validateSiblings(List<BlockNode> siblings, String parentType, ValidationReport report) {
        Map<String, List<BlockNode>> keys = new LinkedHashMap<>();
        for (BlockNode node : siblings) {
            String type = node.type();
            BlockStart start = node.getStart();
            if (type == null) {
                report.getMissingType().add(describe(node));
            } else {
                if (parentType != null && !ruleset.isAllowedChild(parentType, type)) {
                    report.getNotAllowed().add(describe(node));
                }
                boolean dated = ruleset.isDated(type);
                boolean numbered = ruleset.isNumbered(type);
                if (dated && start.getDateRaw() != null) {
                    report.getInvalidDates().add(describe(node));
                } else if (dated && ruleset.isRequired(type, ruleset.fields().dateMetadata()) && StringUtils.isBlank(start.getDate())) {
                    report.getMissingRequired().add(describe(node));
                }
                if (numbered && ruleset.isRequired(type, ruleset.fields().numberMetadata()) && StringUtils.isBlank(start.getNumber())) {
                    report.getMissingRequired().add(describe(node));
                }
                // a field the request does not send is left untouched, so only sent values are checked
                boolean missingField = visibleFields.apply(type).stream()
                        .anyMatch(f -> ruleset.isRequired(type, f.key()) && start.getValues().containsKey(f.key())
                                && StringUtils.isBlank(start.getValues().get(f.key())));
                if (missingField) {
                    report.getMissingRequired().add(describe(node));
                }
                String date = StringUtils.defaultString(start.getDate());
                String number = StringUtils.trimToEmpty(start.getNumber());
                if (preventDuplicates && !(date.isEmpty() && number.isEmpty())) {
                    keys.computeIfAbsent(type + "|" + date + "|" + number, k -> new ArrayList<>()).add(node);
                }
            }
            validateSiblings(node.getChildren(), type, report);
        }
        keys.values()
                .stream()
                .filter(group -> group.size() > 1)
                .flatMap(List::stream)
                .map(BlockValidator::describe)
                .forEach(report.getDuplicates()::add);
    }

    private static String describe(BlockNode node) {
        return "Block on page " + (node.getFirstPage() + 1) + " (level " + node.getLevel() + ")";
    }
}
