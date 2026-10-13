package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import ugh.dl.Corporate;
import ugh.dl.DocStruct;
import ugh.dl.Metadata;
import ugh.dl.MetadataGroup;
import ugh.dl.MetadataType;
import ugh.dl.Person;
import ugh.exceptions.IncompletePersonObjectException;
import ugh.exceptions.MetadataTypeNotAllowedException;

/**
 * Access to the metadata of a DocStruct. The plugin manages only the first instance of each managed metadata type; every
 * other metadata, person, corporate and group is hidden data.
 */
public final class MetadataAccess {

    private MetadataAccess() {
    }

    public static Optional<Metadata> first(DocStruct ds, String type) {
        return nullSafe(ds.getAllMetadata()).stream().filter(m -> type.equals(m.getType().getName())).findFirst();
    }

    public static String firstValue(DocStruct ds, String type) {
        return first(ds, type).map(Metadata::getValue).orElse(null);
    }

    public static List<Object> hidden(DocStruct ds, Set<String> managed) {
        List<Object> result = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (Metadata metadata : nullSafe(ds.getAllMetadata())) {
            String type = metadata.getType().getName();
            if (managed.contains(type) && seen.add(type)) {
                continue;
            }
            result.add(metadata);
        }
        result.addAll(nullSafe(ds.getAllPersons()));
        result.addAll(nullSafe(ds.getAllCorporates()));
        result.addAll(nullSafe(ds.getAllMetadataGroups()));
        return result;
    }

    public static String typeName(Object entry) {
        if (entry instanceof MetadataGroup group) {
            return group.getType().getName();
        }
        return ((Metadata) entry).getType().getName();
    }

    public static String value(Object entry) {
        if (entry instanceof Person person) {
            return person.getDisplayname();
        }
        if (entry instanceof Corporate corporate) {
            return corporate.getMainName();
        }
        if (entry instanceof MetadataGroup) {
            return "";
        }
        return ((Metadata) entry).getValue();
    }

    // UGH keeps the last instance of a required metadata unless the removal is forced, hence "true" everywhere
    public static void remove(DocStruct ds, Object entry) throws IncompletePersonObjectException {
        if (entry instanceof Person person) {
            ds.removePerson(person, true);
        } else if (entry instanceof Corporate corporate) {
            ds.removeCorporate(corporate, true);
        } else if (entry instanceof MetadataGroup group) {
            ds.removeMetadataGroup(group, true);
        } else {
            ds.removeMetadata((Metadata) entry, true);
        }
    }

    /** Sets the value of the first instance (in place, keeping the order), adds one if there is none, removes it on {@code null}. */
    public static void setFirst(DocStruct ds, MetadataType type, String value) throws MetadataTypeNotAllowedException {
        Optional<Metadata> existing = first(ds, type.getName());
        if (value == null) {
            existing.ifPresent(m -> ds.removeMetadata(m, true));
        } else if (existing.isPresent()) {
            existing.get().setValue(value);
        } else {
            Metadata metadata = new Metadata(type);
            metadata.setValue(value);
            ds.addMetadata(metadata);
        }
    }

    private static <T> List<T> nullSafe(List<T> list) {
        return list == null ? List.of() : list;
    }
}
