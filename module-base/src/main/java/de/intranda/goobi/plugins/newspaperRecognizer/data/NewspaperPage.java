package de.intranda.goobi.plugins.newspaperRecognizer.data;

import de.sub.goobi.metadaten.Image;
import lombok.Data;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Data
public class NewspaperPage {
    public static final double ANALYSIS_ISSUE_DETECTION_THRESHOLD = -0.8;

    // Metadata 'DateIssued' date format
    private static final DateTimeFormatter w3cdtf = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    @Setter
    private transient DateTimeFormatter frontendDateFormat;

    //from automatic analysis
    private double result;

    // used in both
    private String filename;

    //from this plugin
    private Image image; // the 'Image' object is serialized to Json, the frontend accesses individual properties
    private NewspaperPageMetadata metadata;
    private String issueTypeName;
    private String supplementTypeName;
    private int supplementNumber;

    private transient NewspaperIssueType issueType;
    private transient NewspaperSupplementType supplementType;

    public boolean analysisIndicatesThisIsAnIssue() {
        return result < ANALYSIS_ISSUE_DETECTION_THRESHOLD;
    }

    public Optional<LocalDate> getDate() {
        return getRawDateString().map(s -> LocalDate.parse(s, frontendDateFormat));
    }

    public Optional<String> getMetsDateString() {
        return getDate().map(w3cdtf::format);
    }

    public Optional<String> getRawDateString() {
        if (StringUtils.isBlank(metadata.dateStr())) {
            return Optional.empty();
        }
        return Optional.of(metadata.dateStr());
    }

    public String generatePartNumber() {
        StringBuilder b = new StringBuilder();
        Optional.ofNullable(metadata.prefix()).ifPresent(b::append);
        Optional.ofNullable(metadata.number()).ifPresent(b::append);
        Optional.ofNullable(metadata.suffix()).ifPresent(b::append);
        return b.toString();
    }
}
