package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.config.MetadataTemplate;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenOperation;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockTree;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import lombok.extern.log4j.Log4j2;
import ugh.dl.ContentFileReference;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.FileSet;
import ugh.dl.Metadata;
import ugh.dl.Reference;
import ugh.dl.RomanNumeral;
import ugh.exceptions.UGHException;

/** Updates the document in place so that its logical structure matches the blocks. Data the plugin does not manage stays. */
@Log4j2
public class MetsWriter {
    private static final String PAGE_TYPE = "page";
    private static final String PHYS_PAGE_NO = "physPageNumber";
    private static final String LOG_PAGE_NO = "logicalPageNumber";
    private static final String UNCOUNTED = "uncounted";

    private final RulesetTypes ruleset;
    private final PluginConfiguration config;
    private final HiddenDataResolver resolver;
    private final ValueGenerator values;

    public MetsWriter(RulesetTypes ruleset, PluginConfiguration config) {
        this.ruleset = ruleset;
        this.config = config;
        this.resolver = new HiddenDataResolver(ruleset, config);
        this.values = new ValueGenerator(ruleset);
    }

    public void apply(DigitalDocument dd, DocStructRegistry registry, List<BlockNode> roots, List<HiddenOperation> operations,
            List<String> filenames) throws UnresolvedHiddenDataException, UGHException {
        long startTime = System.nanoTime();
        DocStruct volume = VolumeLocator.find(dd);
        Resolution resolution = resolver.resolve(volume.getType().getName(), registry, roots, operations, PageIndex.of(dd, filenames));

        List<DocStruct> pages = reconcilePages(dd, filenames);
        Map<BlockNode, DocStruct> written = new IdentityHashMap<>();
        for (BlockNode node : BlockTree.flatten(roots)) {
            DocStruct parent = node.getParent() == null ? volume : written.get(node.getParent());
            written.put(node, writeBlock(dd, registry, node, parent, pages));
        }
        applySteps(resolution, written, volume, pages);
        Set<DocStruct> kept = Collections.newSetFromMap(new IdentityHashMap<>());
        kept.addAll(written.values());
        for (String id : registry.ids()) {
            DocStruct old = registry.get(id).orElseThrow();
            if (!kept.contains(old)) {
                detach(old);
            }
        }
        for (DocStruct page : pages) {
            if (PageIndex.targets(volume).stream().noneMatch(t -> t == page)) {
                volume.addReferenceTo(page, PageIndex.LOGICAL_PHYSICAL);
            }
        }
        Map<DocStruct, Integer> index = PageIndex.of(dd, filenames);
        sortChildren(volume, kept, index);
        for (DocStruct ds : written.values()) {
            sortChildren(ds, kept, index);
        }
        writePagination(roots, pages);
        log.info("Updated the METS structure for {} pages in {} ms", pages.size(), (System.nanoTime() - startTime) / 1_000_000);
    }

    private List<DocStruct> reconcilePages(DigitalDocument dd, List<String> filenames) throws UGHException {
        DocStruct boundBook = dd.getPhysicalDocStruct();
        if (dd.getFileSet() == null) {
            dd.setFileSet(new FileSet());
        }
        Set<String> wanted = new HashSet<>(filenames);
        Map<String, DocStruct> byName = new HashMap<>();
        for (DocStruct page : PageIndex.children(boundBook)) {
            String name = page.getImageName();
            if (name == null || !wanted.contains(name) || byName.containsKey(name)) {
                removePage(dd, boundBook, page);
            } else {
                byName.put(name, page);
            }
        }
        List<DocStruct> result = new ArrayList<>();
        for (int i = 0; i < filenames.size(); i++) {
            DocStruct page = byName.get(filenames.get(i));
            if (page == null) {
                page = dd.createDocStruct(ruleset.docStructType(PAGE_TYPE));
                page.setImageName(filenames.get(i));
                boundBook.addChild(page);
                dd.addContentFileFromPhysicalPage(page);
                if (!config.pagination().createNewPagination()) {
                    MetadataAccess.setFirst(page, ruleset.metadataType(LOG_PAGE_NO), UNCOUNTED);
                }
            }
            if (boundBook.getPositionofChild(page) != i) {
                boundBook.moveChild(page, i);
            }
            MetadataAccess.setFirst(page, ruleset.metadataType(PHYS_PAGE_NO), String.valueOf(i + 1));
            result.add(page);
        }
        return result;
    }

