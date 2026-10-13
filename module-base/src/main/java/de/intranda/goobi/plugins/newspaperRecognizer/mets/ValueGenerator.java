package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.config.MetadataTemplate;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/** Fills the placeholders of a {@code <generate>} value for one block. */
public class ValueGenerator {
    public static final String MISSING_PLACEHOLDER_VALUE = "[MISSING]";
    static final String METADATA_LANGUAGE = "de";
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{(parent\\.)?(date:([^}]*)|no|partNo|label)\\}");

    private final RulesetTypes ruleset;

    public ValueGenerator(RulesetTypes ruleset) {
        this.ruleset = ruleset;
    }

    public Optional<String> generate(MetadataTemplate template, BlockNode block) {
        Matcher matcher = PLACEHOLDER.matcher(StringUtils.defaultString(template.value()));
        StringBuilder result = new StringBuilder();
        boolean missing = false;
        while (matcher.find()) {
            String value = resolve(matcher.group(2), matcher.group(3), block, matcher.group(1) != null);
            if (StringUtils.isBlank(value)) {
                missing = true;
                value = MISSING_PLACEHOLDER_VALUE;
            }
            matcher.appendReplacement(result, Matcher.quoteReplacement(value));
        }
        matcher.appendTail(result);
        return missing && template.skipIfEmpty() ? Optional.empty() : Optional.of(result.toString());
    }

    /** Prefix + number + suffix, or {@code null} if the block has no number. */
    public static String partNumber(BlockStart start) {
        if (StringUtils.isBlank(start.getNumber())) {
            return null;
        }
        return StringUtils.defaultString(start.getPrefix()) + start.getNumber().trim() + StringUtils.defaultString(start.getSuffix());
    }

    private String resolve(String name, String datePattern, BlockNode block, boolean parentOnly) {
        Function<BlockNode, String> valueOf = getter(name, datePattern);
        if (parentOnly) {
            return block.getParent() == null ? null : valueOf.apply(block.getParent());
        }
        if ("label".equals(name)) {
            return valueOf.apply(block);
        }
        for (BlockNode node = block; node != null; node = node.getParent()) {
            String value = valueOf.apply(node);
            if (StringUtils.isNotBlank(value)) {
                return value;
            }
        }
        return null;
    }

    private Function<BlockNode, String> getter(String name, String datePattern) {
        if (name.startsWith("date:")) {
            return node -> ruleset.isDated(node.type()) ? node.date().map(d -> format(d, datePattern)).orElse(null) : null;
        }
        return switch (name) {
            case "no" -> node -> ruleset.isNumbered(node.type()) ? StringUtils.trimToNull(node.getStart().getNumber()) : null;
            case "partNo" -> node -> ruleset.isNumbered(node.type()) ? partNumber(node.getStart()) : null;
            default -> node -> node.type() == null ? null : ruleset.label(node.type(), METADATA_LANGUAGE);
        };
    }

    private static String format(LocalDate date, String pattern) {
        try {
            return DateTimeFormatter.ofPattern(pattern).format(date);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
