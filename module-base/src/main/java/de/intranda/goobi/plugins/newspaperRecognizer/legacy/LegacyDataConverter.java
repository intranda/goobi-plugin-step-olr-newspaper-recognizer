package de.intranda.goobi.plugins.newspaperRecognizer.legacy;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.commons.lang3.StringUtils;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import de.intranda.goobi.plugins.newspaperRecognizer.data.BlockStart;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.Notice;
import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.RulesetTypes;

/** One-time conversion of {@code issues_result_manual.json} written by the old plugin versions. */
public class LegacyDataConverter {
    private final RulesetTypes ruleset;
    private final DateTimeFormatter dateFormat;

    public LegacyDataConverter(RulesetTypes ruleset, String dateFormatPattern) {
        this.ruleset = ruleset;
        DateTimeFormatter formatter;
        try {
            formatter = DateTimeFormatter.ofPattern(dateFormatPattern);
        } catch (IllegalArgumentException e) {
            formatter = null;
        }
        this.dateFormat = formatter;
    }

    public ConversionResult convert(JsonArray legacy, String volumeType, List<String> filenames) {
        Map<String, JsonObject> byName = new HashMap<>();
        for (JsonElement element : legacy) {
            if (element.isJsonObject()) {
                String filename = string(element.getAsJsonObject(), "filename");
                if (filename != null) {
                    byName.putIfAbsent(filename, element.getAsJsonObject());
                }
            }
        }
        List<NewspaperPage> pages = new ArrayList<>();
        Set<String> unresolved = new LinkedHashSet<>();
        String issueType = null;
        int previousDepth = 0;
        for (int i = 0; i < filenames.size(); i++) {
            JsonObject old = byName.get(filenames.get(i));
            NewspaperPage page = new NewspaperPage();
            page.setFilename(filenames.get(i));
            String issueLabel = old == null ? null : string(old, "issueTypeName");
            String supplementLabel = old == null ? null : string(old, "supplementTypeName");
            int supplementNumber = old == null || !old.has("supplementNumber") || old.get("supplementNumber").isJsonNull() ? -1
                    : old.get("supplementNumber").getAsInt();
            if (i == 0 || issueLabel != null) {
                BlockStart start = values(old);
                issueType = match(issueLabel, ruleset.allowedChildren(volumeType), unresolved);
                start.setType(issueType);
                page.getStarts().add(start);
                page.setDepth(1);
            } else if (supplementNumber > 0 && supplementLabel != null) {
                BlockStart start = new BlockStart();
                start.setType(match(supplementLabel, issueType == null ? List.of() : ruleset.allowedChildren(issueType), unresolved));
                page.getStarts().add(start);
                page.setDepth(2);
            } else if (supplementNumber == 0) {
                page.setDepth(1);
            } else {
                // a continuation of the supplement (number > 0) or an image the old file does not know (-1)
                page.setDepth(previousDepth == 2 ? 2 : 1);
            }
            previousDepth = page.getDepth();
            pages.add(page);
        }
        List<Notice> notices = unresolved.stream()
                .map(label -> new Notice("plugin_newspaperRecognizer_notice_unknownLegacyLabel", List.of(label)))
                .toList();
        return new ConversionResult(pages, notices);
    }

    private String match(String label, List<String> candidates, Set<String> unresolved) {
        if (label == null) {
            return null;
        }
        List<String> matches = candidates.stream().filter(c -> c.equals(label) || ruleset.allLabels(c).contains(label)).toList();
        if (matches.size() == 1) {
            return matches.get(0);
        }
        unresolved.add(label);
        return null;
    }

    private BlockStart values(JsonObject old) {
        BlockStart start = new BlockStart();
        JsonObject metadata = old != null && old.has("metadata") && old.get("metadata").isJsonObject() ? old.getAsJsonObject("metadata")
                : new JsonObject();
        String dateStr = string(metadata, "dateStr");
        if (dateStr != null) {
            LocalDate date = parse(dateStr);
            if (date != null) {
                start.setDate(date.toString());
            } else {
                start.setDateRaw(dateStr);
            }
        }
        start.setPrefix(string(metadata, "prefix"));
        start.setNumber(string(metadata, "number"));
        start.setSuffix(string(metadata, "suffix"));
        return start;
    }

    private LocalDate parse(String value) {
        if (dateFormat == null) {
            return null;
        }
        try {
            return LocalDate.parse(value.trim(), dateFormat);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private static String string(JsonObject object, String key) {
        if (!object.has(key) || object.get(key).isJsonNull()) {
            return null;
        }
        String value = object.get(key).getAsString();
        return StringUtils.isBlank(value) ? null : value;
    }
}
