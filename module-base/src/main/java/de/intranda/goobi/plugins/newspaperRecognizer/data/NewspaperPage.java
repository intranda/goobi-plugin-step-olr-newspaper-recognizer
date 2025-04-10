package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import de.sub.goobi.metadaten.Image;
import lombok.Data;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

@Data
public class NewspaperPage {
    // Metadata 'DateIssued' date format
    private static final DateTimeFormatter w3cdtf = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    @Setter
    private transient DateTimeFormatter frontendDateFormat;

    //from json
    private String filename;
    private double result;

    //from this application
    private boolean issue;
    private boolean supplement;
    private boolean supplementTitle;
    private String dateStr;
    private String prefix;
    private String number;
    private String suffix;
    private Image image;
    private boolean showOtherImages = true;
    private List<NewspaperPage> otherPages = new ArrayList<>();
    private List<NewspaperPage> supplementPages = new ArrayList<>();
    private boolean dateValid;
    private String issueType;
    private String supplementType;

    public NewspaperPage(String filename) {
        super();
        this.filename = filename;
    }

    public String getFilenameAsTif() {
        return filename.replace(".jpg", ".tif");
    }

    public boolean guessIssue() {
        this.issue = result < -0.8;
        return this.issue;
    }

    public boolean guessIssue(double level) {
        return result < level;
    }

    public Optional<LocalDate> getDate() {
        return getRawDateString().map(s -> LocalDate.parse(s, frontendDateFormat));
    }

    public Optional<String> getMetsDateString() {
        return getDate().map(w3cdtf::format);
    }

    public Optional<String> getRawDateString() {
        if (StringUtils.isBlank(dateStr)) {
            return Optional.empty();
        }
        return Optional.of(dateStr);
    }

    public void addPage(NewspaperPage page) {
        if (this.otherPages == null) {
            this.otherPages = new ArrayList<>();
            this.showOtherImages = true;
        }
        this.otherPages.add(page);
    }

    public void addAllPages(List<NewspaperPage> otherPages2) {
        if (this.otherPages == null) {
            this.otherPages = new ArrayList<>();
        }
        for (NewspaperPage page : otherPages2) {
            this.otherPages.add(page);
        }
    }

    public void toggleShowOtherImages() {
        this.showOtherImages = !this.showOtherImages;
    }

    public String generatePartNumber() {
        StringBuilder b = new StringBuilder();
        if (prefix != null) {
            b.append(prefix);
        }
        if (number != null) {
            b.append(number);
        }
        if (suffix != null) {
            b.append(suffix);
        }
        return b.toString();
    }

    /**
     * Make sure that collection properties are not null. Otherwise it will cause issues in javascript code
     */
    public void initializeProperties() {
        if(this.otherPages == null) {
            this.otherPages = new ArrayList<>();
        }
        if(this.supplementPages == null) {
            this.supplementPages = new ArrayList<>();
        }
    }

}
