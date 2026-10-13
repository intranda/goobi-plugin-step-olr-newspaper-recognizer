package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.time.format.DateTimeFormatter;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import org.apache.commons.configuration.HierarchicalConfiguration;
import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/**
 * The plugin configuration. It only holds what the ruleset cannot express: which metadata the date and number fields write, the
 * metadata fields per type (editable, generated or hidden), the duplicate check and pagination.
 *
 * @param fields the role fields of {@code <defaults>}
 * @param defaults the metadata fields of {@code <defaults>}, without role fields
 * @param types the metadata fields of each {@code <type docstruct>}
 */
public record PluginConfiguration(boolean loadAllImages, boolean showDeletePageButton, boolean preventDuplicates,
        PaginationConfiguration pagination, FieldConfiguration fields, List<FieldDefinition> defaults,
        Map<String, List<FieldDefinition>> types, List<String> parseErrors) {

    private static final Pattern DATE_PLACEHOLDER = Pattern.compile("\\{(?:parent\\.)?date:([^}]*)\\}");
    /** The date tokens the browser can format, see logic/fields.mjs. */
    private static final Set<String> BROWSER_DATE_TOKENS = Set.of("d", "dd", "M", "MM", "yy", "yyyy");

    public static PluginConfiguration parse(HierarchicalConfiguration config) {
        List<String> errors = new ArrayList<>();
        if (!config.configurationsAt("fields").isEmpty() || !config.configurationsAt("generate").isEmpty()) {
            errors.add("The elements <fields> and <generate> are no longer supported, use <defaults> and <type> with <field> (see the update notes)");
        }
        Map<String, FieldDefinition> roles = new LinkedHashMap<>();
        List<HierarchicalConfiguration> defaultFields = config.configurationsAt("defaults.field");
        for (HierarchicalConfiguration field : defaultFields) {
            String key = StringUtils.trimToNull(field.getString("[@key]"));
            String role = StringUtils.trimToNull(field.getString("[@role]"));
            if (key == null || role == null) {
                continue;
            }
            if (!FieldDefinition.ROLE_DATE.equals(role) && !FieldDefinition.ROLE_NUMBER.equals(role)) {
                errors.add("Unknown role \"" + role + "\" of field \"" + key + "\"");
            } else if (roles.containsKey(role)) {
                errors.add("More than one field with role \"" + role + "\" in <defaults>");
            } else if (FieldDefinition.ROLE_DATE.equals(role) && field.getString("[@partKey]") != null) {
                errors.add("Attribute partKey is only allowed on the field with role \"number\"");
            } else {
                roles.put(role, readField(field, key, role));
            }
        }
        Map<String, String> roleKeys = new HashMap<>();
        roles.values().forEach(f -> roleKeys.put(f.key(), f.role()));

        List<FieldDefinition> defaults = readFields(defaultFields, "<defaults>", roleKeys, errors);
        Map<String, List<FieldDefinition>> types = new LinkedHashMap<>();
        for (HierarchicalConfiguration type : config.configurationsAt("type")) {
            String name = StringUtils.trimToNull(type.getString("[@docstruct]"));
            if (name == null) {
                errors.add("<type> without docstruct attribute");
            } else if (types.containsKey(name)) {
                errors.add("Duplicate <type docstruct=\"" + name + "\">");
            } else {
                types.put(name, readFields(type.configurationsAt("field"), "<type docstruct=\"" + name + "\">", roleKeys, errors));
            }
        }

        FieldDefinition date = roles.get(FieldDefinition.ROLE_DATE);
        FieldDefinition number = roles.get(FieldDefinition.ROLE_NUMBER);
        FieldConfiguration fields = new FieldConfiguration(
                date == null ? null : date.key(),
                date == null || date.format() == null ? FieldConfiguration.DEFAULT_DATE_FORMAT : date.format(),
                date == null || date.storeFormat() == null ? FieldConfiguration.DEFAULT_STORE_FORMAT : date.storeFormat(),
                number == null ? null : number.key(),
                number == null ? null : number.partKey());
        PaginationConfiguration pagination = new PaginationConfiguration(
                config.getBoolean("pagination.createNewPagination", true),
                config.getString("pagination.type", "1"),
                config.getBoolean("pagination.useFakePagination", false));
        return new PluginConfiguration(config.getBoolean("loadAllImages", true), config.getBoolean("showDeletePageButton", false),
                config.getBoolean("preventDuplicates", false), pagination, fields, defaults, Collections.unmodifiableMap(types),
                List.copyOf(errors));
    }

    private static FieldDefinition readField(HierarchicalConfiguration field, String key, String role) {
        return new FieldDefinition(key, role, field.getString("[@value]"), field.getBoolean("[@hidden]", false),
                field.getBoolean("[@skipIfEmpty]", false), StringUtils.trimToNull(field.getString("[@format]")),
                StringUtils.trimToNull(field.getString("[@storeFormat]")), StringUtils.trimToNull(field.getString("[@partKey]")));
    }

    /** The metadata fields of one section; role fields are read separately and only accepted in {@code <defaults>}. */
    private static List<FieldDefinition> readFields(List<HierarchicalConfiguration> fields, String section, Map<String, String> roleKeys,
            List<String> errors) {
        Map<String, FieldDefinition> result = new LinkedHashMap<>();
        for (HierarchicalConfiguration field : fields) {
            String key = StringUtils.trimToNull(field.getString("[@key]"));
            String role = StringUtils.trimToNull(field.getString("[@role]"));
            if (key == null) {
                errors.add("<field> without key in " + section);
                continue;
            }
            if (role != null) {
                if (!"<defaults>".equals(section)) {
                    errors.add("Role field \"" + key + "\" is only allowed in <defaults> (found in " + section + ")");
                }
                continue;
            }
            FieldDefinition definition = readField(field, key, null);
            if (roleKeys.containsKey(key)) {
                errors.add("Field \"" + key + "\" is already the field with role \"" + roleKeys.get(key) + "\"");
            } else if (result.containsKey(key)) {
                errors.add("Duplicate field \"" + key + "\" in " + section);
            } else if (definition.partKey() != null) {
                errors.add("Attribute partKey is only allowed on the field with role \"number\"");
            } else if (definition.hidden() && !definition.hasPattern()) {
                errors.add("Field \"" + key + "\" is hidden but has no value pattern");
            } else {
                result.put(key, definition);
            }
        }
        return List.copyOf(result.values());
    }

    /** The metadata fields of a type: the defaults in their order (overridden in place), then the fields only the type has. */
    public List<FieldDefinition> fieldsFor(String type) {
        Map<String, FieldDefinition> result = new LinkedHashMap<>();
        defaults.forEach(f -> result.put(f.key(), f));
        types.getOrDefault(type, List.of()).forEach(f -> result.put(f.key(), f));
        return List.copyOf(result.values());
    }

    /** {@link #fieldsFor(String)} without the metadata the type does not allow. */
    public List<FieldDefinition> fieldsFor(String type, RulesetTypes ruleset) {
        return fieldsFor(type).stream().filter(f -> ruleset.allowsMetadata(type, f.key())).toList();
    }

    /** The fields shown in the block UI. */
    public List<FieldDefinition> visibleFieldsFor(String type, RulesetTypes ruleset) {
        return fieldsFor(type, ruleset).stream().filter(f -> !f.hidden()).toList();
    }

    /** The hidden generated fields, which the plugin writes on every save. */
    public List<MetadataTemplate> templatesFor(String type) {
        return toTemplates(fieldsFor(type));
    }

    /** {@link #templatesFor(String)} without the metadata the type does not allow. */
    public List<MetadataTemplate> templatesFor(String type, RulesetTypes ruleset) {
        return toTemplates(fieldsFor(type, ruleset));
    }

    private static List<MetadataTemplate> toTemplates(List<FieldDefinition> fields) {
        return fields.stream().filter(FieldDefinition::hidden).map(f -> new MetadataTemplate(f.key(), f.value(), f.skipIfEmpty())).toList();
    }

    private Stream<String> roleMetadata() {
        return Stream.of(fields.dateMetadata(), fields.numberMetadata(), fields.partNumberMetadata()).filter(Objects::nonNull);
    }

    /** Metadata the plugin writes for blocks of this type: the role metadata, then the field keys. */
    public Set<String> managedMetadata(String type) {
        Set<String> result = new LinkedHashSet<>();
        roleMetadata().forEach(result::add);
        fieldsFor(type).forEach(f -> result.add(f.key()));
        return result;
    }

    /** {@link #managedMetadata(String)} without the metadata the type does not allow (those are hidden data, if present). */
    public Set<String> managedMetadata(String type, RulesetTypes ruleset) {
        Set<String> result = new LinkedHashSet<>();
        roleMetadata().filter(m -> ruleset.allowsMetadata(type, m)).forEach(result::add);
        fieldsFor(type, ruleset).forEach(f -> result.add(f.key()));
        return result;
    }

    public List<String> validate(RulesetTypes ruleset, String volumeType) {
        List<String> errors = new ArrayList<>(parseErrors);
        Set<String> reachable = reachableTypes(ruleset, volumeType);
        List<String> volumeWide = new ArrayList<>();
        roleMetadata().forEach(volumeWide::add);
        defaults.forEach(f -> volumeWide.add(f.key()));
        for (String metadata : volumeWide) {
            if (!ruleset.metadataTypeExists(metadata)) {
                errors.add("Unknown metadata \"" + metadata + "\" in field");
            } else if (!reachable.isEmpty() && reachable.stream().noneMatch(t -> ruleset.allowsMetadata(t, metadata))) {
                errors.add("Metadata \"" + metadata + "\" is not allowed for any structure type of the volume");
            }
        }
        if (fields.dateMetadata() != null) {
            checkPattern(fields.dateFormat(), fields.dateMetadata(), "format", errors);
            checkPattern(fields.storeFormat(), fields.dateMetadata(), "storeFormat", errors);
        }
        types.forEach((type, list) -> {
            if (!ruleset.exists(type)) {
                errors.add("Unknown structure type \"" + type + "\" in <type>");
                return;
            }
            for (FieldDefinition field : list) {
                if (!ruleset.metadataTypeExists(field.key())) {
                    errors.add("Unknown metadata \"" + field.key() + "\" in field");
                } else if (!ruleset.allowsMetadata(type, field.key())) {
                    errors.add("Metadata \"" + field.key() + "\" is not allowed for structure type \"" + type + "\" in <type>");
                }
            }
        });
        Stream.concat(defaults.stream(), types.values().stream().flatMap(List::stream))
                .filter(f -> !f.hidden() && f.hasPattern())
                .forEach(f -> checkBrowserDatePatterns(f, errors));
        if (ruleset.allowedChildren(volumeType).isEmpty()) {
            errors.add("Structure type \"" + volumeType + "\" allows no child types");
        }
        return errors;
    }

    private static Set<String> reachableTypes(RulesetTypes ruleset, String volumeType) {
        Set<String> result = new LinkedHashSet<>();
        Deque<String> queue = new ArrayDeque<>(ruleset.allowedChildren(volumeType));
        while (!queue.isEmpty()) {
            String type = queue.poll();
            if (result.add(type)) {
                queue.addAll(ruleset.allowedChildren(type));
            }
        }
        return result;
    }

    private static void checkPattern(String pattern, String key, String attribute, List<String> errors) {
        try {
            DateTimeFormatter.ofPattern(pattern);
        } catch (IllegalArgumentException e) {
            errors.add("Invalid date pattern \"" + pattern + "\" in field \"" + key + "\" (" + attribute + ")");
        }
    }

    /** Visible generated values are computed in the browser, which only formats the tokens in {@link #BROWSER_DATE_TOKENS}. */
    private static void checkBrowserDatePatterns(FieldDefinition field, List<String> errors) {
        Matcher matcher = DATE_PLACEHOLDER.matcher(field.value());
        while (matcher.find()) {
            String pattern = matcher.group(1);
            if (!browserSupports(pattern)) {
                errors.add("Date pattern \"" + pattern + "\" of the visible field \"" + field.key()
                        + "\" is not supported (use d, dd, M, MM, yy, yyyy)");
            }
        }
    }

    private static boolean browserSupports(String pattern) {
        int i = 0;
        while (i < pattern.length()) {
            char c = pattern.charAt(i);
            if (c == '\'') {
                int end = pattern.indexOf('\'', i + 1);
                if (end < 0) {
                    return false;
                }
                i = end + 1;
            } else if (Character.isLetter(c)) {
                int end = i;
                while (end < pattern.length() && pattern.charAt(end) == c) {
                    end++;
                }
                if (!BROWSER_DATE_TOKENS.contains(pattern.substring(i, end))) {
                    return false;
                }
                i = end;
            } else {
                i++;
            }
        }
        return true;
    }
}
