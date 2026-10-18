package de.intranda.goobi.plugins.newspaperRecognizer;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.IntStream;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldDefinition;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PaginationConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.config.PluginConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.FileSet;
import ugh.dl.Metadata;
import ugh.dl.Prefs;
import ugh.dl.Reference;
import ugh.exceptions.PreferencesException;
import ugh.exceptions.UGHException;

/** Test fixtures shared by the plugin tests. */
public final class TestDocuments {
    public static final FieldConfiguration FIELDS = new FieldConfiguration("DateIssued", "dd.MM.yyyy", "yyyy-MM-dd", "CurrentNo",
            "PartNumber");

    private static Prefs strict;
    private static Prefs permissive;

    private TestDocuments() {
    }

    public static synchronized Prefs prefs() {
        if (strict == null) {
            strict = load("src/test/resources/ruleset_test.xml");
        }
        return strict;
    }

    public static synchronized Prefs permissivePrefs() {
        if (permissive == null) {
            permissive = load("src/test/resources/ruleset_test_permissive.xml");
        }
        return permissive;
    }

    public static RulesetTypes ruleset() {
        return new RulesetTypes(prefs(), FIELDS);
    }

    private static Prefs load(String path) {
        try {
            Prefs prefs = new Prefs();
            prefs.loadPrefs(path);
            return prefs;
        } catch (PreferencesException e) {
            throw new IllegalStateException("Unable to load test ruleset " + path, e);
        }
    }

    public static BlockStart start(String id, String type) {
        BlockStart start = new BlockStart();
        start.setId(id);
        start.setType(type);
        return start;
    }

    public static NewspaperPage page(String filename, int depth, BlockStart... starts) {
        NewspaperPage page = new NewspaperPage();
        page.setFilename(filename);
        page.setDepth(depth);
        page.setStarts(new ArrayList<>(List.of(starts)));
        return page;
    }
    /** FIELDS plus a title template for MorningIssue. */
    public static PluginConfiguration config(boolean preventDuplicates) {
        return config(preventDuplicates, true);
    }

    public static List<String> filenames(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> String.format("%04d.tif", i)).toList();
    }

    /** A NewspaperVolume below a Newspaper anchor, with a BoundBook of {@code count} pages that the volume references. */
    public static DigitalDocument volume(Prefs prefs, int count) {
        try {
            DigitalDocument dd = new DigitalDocument();
            DocStruct anchor = dd.createDocStruct(prefs.getDocStrctTypeByName("Newspaper"));
            DocStruct volume = dd.createDocStruct(prefs.getDocStrctTypeByName("NewspaperVolume"));
            anchor.addChild(volume);
            dd.setLogicalDocStruct(anchor);
            DocStruct boundBook = dd.createDocStruct(prefs.getDocStrctTypeByName("BoundBook"));
            dd.setPhysicalDocStruct(boundBook);
            dd.setFileSet(new FileSet());
            int number = 1;
            for (String filename : filenames(count)) {
                DocStruct page = dd.createDocStruct(prefs.getDocStrctTypeByName("page"));
                page.setImageName(filename);
                boundBook.addChild(page);
                addMetadata(prefs, page, "physPageNumber", String.valueOf(number));
                addMetadata(prefs, page, "logicalPageNumber", String.valueOf(number++));
                volume.addReferenceTo(page, "logical_physical");
            }
            return dd;
        } catch (UGHException e) {
            throw new IllegalStateException(e);
        }
    }

    public static DocStruct volumeOf(DigitalDocument dd) {
        return dd.getLogicalDocStruct().getAllChildren().get(0);
    }

    public static DocStruct pageOf(DigitalDocument dd, int index) {
        return dd.getPhysicalDocStruct().getAllChildren().get(index);
    }

    /** Adds a structure of {@code type} below {@code parent} that references the pages with the given indices. */
    public static DocStruct add(Prefs prefs, DigitalDocument dd, DocStruct parent, String type, int... pages) {
        try {
            DocStruct ds = dd.createDocStruct(prefs.getDocStrctTypeByName(type));
            parent.addChild(ds);
            for (int page : pages) {
                ds.addReferenceTo(pageOf(dd, page), "logical_physical");
            }
            return ds;
        } catch (UGHException e) {
            throw new IllegalStateException(e);
        }
    }

    public static void addMetadata(Prefs prefs, DocStruct ds, String type, String value) {
        try {
            Metadata metadata = new Metadata(prefs.getMetadataTypeByName(type));
            metadata.setValue(value);
            ds.addMetadata(metadata);
        } catch (UGHException e) {
            throw new IllegalStateException(e);
        }
    }

    /** A readable dump of the logical tree (types, metadata in order, referenced images) and the physical pages. */
    public static String snapshot(DigitalDocument dd) {
        StringBuilder result = new StringBuilder();
        dump(dd.getLogicalDocStruct(), 0, result);
        for (DocStruct page : dd.getPhysicalDocStruct().getAllChildren()) {
            result.append("page ").append(page.getImageName()).append(' ').append(metadata(page)).append('\n');
        }
        return result.toString();
    }

    private static void dump(DocStruct ds, int depth, StringBuilder result) {
        result.append("  ".repeat(depth)).append(ds.getType().getName()).append(' ').append(metadata(ds)).append(" pages=")
                .append(ds.getAllToReferences("logical_physical") == null ? List.of()
                        : ds.getAllToReferences("logical_physical").stream().map(Reference::getTarget).map(DocStruct::getImageName).toList())
                .append('\n');
        if (ds.getAllChildren() != null) {
            for (DocStruct child : ds.getAllChildren()) {
                dump(child, depth + 1, result);
            }
        }
    }

    private static List<String> metadata(DocStruct ds) {
        return ds.getAllMetadata() == null ? List.of()
                : ds.getAllMetadata().stream().map(m -> m.getType().getName() + "=" + m.getValue()).toList();
    }
    public static PluginConfiguration config(boolean preventDuplicates, boolean createNewPagination) {
        return new PluginConfiguration(true, false, preventDuplicates, new PaginationConfiguration(createNewPagination, true, List.of("–"), Map.of()), FIELDS,
                List.of(), Map.of("MorningIssue", List.of(FieldDefinition.of("TitleDocMain", "Morgenausgabe {partNo}", true, false))), List.of());
    }

    /** FIELDS with the given metadata fields. */
    public static PluginConfiguration config(List<FieldDefinition> defaults, Map<String, List<FieldDefinition>> types) {
        return new PluginConfiguration(true, false, false, new PaginationConfiguration(false, true, List.of("–"), Map.of()), FIELDS, defaults, types, List.of());
    }
}
