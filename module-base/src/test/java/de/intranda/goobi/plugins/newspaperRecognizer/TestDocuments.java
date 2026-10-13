package de.intranda.goobi.plugins.newspaperRecognizer;

import java.util.ArrayList;
import java.util.List;

import de.intranda.goobi.plugins.newspaperRecognizer.config.FieldConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;
import ugh.dl.Prefs;
import ugh.exceptions.PreferencesException;

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
}