    private static void removePage(DigitalDocument dd, DocStruct boundBook, DocStruct page) {
        List<Reference> from = page.getAllFromReferences(PageIndex.LOGICAL_PHYSICAL);
        if (from != null) {
            for (Reference reference : new ArrayList<>(from)) {
                reference.getSource().removeReferenceTo(page);
            }
        }
        if (page.getAllContentFileReferences() != null) {
            for (ContentFileReference reference : new ArrayList<>(page.getAllContentFileReferences())) {
                dd.getFileSet().removeFile(reference.getCf());
            }
        }
        boundBook.removeChild(page);
    }

    private DocStruct writeBlock(DigitalDocument dd, DocStructRegistry registry, BlockNode node, DocStruct parent, List<DocStruct> pages)
            throws UGHException {
        DocStruct ds = registry.get(node.id()).orElse(null);
        if (ds == null) {
            ds = dd.createDocStruct(ruleset.docStructType(node.type()));
        } else if (!ds.getType().getName().equals(node.type())) {
            Set<String> stale = new HashSet<>(config.managedMetadata(ds.getType().getName(), ruleset));
            stale.removeAll(config.managedMetadata(node.type(), ruleset));
            for (String metadata : stale) {
                Optional<Metadata> old = MetadataAccess.first(ds, metadata);
                if (old.isPresent()) {
                    ds.removeMetadata(old.get(), true);
                }
            }
            ds.setType(ruleset.docStructType(node.type()));
        }
        if (ds.getParent() != parent) {
            if (ds.getParent() != null) {
                ds.getParent().removeChild(ds);
            }
            parent.addChild(ds);
        }
        writeManagedMetadata(ds, node);
        setReferences(ds, pages.subList(node.getFirstPage(), node.getLastPage() + 1));
        return ds;
    }

    private void writeManagedMetadata(DocStruct ds, BlockNode node) throws UGHException {
        String type = node.type();
        FieldConfiguration fields = config.fields();
        if (ruleset.isDated(type)) {
            String date = node.date().map(d -> DateTimeFormatter.ofPattern(fields.storeFormat()).format(d)).orElse(null);
            MetadataAccess.setFirst(ds, ruleset.metadataType(fields.dateMetadata()), date);
        }
        String storedNumber = fields.numberMetadata() == null ? null : StringUtils.trimToNull(MetadataAccess.firstValue(ds, fields.numberMetadata()));
        if (ruleset.isNumbered(type)) {
            MetadataAccess.setFirst(ds, ruleset.metadataType(fields.numberMetadata()), StringUtils.trimToNull(node.getStart().getNumber()));
        }
        // the part number is derived from the number; without any number (now or stored) a part number from elsewhere stays
        if (ruleset.isPartNumbered(type) && (StringUtils.isNotBlank(node.getStart().getNumber()) || storedNumber != null)) {
            MetadataAccess.setFirst(ds, ruleset.metadataType(fields.partNumberMetadata()), ValueGenerator.partNumber(node.getStart()));
        }
        for (MetadataTemplate template : config.templatesFor(type)) {
            MetadataAccess.setFirst(ds, ruleset.metadataType(template.key()), values.generate(template, node).orElse(null));
        }
    }

    private static void setReferences(DocStruct ds, List<DocStruct> desired) {
        Set<DocStruct> wanted = Collections.newSetFromMap(new IdentityHashMap<>());
        wanted.addAll(desired);
        Set<DocStruct> present = Collections.newSetFromMap(new IdentityHashMap<>());
        for (DocStruct target : PageIndex.targets(ds)) {
            if (wanted.contains(target)) {
                present.add(target);
            } else {
                ds.removeReferenceTo(target);
            }
        }
        for (DocStruct page : desired) {
            if (!present.contains(page)) {
                ds.addReferenceTo(page, PageIndex.LOGICAL_PHYSICAL);
            }
        }
    }

