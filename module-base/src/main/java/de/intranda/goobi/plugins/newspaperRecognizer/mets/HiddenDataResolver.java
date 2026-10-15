package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.ArrayList;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenAction;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenConflictKind;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenOperation;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import ugh.dl.DocStruct;

/**
 * Decides what happens to hidden data on save, following the shared rules in the implementation plan (mirrored by
 * {@code logic/hidden.mjs}). Throws before anything is changed if a decision is missing.
 */
public class HiddenDataResolver {
    private final RulesetTypes ruleset;
    private final PluginConfiguration config;

    public HiddenDataResolver(RulesetTypes ruleset, PluginConfiguration config) {
        this.ruleset = ruleset;
        this.config = config;
    }

    private record Home(BlockNode block) {
    }

    public Resolution resolve(String volumeType, DocStructRegistry registry, List<BlockNode> roots, List<HiddenOperation> operations,
            Map<DocStruct, Integer> pageIndex) throws UnresolvedHiddenDataException {
        Map<String, BlockNode> nodes = new HashMap<>();
        for (BlockNode node : BlockTree.flatten(roots)) {
            if (node.id() != null) {
                nodes.put(node.id(), node);
            }
        }
        Map<String, Map<HiddenConflictKind, HiddenAction>> chosen = new HashMap<>();
        for (HiddenOperation operation : operations == null ? List.<HiddenOperation> of() : operations) {
            chosen.computeIfAbsent(operation.getBlockId(), k -> new EnumMap<>(HiddenConflictKind.class)).put(operation.getKind(), operation.getAction());
        }
        List<HiddenStep> steps = new ArrayList<>();
        List<String> problems = new ArrayList<>();
        for (String id : new TreeSet<>(registry.ids())) {
            DocStruct ds = registry.get(id).orElseThrow();
            String oldType = ds.getType().getName();
            List<DocStruct> structures = PageIndex.children(ds).stream().filter(child -> !registry.isBlock(child)).toList();
            List<Object> metadata = MetadataAccess.hidden(ds, config.managedMetadata(oldType, ruleset));
            List<Object> userValues = notAllowedUserValues(ds, oldType, nodes.get(id));
            if (structures.isEmpty() && metadata.isEmpty() && userValues.isEmpty()) {
                continue;
            }
            Map<HiddenConflictKind, HiddenAction> ops = chosen.getOrDefault(id, Map.of());
            String label = describe(ds, pageIndex);
            if (ops.get(HiddenConflictKind.EXPLICIT) == HiddenAction.REMOVE_ALL) {
                removeAll(ds, structures, metadata, steps);
                continue;
            }
            BlockNode node = nodes.get(id);
            if (node == null) {
                HiddenAction action = ops.get(HiddenConflictKind.DELETED);
                if (action == HiddenAction.REMOVE_ALL) {
                    structures.forEach(s -> steps.add(new HiddenStep.RemoveStructure(s)));
                } else if (action == HiddenAction.REHOME) {
                    rehome(structures, label, volumeType, roots, pageIndex, steps, problems);
                } else {
                    problems.add("Removed " + label + " contains additional data");
                }
                continue;
            }
            List<DocStruct> remaining = new ArrayList<>(structures);
            if (node.type() != null && !node.type().equals(oldType)) {
                List<DocStruct> badStructures = structures.stream().filter(s -> !ruleset.isAllowedChild(node.type(), s.getType().getName())).toList();
                List<Object> badMetadata = new ArrayList<>(metadata.stream().filter(m -> !ruleset.allowsEntry(node.type(), m)).toList());
                badMetadata.addAll(userValues);
                // hidden metadata the new type manages would be overwritten (or removed) by the writer
                for (Object entry : managedByNewType(ds, oldType, node.type())) {
                    if (badMetadata.stream().noneMatch(b -> b == entry)) {
                        badMetadata.add(entry);
                    }
                }
                if (!badStructures.isEmpty() || !badMetadata.isEmpty()) {
                    HiddenAction action = ops.get(HiddenConflictKind.TYPE);
                    if (action == HiddenAction.REMOVE_ALL) {
                        List<Object> all = new ArrayList<>(metadata);
                        all.addAll(userValues);
                        removeAll(ds, structures, all, steps);
                        continue;
                    }
                    if (action != HiddenAction.KEEP_ALLOWED) {
                        problems.add("The new type of " + label + " does not allow its additional data");
                        continue;
                    }
                    badStructures.forEach(s -> steps.add(new HiddenStep.RemoveStructure(s)));
                    badMetadata.forEach(m -> steps.add(new HiddenStep.RemoveMetadata(ds, m)));
                    remaining.removeIf(s -> badStructures.stream().anyMatch(b -> b == s));
                }
            }
            // only structures that were inside the block as loaded; structures already outside stay as they are
            List<Integer> loadedPages = PageIndex.ownPages(ds, pageIndex);
            List<DocStruct> outside = remaining.stream().filter(s -> {
                int[] range = PageIndex.subtreeRange(s, pageIndex);
                boolean wasInside = range != null && !loadedPages.isEmpty() && loadedPages.get(0) <= range[0]
                        && range[1] <= loadedPages.get(loadedPages.size() - 1);
                return wasInside && !node.contains(range[0], range[1]);
            }).toList();
            if (outside.isEmpty()) {
                continue;
            }
            HiddenAction action = ops.get(HiddenConflictKind.BOUNDARY);
            if (action == HiddenAction.SHORTEN) {
                for (DocStruct structure : outside) {
                    int[] range = PageIndex.subtreeRange(structure, pageIndex);
                    if (range[1] < node.getFirstPage() || range[0] > node.getLastPage()) {
                        steps.add(new HiddenStep.RemoveStructure(structure));
                    } else {
                        steps.add(new HiddenStep.Shorten(structure, node.getFirstPage(), node.getLastPage()));
                    }
                }
            } else if (action == HiddenAction.REHOME) {
                rehome(outside, label, volumeType, roots, pageIndex, steps, problems);
            } else {
                problems.add("The new pages of " + label + " leave additional structures outside the block");
            }
        }
        if (!problems.isEmpty()) {
            throw new UnresolvedHiddenDataException(problems);
        }
        return new Resolution(steps);
    }

