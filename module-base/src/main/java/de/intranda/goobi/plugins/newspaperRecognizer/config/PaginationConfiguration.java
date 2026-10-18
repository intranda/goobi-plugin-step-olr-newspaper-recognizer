package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/**
 * The {@code <pagination>} configuration.
 *
 * @param enabled whether page labels are shown and edited at all
 * @param automatic the default of the dialog setting for automatic pagination
 * @param withoutBlock the values pages outside any block begin with
 * @param rules the numbering rules per structure type, as configured
 */
public record PaginationConfiguration(boolean enabled, boolean automatic, List<String> withoutBlock, Map<String, PaginationRule> rules) {

    private static final List<String> DEFAULT_WITHOUT_BLOCK = List.of("–");
    private static final List<String> DEFAULT_BEGINS_WITH = List.of("1");
    private static final List<String> REMOVED_ELEMENTS = List.of("createNewPagination", "type", "useFakePagination");

    public static PaginationConfiguration defaults() {
        return new PaginationConfiguration(true, true, DEFAULT_WITHOUT_BLOCK, Map.of());
    }

    public static PaginationConfiguration parse(HierarchicalConfiguration config, List<String> errors) {
        for (String removed : REMOVED_ELEMENTS) {
            if (config.containsKey("pagination." + removed)) {
                errors.add("The element <" + removed + "> in <pagination> is no longer supported, use <rule> and <withoutBlock> (see the update notes)");
            }
        }
        List<String> withoutBlock = DEFAULT_WITHOUT_BLOCK;
        List<HierarchicalConfiguration> withoutBlocks = config.configurationsAt("pagination.withoutBlock");
        if (!withoutBlocks.isEmpty()) {
            List<String> values = split(withoutBlocks.get(0).getString("[@beginsWith]"));
            if (values.isEmpty()) {
                errors.add("<withoutBlock> without beginsWith");
            } else {
                withoutBlock = values;
            }
        }
        Map<String, PaginationRule> rules = new LinkedHashMap<>();
        for (HierarchicalConfiguration rule : config.configurationsAt("pagination.rule")) {
            String name = StringUtils.trimToNull(rule.getString("[@docstruct]"));
            List<String> beginsWith = split(rule.getString("[@beginsWith]"));
            if (name == null) {
                errors.add("<rule> without docstruct attribute");
            } else if (rules.containsKey(name)) {
                errors.add("Duplicate <rule docstruct=\"" + name + "\">");
            } else if (beginsWith.isEmpty()) {
                errors.add("<rule docstruct=\"" + name + "\"> without beginsWith");
            } else {
                rules.put(name, new PaginationRule(beginsWith, rule.getBoolean("[@continueInParent]", false)));
            }
        }
        return new PaginationConfiguration(config.getBoolean("pagination[@enabled]", true), config.getBoolean("pagination[@automatic]", true),
                withoutBlock, Collections.unmodifiableMap(rules));
    }

    private static List<String> split(String value) {
        String trimmed = StringUtils.trimToEmpty(value);
        return trimmed.isEmpty() ? List.of() : List.of(trimmed.split("\\s+"));
    }

    public List<String> validate(RulesetTypes ruleset) {
        List<String> errors = new ArrayList<>();
        rules.keySet().stream().filter(type -> !ruleset.exists(type))
                .forEach(type -> errors.add("Unknown structure type \"" + type + "\" in <rule>"));
        return errors;
    }

    /**
     * The rules in effect below the given volume type: the configured ones, plus {@code 1} for every type that the ruleset allows
     * only directly under the volume. Types allowed as a child of another type have no rule unless configured.
     */
    public Map<String, PaginationRule> resolvedRules(RulesetTypes ruleset, String volumeType) {
        Map<String, PaginationRule> result = new LinkedHashMap<>();
        Set<String> reachable = PluginConfiguration.reachableTypes(ruleset, volumeType);
        for (String type : ruleset.allowedChildren(volumeType)) {
            boolean childElsewhere = reachable.stream().anyMatch(parent -> ruleset.isAllowedChild(parent, type));
            if (!childElsewhere) {
                result.put(type, new PaginationRule(DEFAULT_BEGINS_WITH, false));
            }
        }
        result.putAll(rules);
        return result;
    }
}
