package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;

import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Reference;

/** Page DocStructs by their position in the image list, and the pages a structure references. */
public final class PageIndex {
    public static final String LOGICAL_PHYSICAL = "logical_physical";

    private PageIndex() {
    }

    public static Map<DocStruct, Integer> of(DigitalDocument dd, List<String> filenames) {
        Map<String, Integer> byName = new HashMap<>();
        for (int i = 0; i < filenames.size(); i++) {
            byName.putIfAbsent(filenames.get(i), i);
        }
        Map<DocStruct, Integer> result = new IdentityHashMap<>();
        Set<Integer> taken = new HashSet<>();
        for (DocStruct page : children(dd.getPhysicalDocStruct())) {
            Integer index = page.getImageName() == null ? null : byName.get(page.getImageName());
            if (index != null && taken.add(index)) {
                result.put(page, index);
            }
        }
        return result;
    }

    public static List<DocStruct> targets(DocStruct ds) {
        List<Reference> references = ds.getAllToReferences(LOGICAL_PHYSICAL);
        return references == null ? List.of() : references.stream().map(Reference::getTarget).toList();
    }

    public static List<Integer> ownPages(DocStruct ds, Map<DocStruct, Integer> index) {
        return List.copyOf(new TreeSet<>(targets(ds).stream().map(index::get).filter(Objects::nonNull).toList()));
    }

    /** Smallest and largest page of the structure and all its descendants, or {@code null} if there is none. */
    public static int[] subtreeRange(DocStruct ds, Map<DocStruct, Integer> index) {
        TreeSet<Integer> pages = new TreeSet<>();
        collect(ds, index, pages);
        return pages.isEmpty() ? null : new int[] { pages.first(), pages.last() };
    }

    public static List<DocStruct> children(DocStruct ds) {
        return ds == null || ds.getAllChildren() == null ? List.of() : new ArrayList<>(ds.getAllChildren());
    }

    private static void collect(DocStruct ds, Map<DocStruct, Integer> index, TreeSet<Integer> pages) {
        pages.addAll(ownPages(ds, index));
        children(ds).forEach(child -> collect(child, index, pages));
    }
}
