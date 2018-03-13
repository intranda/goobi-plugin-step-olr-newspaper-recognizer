package de.intranda.goobi.plugins;

import java.util.ArrayList;
import java.util.List;

import org.joda.time.DateTime;
import org.joda.time.format.DateTimeFormat;
import org.joda.time.format.DateTimeFormatter;

import de.sub.goobi.metadaten.Image;
import lombok.Data;

@Data
public class NewspaperPage {
    private static final DateTimeFormatter formatter = DateTimeFormat.forPattern("dd.MM.yyyy");

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

    public DateTime getDate() {
        if (dateStr != null && !dateStr.isEmpty()) {
            return formatter.parseDateTime(dateStr);
        }
        return new DateTime();
    }

    public void setDate(DateTime date) {
        this.dateStr = date.toString(formatter);
    }

    public void addPage(NewspaperPage page) {
        this.otherPages.add(page);
    }

    public void addAllPages(List<NewspaperPage> otherPages2) {
        for (NewspaperPage page : otherPages2) {
            this.otherPages.add(page);
        }
    }

    public void toggleShowOtherImages() {
        this.showOtherImages = !this.showOtherImages;
    }

    public String generateTitle() {
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
}
