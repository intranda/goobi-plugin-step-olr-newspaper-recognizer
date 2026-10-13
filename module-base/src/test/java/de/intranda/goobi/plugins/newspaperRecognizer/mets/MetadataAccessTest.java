package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.add;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.addMetadata;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volume;
import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.volumeOf;
import static org.junit.Assert.assertEquals;

import java.util.List;
import java.util.Set;

import org.junit.Test;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;
import ugh.dl.Prefs;

public class MetadataAccessTest {
    private final Prefs prefs = TestDocuments.prefs();

    private DocStruct issue() {
        DigitalDocument dd = volume(prefs, 1);
        DocStruct issue = add(prefs, dd, volumeOf(dd), "MorningIssue", 0);
        addMetadata(prefs, issue, "CurrentNo", "12");
        addMetadata(prefs, issue, "Note", "n");
        addMetadata(prefs, issue, "CurrentNo", "13");
        return issue;
    }

    @Test
    public void hidden_allButFirstInstanceOfManagedTypes() {
        List<Object> hidden = MetadataAccess.hidden(issue(), Set.of("CurrentNo", "DateIssued"));
        assertEquals(List.of("Note=n", "CurrentNo=13"), hidden.stream().map(e -> MetadataAccess.typeName(e) + "=" + MetadataAccess.value(e)).toList());
    }

    @Test
    public void setFirst_replacesValueInPlace_addsWhenMissing_removesOnNull() throws Exception {
        DocStruct issue = issue();
        MetadataAccess.setFirst(issue, prefs.getMetadataTypeByName("CurrentNo"), "20");
        MetadataAccess.setFirst(issue, prefs.getMetadataTypeByName("DateIssued"), "1890-03-01");
        MetadataAccess.setFirst(issue, prefs.getMetadataTypeByName("Note"), null);
        assertEquals(List.of("CurrentNo=20", "CurrentNo=13", "DateIssued=1890-03-01"),
                issue.getAllMetadata().stream().map(m -> m.getType().getName() + "=" + m.getValue()).toList());
    }

    @Test
    public void setFirstNull_andRemove_alsoRemoveRequiredMetadata() throws Exception {
        // UGH's plain removeMetadata(md) silently keeps the last instance of a required ("1m") metadata
        DocStruct issue = issue();
        addMetadata(prefs, issue, "DateIssued", "1890-03-01");
        MetadataAccess.setFirst(issue, prefs.getMetadataTypeByName("DateIssued"), null);
        assertEquals(List.of(), issue.getAllMetadata().stream().filter(m -> m.getType().getName().equals("DateIssued")).toList());
        addMetadata(prefs, issue, "DateIssued", "1890-03-02");
        MetadataAccess.remove(issue, MetadataAccess.first(issue, "DateIssued").orElseThrow());
        assertEquals(List.of(), issue.getAllMetadata().stream().filter(m -> m.getType().getName().equals("DateIssued")).toList());
    }
}