    /** On a type change: the stored values the user entered in fields the new type does not allow. */
    private List<Object> notAllowedUserValues(DocStruct ds, String oldType, BlockNode node) {
        if (node == null || node.type() == null || node.type().equals(oldType)) {
            return List.of();
        }
        List<Object> result = new ArrayList<>();
        for (String key : config.userValuesLeftBehind(oldType, node.type(), node.getStart().getValues(), ruleset).keySet()) {
            if (!ruleset.allowsMetadata(node.type(), key)) {
                MetadataAccess.first(ds, key).ifPresent(result::add);
            }
        }
        return result;
    }

    /** The first instance of every metadata type the new type manages but the old one did not: the writer replaces it. */
    private List<Object> managedByNewType(DocStruct ds, String oldType, String newType) {
        Set<String> types = new LinkedHashSet<>(config.managedMetadata(newType, ruleset));
        types.removeAll(config.managedMetadata(oldType, ruleset));
        List<Object> result = new ArrayList<>();
        for (String type : types) {
            MetadataAccess.first(ds, type).ifPresent(result::add);
        }
        return result;
    }

    private static void removeAll(DocStruct ds, List<DocStruct> structures, List<Object> metadata, List<HiddenStep> steps) {
        structures.forEach(s -> steps.add(new HiddenStep.RemoveStructure(s)));
        metadata.forEach(m -> steps.add(new HiddenStep.RemoveMetadata(ds, m)));
    }

    private void rehome(List<DocStruct> structures, String label, String volumeType, List<BlockNode> roots, Map<DocStruct, Integer> pageIndex,
            List<HiddenStep> steps, List<String> problems) {
        for (DocStruct structure : structures) {
            Optional<Home> home = home(structure, volumeType, roots, pageIndex);
            if (home.isPresent()) {
                steps.add(new HiddenStep.Rehome(structure, home.get().block()));
            } else {
                problems.add("No place for the additional " + structure.getType().getName() + " of " + label);
            }
        }
    }

    /** The deepest typed block covering all pages of the structure and allowing its type; else the volume if it allows it. */
    private Optional<Home> home(DocStruct structure, String volumeType, List<BlockNode> roots, Map<DocStruct, Integer> pageIndex) {
        int[] range = PageIndex.subtreeRange(structure, pageIndex);
        if (range == null) {
            return Optional.empty();
        }
        String type = structure.getType().getName();
        BlockNode best = null;
        for (BlockNode node : BlockTree.flatten(roots)) {
            if (node.type() != null && node.contains(range[0], range[1]) && ruleset.isAllowedChild(node.type(), type)
                    && (best == null || node.getLevel() > best.getLevel())) {
                best = node;
            }
        }
        if (best != null) {
            return Optional.of(new Home(best));
        }
        return ruleset.isAllowedChild(volumeType, type) ? Optional.of(new Home(null)) : Optional.empty();
    }

    private static String describe(DocStruct ds, Map<DocStruct, Integer> pageIndex) {
        List<Integer> pages = PageIndex.ownPages(ds, pageIndex);
        String where = pages.isEmpty() ? "without pages" : "on pages " + (pages.get(0) + 1) + "-" + (pages.get(pages.size() - 1) + 1);
        return ds.getType().getName() + " " + where;
    }
}
