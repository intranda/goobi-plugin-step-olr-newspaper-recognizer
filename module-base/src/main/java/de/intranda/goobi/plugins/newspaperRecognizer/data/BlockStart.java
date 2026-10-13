package de.intranda.goobi.plugins.newspaperRecognizer.data;

import lombok.Data;

/**
 * A block starting on a page. {@code id} identifies the loaded DocStruct ({@code null} for new blocks), {@code type} is the
 * ruleset internal name ({@code null} = "please select"), {@code date} is ISO {@code yyyy-MM-dd}, {@code dateRaw} holds a
 * value that could not be parsed.
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
}
