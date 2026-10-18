package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.ArrayList;
import java.util.List;

import de.sub.goobi.metadaten.Image;
import lombok.Data;

/** One image in the transfer format: how many blocks it belongs to and which blocks start on it (outermost first). */
@Data
public class NewspaperPage {
    public static final double ANALYSIS_ISSUE_DETECTION_THRESHOLD = -0.8;

    private String filename;
    // score of the automatic analysis, 0 if there is none
    private double result;
    // the 'Image' object is serialized to Json, the frontend accesses individual properties
    private Image image;
    private int depth;
    // the page label (logicalPageNumber), never null
    private String label = "";
    private List<BlockStart> starts = new ArrayList<>();

    public boolean analysisIndicatesThisIsAnIssue() {
        return result < ANALYSIS_ISSUE_DETECTION_THRESHOLD;
    }
}
