package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Stream;

import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/**
 * The plugin configuration. It only holds what the ruleset cannot express: which metadata the fields write, generated
 * metadata per type, the duplicate check and pagination.
 */
public record PluginConfiguration(boolean loadAllImages, boolean showDeletePageButton, boolean preventDuplicates,
        PaginationConfiguration pagination, FieldConfiguration fields, Map<String, List<MetadataTemplate>> templates,
        List<String> parseErrors) {

    public static PluginConfiguration parse(HierarchicalConfiguration config) {
        List<String> errors = new ArrayList<>();
        Map<String, List<MetadataTemplate>> templates = new LinkedHashMap<>();
        for (HierarchicalConfiguration generate : config.configurationsAt("generate")) {
            String type = generate.getString("[@docstruct]");
            if (StringUtils.isBlank(type)) {
                errors.add("<generate> without docstruct attribute");
            } else if (templates.containsKey(type)) {
                errors.add("Duplicate <generate docstruct=\"" + type + "\">");
            } else {
                templates.put(type, generate.configurationsAt("metadata")
                        .stream()
                        .map(m -> new MetadataTemplate(m.getString("[@key]"), m.getString("[@value]", ""), m.getBoolean("[@skipIfEmpty]", false)))
                        .toList());
            }
        }
        FieldConfiguration fields = new FieldConfiguration(
                StringUtils.trimToNull(config.getString("fields.date[@metadata]")),
                config.getString("fields.date[@format]", FieldConfiguration.DEFAULT_DATE_FORMAT),
                config.getString("fields.date[@storeFormat]", FieldConfiguration.DEFAULT_STORE_FORMAT),
                StringUtils.trimToNull(config.getString("fields.number[@metadata]")),
                StringUtils.trimToNull(config.getString("fields.number[@partMetadata]")));
        PaginationConfiguration pagination = new PaginationConfiguration(
                config.getBoolean("pagination.createNewPagination", true),
                config.getString("pagination.type", "1"),
                config.getBoolean("pagination.useFakePagination", false));
        return new PluginConfiguration(config.getBoolean("loadAllImages", true), config.getBoolean("showDeletePageButton", false),
                config.getBoolean("preventDuplicates", false), pagination, fields, Collections.unmodifiableMap(templates),
                List.copyOf(errors));
    }

    public List<MetadataTemplate> templatesFor(String type) {
        return templates.getOrDefault(type, List.of());
    }

    /** Metadata the plugin writes for blocks of this type: the field metadata, then the template keys. */
    public Set<String> managedMetadata(String type) {
        Set<String> result = new LinkedHashSet<>();
        Stream.of(fields.dateMetadata(), fields.numberMetadata(), fields.partNumberMetadata()).filter(Objects::nonNull).forEach(result::add);
        templatesFor(type).forEach(t -> result.add(t.key()));
        return result;
    }

    /** {@link #managedMetadata(String)} without the field metadata the type does not allow (those are hidden data, if present). */
    public Set<String> managedMetadata(String type, RulesetTypes ruleset) {
        Set<String> result = new LinkedHashSet<>();
        Set<String> templateKeys = new HashSet<>();
        templatesFor(type).forEach(t -> templateKeys.add(t.key()));
        for (String metadata : managedMetadata(type)) {
            if (templateKeys.contains(metadata) || ruleset.allowsMetadata(type, metadata)) {
                result.add(metadata);
            }
        }
        return result;
    }

    public List<String> validate(RulesetTypes ruleset, String volumeType) {
        List<String> errors = new ArrayList<>(parseErrors);
        Set<String> fieldMetadata = new HashSet<>();
        Stream.of(fields.dateMetadata(), fields.numberMetadata(), fields.partNumberMetadata()).filter(Objects::nonNull).forEach(name -> {
            fieldMetadata.add(name);
            if (!ruleset.metadataTypeExists(name)) {
                errors.add("Unknown metadata \"" + name + "\" in <fields>");
            }
        });
        if (fields.partNumberMetadata() != null && fields.numberMetadata() == null) {
            errors.add("<number partMetadata> requires <number metadata>");
        }
        checkPattern(fields.dateFormat(), "format", errors);
        checkPattern(fields.storeFormat(), "storeFormat", errors);
        templates.forEach((type, list) -> {
            if (!ruleset.exists(type)) {
                errors.add("Unknown structure type \"" + type + "\" in <generate>");
                return;
            }
            for (MetadataTemplate template : list) {
                if (StringUtils.isBlank(template.key())) {
                    errors.add("<metadata> without key in <generate docstruct=\"" + type + "\">");
                } else if (fieldMetadata.contains(template.key())) {
                    errors.add("Metadata \"" + template.key() + "\" in <generate docstruct=\"" + type + "\"> is already written by <fields>");
                } else if (!ruleset.allowsMetadata(type, template.key())) {
                    errors.add("Metadata \"" + template.key() + "\" is not allowed for structure type \"" + type + "\" in <generate>");
                }
            }
        });
        if (ruleset.allowedChildren(volumeType).isEmpty()) {
            errors.add("Structure type \"" + volumeType + "\" allows no child types");
        }
        return errors;
    }

    private static void checkPattern(String pattern, String attribute, List<String> errors) {
        try {
            DateTimeFormatter.ofPattern(pattern);
        } catch (IllegalArgumentException e) {
            errors.add("Invalid date pattern \"" + pattern + "\" in <fields><date " + attribute + ">");
        }
    }
}
