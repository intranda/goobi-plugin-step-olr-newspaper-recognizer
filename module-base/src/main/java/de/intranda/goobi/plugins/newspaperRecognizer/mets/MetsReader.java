package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.apache.commons.lang3.StringUtils;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldDefinition;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenMetadataInfo;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenStructureInfo;
import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenSummary;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.Notice;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;

/** Turns the volume's logical structure into the page list for the frontend. Never changes the document. */
public class MetsReader {
    private static final String TITLE_METADATA = "TitleDocMain";

    private final RulesetTypes ruleset;
    private final PluginConfiguration config;
    private final String language;
    private final DateTimeFormatter storeFormat;

    public MetsReader(RulesetTypes ruleset, PluginConfiguration config, String language) {
        this.ruleset = ruleset;
        this.config = config;
        this.language = language;
        this.storeFormat = formatter(config.fields().storeFormat());
    }

    private record Placed(DocStruct docStruct, String type, int first, int last) {
    }

    public ReadResult read(DigitalDocument dd, List<String> filenames, DocStructRegistry registry) {
        registry.clear();
        DocStruct volume = VolumeLocator.find(dd);
        Map<DocStruct, Integer> index = PageIndex.of(dd, filenames);
        List<Notice> notices = new ArrayList<>();
        AtomicInteger keys = new AtomicInteger();
        List<NewspaperPage> pages = new ArrayList<>();
        for (String filename : filenames) {
            NewspaperPage page = new NewspaperPage();
            page.setFilename(filename);
            pages.add(page);
        }

        List<Placed> blocks = place(PageIndex.children(volume), volume.getType().getName(), 0, filenames.size() - 1, index);
        HiddenSummary volumeHidden = new HiddenSummary();
        for (DocStruct child : notPlaced(volume, blocks)) {
            volumeHidden.getStructures().add(structureInfo(child, index, keys));
        }
        if (!volumeHidden.getStructures().isEmpty()) {
            notices.add(new Notice("plugin_newspaperRecognizer_notice_volumeHidden", List.of(String.valueOf(volumeHidden.getStructures().size()))));
        }
        for (Placed block : blocks) {
            List<Placed> children = place(PageIndex.children(block.docStruct()), block.type(), block.first(), block.last(), index);
            addStart(pages, block, 1, notPlaced(block.docStruct(), children), registry, index, notices, keys);
            for (Placed child : children) {
                addStart(pages, child, 2, PageIndex.children(child.docStruct()), registry, index, notices, keys);
            }
        }
        return new ReadResult(pages, volumeHidden, notices);
    }

    /** The children that become blocks, in page order. */
    private List<Placed> place(List<DocStruct> candidates, String parentType, int min, int max, Map<DocStruct, Integer> index) {
        List<Placed> possible = new ArrayList<>();
        for (DocStruct candidate : candidates) {
            String type = candidate.getType().getName();
            List<Integer> own = PageIndex.ownPages(candidate, index);
            if (!ruleset.isAllowedChild(parentType, type) || own.isEmpty()) {
                continue;
            }
            int first = own.get(0);
            int last = own.get(own.size() - 1);
            if (last - first + 1 == own.size() && first >= min && last <= max) {
                possible.add(new Placed(candidate, type, first, last));
            }
        }
        possible.sort(Comparator.comparingInt(Placed::first));
        List<Placed> accepted = new ArrayList<>();
        for (Placed candidate : possible) {
            if (accepted.isEmpty() || candidate.first() > accepted.get(accepted.size() - 1).last()) {
                accepted.add(candidate);
            }
        }
        return accepted;
    }

    private static List<DocStruct> notPlaced(DocStruct parent, List<Placed> placed) {
        return PageIndex.children(parent).stream().filter(child -> placed.stream().noneMatch(p -> p.docStruct() == child)).toList();
    }

    private void addStart(List<NewspaperPage> pages, Placed block, int depth, List<DocStruct> hidden, DocStructRegistry registry,
            Map<DocStruct, Integer> index, List<Notice> notices, AtomicInteger keys) {
        pages.get(block.first()).getStarts().add(toStart(block, hidden, registry, index, notices, keys));
        for (int i = block.first(); i <= block.last(); i++) {
            pages.get(i).setDepth(depth);
        }
    }

    private BlockStart toStart(Placed block, List<DocStruct> hidden, DocStructRegistry registry, Map<DocStruct, Integer> index,
            List<Notice> notices, AtomicInteger keys) {
        DocStruct ds = block.docStruct();
        String type = block.type();
        FieldConfiguration fields = config.fields();
        BlockStart start = new BlockStart();
        start.setId(registry.register(ds));
        start.setType(type);
        if (ruleset.isDated(type)) {
            String raw = MetadataAccess.firstValue(ds, fields.dateMetadata());
            if (StringUtils.isNotBlank(raw)) {
                LocalDate date = parse(raw);
                if (date != null) {
                    start.setDate(date.toString());
                } else {
                    start.setDateRaw(raw);
                    notices.add(new Notice("plugin_newspaperRecognizer_notice_unparsableDate",
                            List.of(ruleset.label(type, language), String.valueOf(block.first() + 1), raw)));
                }
            }
        }
        if (ruleset.isNumbered(type)) {
            String number = StringUtils.trimToNull(MetadataAccess.firstValue(ds, fields.numberMetadata()));
            start.setNumber(number);
            String part = number != null && ruleset.isPartNumbered(type) ? MetadataAccess.firstValue(ds, fields.partNumberMetadata()) : null;
            int at = part == null ? -1 : part.indexOf(number);
            if (at >= 0) {
                start.setPrefix(at > 0 ? part.substring(0, at) : null);
                String suffix = part.substring(at + number.length());
                start.setSuffix(suffix.isEmpty() ? null : suffix);
            }
        }
        HiddenSummary summary = new HiddenSummary();
        hidden.forEach(structure -> summary.getStructures().add(structureInfo(structure, index, keys)));
        for (FieldDefinition field : config.visibleFieldsFor(type, ruleset)) {
            String value = MetadataAccess.firstValue(ds, field.key());
            if (value != null) {
                start.getValues().put(field.key(), value);
            }
        }
        for (Object entry : MetadataAccess.hidden(ds, config.managedMetadata(type, ruleset))) {
            String entryType = MetadataAccess.typeName(entry);
            summary.getMetadata().add(new HiddenMetadataInfo("m" + keys.incrementAndGet(), entryType, ruleset.metadataLabel(entryType, language),
                    MetadataAccess.value(entry)));
        }
        start.setHidden(summary);
        return start;
    }

    private HiddenStructureInfo structureInfo(DocStruct ds, Map<DocStruct, Integer> index, AtomicInteger keys) {
        int[] range = PageIndex.subtreeRange(ds, index);
        String type = ds.getType().getName();
        return new HiddenStructureInfo("h" + keys.incrementAndGet(), type, ruleset.label(type, language), range == null ? -1 : range[0],
                range == null ? -1 : range[1], MetadataAccess.firstValue(ds, TITLE_METADATA));
    }

    private LocalDate parse(String raw) {
        if (storeFormat == null) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim(), storeFormat);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static DateTimeFormatter formatter(String pattern) {
        try {
            return DateTimeFormatter.ofPattern(pattern);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
