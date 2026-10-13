package de.intranda.goobi.plugins.newspaperRecognizer.validation;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/** Checks the blocks before anything is written. Mirrors {@code validateBlocks} in {@code logic/blocks.mjs}. */
public class BlockValidator {
    private final RulesetTypes ruleset;
    private final String volumeType;
    private final boolean preventDuplicates;

    public BlockValidator(RulesetTypes ruleset, String volumeType, boolean preventDuplicates) {
        this.ruleset = ruleset;
        this.volumeType = volumeType;
        this.preventDuplicates = preventDuplicates;
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
                String date = StringUtils.defaultString(start.getDate());
                String number = StringUtils.trimToEmpty(start.getNumber());
                if (preventDuplicates && !(date.isEmpty() && number.isEmpty())) {
                    keys.computeIfAbsent(type + "|" + date + "|" + number, k -> new ArrayList<>()).add(node);
                }
            }
            validateSiblings(node.getChildren(), type, report);
        }
        keys.values().stream().filter(group -> group.size() > 1).flatMap(List::stream).map(BlockValidator::describe).forEach(report.getDuplicates()::add);
    }

    private static String describe(BlockNode node) {
        return "Block on page " + (node.getFirstPage() + 1) + " (level " + node.getLevel() + ")";
    }
}
