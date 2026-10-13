package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.LinkedHashMap;
import java.util.Map;

import lombok.Data;

/**
 * A block starting on a page. {@code id} identifies the loaded DocStruct ({@code null} for new blocks), {@code type} is the
 * ruleset internal name ({@code null} = "please select"), {@code date} is ISO {@code yyyy-MM-dd}, {@code dateRaw} holds a
 * value that could not be parsed. {@code values} holds the visible metadata fields (key → value); a key that is not sent leaves the
 * metadata untouched, an empty value removes it.
 */
@Data
public class BlockStart {
    private String id;
    private String type;
    private String date;
    private String dateRaw;
    private String prefix;
    private String number;
    private String suffix;
    private HiddenSummary hidden = new HiddenSummary();
    private Map<String, String> values = new LinkedHashMap<>();

    /** Never {@code null}, also when a request sends {@code "values": null}. */
    public Map<String, String> getValues() {
        if (values == null) {
            values = new LinkedHashMap<>();
        }
        return values;
    }
}