    private static void applySteps(Resolution resolution, Map<BlockNode, DocStruct> written, DocStruct volume, List<DocStruct> pages)
            throws UGHException {
        for (HiddenStep step : resolution.steps()) {
            switch (step) {
                case HiddenStep.RemoveStructure s -> detach(s.structure());
                case HiddenStep.RemoveMetadata m -> MetadataAccess.remove(m.owner(), m.entry());
                case HiddenStep.Shorten s -> shorten(s.structure(), pages.subList(s.firstPage(), s.lastPage() + 1));
                case HiddenStep.Rehome r -> {
                    DocStruct target = r.target() == null ? volume : written.get(r.target());
                    r.structure().getParent().removeChild(r.structure());
                    target.addChild(r.structure());
                }
            }
        }
    }

    /** Removes the structure and all references of its subtree. */
    private static void detach(DocStruct ds) {
        for (DocStruct child : PageIndex.children(ds)) {
            detach(child);
        }
        for (DocStruct target : PageIndex.targets(ds)) {
            ds.removeReferenceTo(target);
        }
        if (ds.getParent() != null) {
            ds.getParent().removeChild(ds);
        }
    }

    private static void shorten(DocStruct ds, List<DocStruct> allowed) {
        for (DocStruct target : PageIndex.targets(ds)) {
            if (allowed.stream().noneMatch(page -> page == target)) {
                ds.removeReferenceTo(target);
            }
        }
        PageIndex.children(ds).forEach(child -> shorten(child, allowed));
    }

    /**
     * Puts the blocks among the children into page order. Every other child (hidden data) keeps its position: the blocks are
     * only redistributed over the positions blocks already occupy.
     */
    private static void sortChildren(DocStruct parent, Set<DocStruct> blocks, Map<DocStruct, Integer> index) {
        List<DocStruct> children = PageIndex.children(parent);
        List<Integer> slots = new ArrayList<>();
        List<DocStruct> sorted = new ArrayList<>();
        for (int i = 0; i < children.size(); i++) {
            if (blocks.contains(children.get(i))) {
                slots.add(i);
                sorted.add(children.get(i));
            }
        }
        sorted.sort(Comparator.comparingInt(block -> {
            int[] range = PageIndex.subtreeRange(block, index);
            return range == null ? Integer.MAX_VALUE : range[0];
        }));
        for (int i = 0; i < sorted.size(); i++) {
            if (parent.getPositionofChild(sorted.get(i)) != slots.get(i)) {
                parent.moveChild(sorted.get(i), slots.get(i));
            }
        }
    }

    private void writePagination(List<BlockNode> roots, List<DocStruct> pages) throws UGHException {
        if (!config.pagination().createNewPagination()) {
            return;
        }
        int[] firstOfInnermost = new int[pages.size()];
        int runStart = 0;
        for (int i = 0; i < pages.size(); i++) {
            firstOfInnermost[i] = -1;
        }
        for (BlockNode node : BlockTree.flatten(roots)) {
            for (int i = node.getFirstPage(); i <= node.getLastPage(); i++) {
                firstOfInnermost[i] = node.getFirstPage();
            }
        }
        for (int i = 0; i < pages.size(); i++) {
            if (firstOfInnermost[i] < 0) {
                runStart = i > 0 && firstOfInnermost[i - 1] < 0 ? runStart : i;
            }
            int first = firstOfInnermost[i] < 0 ? runStart : firstOfInnermost[i];
            MetadataAccess.setFirst(pages.get(i), ruleset.metadataType(LOG_PAGE_NO), formatPagination(String.valueOf(i - first + 1)));
        }
    }

    // unchanged from the old MetsWriter: pagination type "1", "i", "I", blank or "-", optional fake pagination [N]
    private String formatPagination(String pagination) {
        String paginationType = config.pagination().type();
        if (StringUtils.isBlank(paginationType) || "-".equals(paginationType)) {
            return "";
        }
        String value = pagination.replace("[", "").replace("]", "");
        boolean isArabic = Pattern.matches("\\d+", value);
        int num;
        RomanNumeral roman;
        if (isArabic) {
            num = Integer.parseInt(value);
            roman = new RomanNumeral(num);
        } else {
            roman = new RomanNumeral(value.toUpperCase());
            num = roman.intValue();
        }
        String formatted = switch (paginationType) {
            case "1" -> String.valueOf(num);
            case "i" -> roman.getNumber().toLowerCase();
            case "I" -> roman.getNumber();
            default -> value;
        };
        return config.pagination().useFakePagination() ? "[" + formatted + "]" : formatted;
    }
}
