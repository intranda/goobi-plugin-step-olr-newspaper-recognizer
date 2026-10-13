package de.intranda.goobi.plugins.newspaperRecognizer.legacy;

import static de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments.filenames;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.util.List;

import org.junit.Test;

import com.google.gson.JsonArray;
import com.google.gson.JsonParser;

import de.intranda.goobi.plugins.newspaperRecognizer.TestDocuments;
import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.Notice;

public class LegacyDataConverterTest {
    private final LegacyDataConverter converter = new LegacyDataConverter(TestDocuments.ruleset(), "dd.MM.yyyy");

    private ConversionResult convert(String json, int pages) {
        JsonArray legacy = JsonParser.parseString(json).getAsJsonArray();
        return converter.convert(legacy, "NewspaperVolume", filenames(pages));
    }

    private static BlockStart startOn(ConversionResult result, int page) {
        return result.pages().get(page).getStarts().get(0);
    }

    @Test
    public void issues_matchedByLabelWithValues() {
        ConversionResult result = convert("""
                [{"filename":"0001.tif","issueTypeName":"Morgenausgabe","metadata":{"dateStr":"01.03.1890","prefix":"Nr. ","number":"1","suffix":""}},
                 {"filename":"0002.tif","metadata":{}},
                 {"filename":"0003.tif","issueTypeName":"Abendausgabe","metadata":{"dateStr":"01.03.1890","number":"1"}}]
                """, 3);
        assertEquals(List.of(1, 1, 1), result.pages().stream().map(NewspaperPage::getDepth).toList());
        BlockStart morning = startOn(result, 0);
        assertEquals("MorningIssue", morning.getType());
        assertEquals("1890-03-01", morning.getDate());
        assertEquals("Nr. ", morning.getPrefix());
        assertEquals("1", morning.getNumber());
        assertNull(morning.getSuffix());
        assertNull(morning.getId());
        assertEquals("EveningIssue", startOn(result, 2).getType());
        assertEquals(List.of(), result.notices());
    }

    @Test
    public void labels_matchInternalNameAndAnyLanguage() {
        ConversionResult result = convert("""
                [{"filename":"0001.tif","issueTypeName":"MorningIssue"},{"filename":"0002.tif","issueTypeName":"Evening issue"}]
                """, 2);
        assertEquals("MorningIssue", startOn(result, 0).getType());
        assertEquals("EveningIssue", startOn(result, 1).getType());
    }

    @Test
    public void supplements_andBackToTheIssue() {
        ConversionResult result = convert("""
                [{"filename":"0001.tif","issueTypeName":"Morgenausgabe"},
                 {"filename":"0002.tif","supplementTypeName":"Beilage","supplementNumber":1},
                 {"filename":"0003.tif","supplementNumber":1},
                 {"filename":"0004.tif","supplementTypeName":"Beilage","supplementNumber":2},
                 {"filename":"0005.tif","supplementNumber":0}]
                """, 5);
        assertEquals(List.of(1, 2, 2, 2, 1), result.pages().stream().map(NewspaperPage::getDepth).toList());
        assertEquals(List.of(1, 1, 0, 1, 0), result.pages().stream().map(p -> p.getStarts().size()).toList());
        assertEquals("NewspaperSupplement", startOn(result, 1).getType());
        assertEquals("NewspaperSupplement", startOn(result, 3).getType());
    }

    @Test
    public void unknownAndAmbiguousLabels_untypedWithNotice() {
        ConversionResult result = convert("""
                [{"filename":"0001.tif","issueTypeName":"plugin_intranda_step_newspaperRecognizer_issueType_issue"},
                 {"filename":"0002.tif","issueTypeName":"Edition"}]
                """, 2);
        assertNull(startOn(result, 0).getType());
        assertNull(startOn(result, 1).getType());
        assertEquals(List.of(new Notice("plugin_newspaperRecognizer_notice_unknownLegacyLabel", List.of("plugin_intranda_step_newspaperRecognizer_issueType_issue")),
                new Notice("plugin_newspaperRecognizer_notice_unknownLegacyLabel", List.of("Edition"))), result.notices());
    }

    @Test
    public void unparsableDate_keptAsRaw() {
        ConversionResult result = convert("[{\"filename\":\"0001.tif\",\"issueTypeName\":\"Morgenausgabe\",\"metadata\":{\"dateStr\":\"1890\"}}]", 1);
        assertNull(startOn(result, 0).getDate());
        assertEquals("1890", startOn(result, 0).getDateRaw());
    }

    @Test
    public void firstPageWithoutIssue_startsUntypedBlock_newImagesContinueTheBlock() {
        ConversionResult result = convert("[{\"filename\":\"0001.tif\"}]", 3);
        assertEquals(List.of(1, 0, 0), result.pages().stream().map(p -> p.getStarts().size()).toList());
        assertEquals(List.of(1, 1, 1), result.pages().stream().map(NewspaperPage::getDepth).toList());
        assertNull(startOn(result, 0).getType());
    }
}
