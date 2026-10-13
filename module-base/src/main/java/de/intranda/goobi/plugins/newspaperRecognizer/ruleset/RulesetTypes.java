package de.intranda.goobi.plugins.newspaperRecognizer.ruleset;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;
import ugh.dl.DocStructType;
import ugh.dl.Metadata;
import ugh.dl.MetadataGroup;
import ugh.dl.MetadataGroupType;
import ugh.dl.MetadataType;
import ugh.dl.Prefs;

/**
 * Everything the plugin reads from the ruleset: which types exist, how they are labelled, which children and metadata they
 * allow. Date and number fields exist for a type exactly when the type allows the metadata configured in {@code <fields>}.
 */
public class RulesetTypes {
    private static final String NOT_ALLOWED = "0";
    private static final String REQUIRED_ONE = "1m";
    private static final String REQUIRED_MANY = "+";

    private final Prefs prefs;
    private final FieldConfiguration fields;

    public RulesetTypes(Prefs prefs, FieldConfiguration fields) {
        this.prefs = prefs;
        this.fields = fields;
    }

    public FieldConfiguration fields() {
        return fields;
    }

    public boolean exists(String type) {
        return type != null && prefs.getDocStrctTypeByName(type) != null;
    }

    public DocStructType docStructType(String type) {
        DocStructType result = type == null ? null : prefs.getDocStrctTypeByName(type);
        if (result == null) {
            throw new IllegalArgumentException("Unknown structure type \"" + type + "\"");
        }
        return result;
    }

    public boolean metadataTypeExists(String name) {
        return name != null && prefs.getMetadataTypeByName(name) != null;
    }

    public MetadataType metadataType(String name) {
        MetadataType result = name == null ? null : prefs.getMetadataTypeByName(name);
        if (result == null) {
            throw new IllegalArgumentException("Unknown metadata type \"" + name + "\"");
        }
        return result;
    }

    public List<String> allowedChildren(String parentType) {
        if (!exists(parentType)) {
            return List.of();
        }
        List<String> children = docStructType(parentType).getAllAllowedDocStructTypes();
        return children == null ? List.of() : List.copyOf(children);
    }

    public boolean isAllowedChild(String parentType, String childType) {
        return childType != null && allowedChildren(parentType).contains(childType);
    }

    public String label(String type, String language) {
        if (!exists(type)) {
            return type;
        }
        String label = docStructType(type).getNameByLanguage(language);
        return StringUtils.isBlank(label) ? type : label;
    }

    public String metadataLabel(String metadata, String language) {
        if (!metadataTypeExists(metadata)) {
            return metadata;
        }
        String label = metadataType(metadata).getNameByLanguage(language);
        return StringUtils.isBlank(label) ? metadata : label;
    }

    public Set<String> allLabels(String type) {
        if (!exists(type)) {
            return Set.of();
        }
        Map<String, String> languages = docStructType(type).getAllLanguages();
        return languages == null ? Set.of() : Set.copyOf(languages.values());
    }

    public Optional<String> cardinality(String type, String metadata) {
        if (!exists(type) || !metadataTypeExists(metadata)) {
            return Optional.empty();
        }
        String num = docStructType(type).getNumberOfMetadataType(metadataType(metadata));
        return num == null || NOT_ALLOWED.equals(num) ? Optional.empty() : Optional.of(num);
    }

    public boolean allowsMetadata(String type, String metadata) {
        return cardinality(type, metadata).isPresent();
    }

    /** Whether a metadata, person, corporate or metadata group of a DocStruct may stay on a DocStruct of the given type. */
    public boolean allowsEntry(String type, Object entry) {
        if (entry instanceof MetadataGroup group) {
            MetadataGroupType groupType = group.getType();
            String num = exists(type) ? docStructType(type).getNumberOfMetadataGroups(groupType) : null;
            return num != null && !NOT_ALLOWED.equals(num);
        }
        return allowsMetadata(type, ((Metadata) entry).getType().getName());
    }

    public boolean isRequired(String type, String metadata) {
        return cardinality(type, metadata).map(n -> REQUIRED_ONE.equals(n) || REQUIRED_MANY.equals(n)).orElse(false);
    }

    public boolean isDated(String type) {
        return fields.dateMetadata() != null && allowsMetadata(type, fields.dateMetadata());
    }

    public boolean isNumbered(String type) {
        return fields.numberMetadata() != null && allowsMetadata(type, fields.numberMetadata());
    }

    public boolean isPartNumbered(String type) {
        return isNumbered(type) && fields.partNumberMetadata() != null && allowsMetadata(type, fields.partNumberMetadata());
    }

    public List<String> allowedMetadata(String type) {
        if (!exists(type)) {
            return List.of();
        }
        DocStructType docStructType = docStructType(type);
        List<String> result = new ArrayList<>();
        if (docStructType.getAllMetadataTypes() != null) {
            docStructType.getAllMetadataTypes().forEach(m -> result.add(m.getName()));
        }
        if (docStructType.getAllMetadataGroupTypes() != null) {
            docStructType.getAllMetadataGroupTypes().forEach(g -> result.add(g.getName()));
        }
        return result;
    }

    public TypeInfo info(String type, String language) {
        boolean dated = isDated(type);
        boolean numbered = isNumbered(type);
        return new TypeInfo(type, label(type, language), dated, numbered, isPartNumbered(type),
                dated && isRequired(type, fields.dateMetadata()),
                numbered && isRequired(type, fields.numberMetadata()),
                allowedChildren(type), allowedMetadata(type));
    }

    public List<TypeInfo> catalog(String language) {
        return prefs.getAllDocStructTypes().stream().map(DocStructType::getName).map(name -> info(name, language)).toList();
    }
}
