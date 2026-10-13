package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.Collections;
import java.util.HashMap;
import java.util.IdentityHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import ugh.dl.DocStruct;

/** Ids for the DocStructs that are shown as blocks. Ids are never reused within a session, so stale ids cannot match. */
public class DocStructRegistry {
    private final Map<DocStruct, String> ids = new IdentityHashMap<>();
    private final Map<String, DocStruct> byId = new HashMap<>();
    private int counter;

    public String register(DocStruct docStruct) {
        return ids.computeIfAbsent(docStruct, ds -> {
            String id = "b" + (++counter);
            byId.put(id, ds);
            return id;
        });
    }

    public Optional<DocStruct> get(String id) {
        return Optional.ofNullable(id == null ? null : byId.get(id));
    }

    public boolean isBlock(DocStruct docStruct) {
        return ids.containsKey(docStruct);
    }

    public Set<String> ids() {
        return Collections.unmodifiableSet(byId.keySet());
    }

    public void clear() {
        ids.clear();
        byId.clear();
    }
}
