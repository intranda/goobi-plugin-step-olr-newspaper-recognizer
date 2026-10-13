package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.ArrayList;
import java.util.List;

import lombok.Data;

/** Data of a block (or of the volume) that the plugin shows but does not manage. */
@Data
public class HiddenSummary {
    private List<HiddenStructureInfo> structures = new ArrayList<>();
    private List<HiddenMetadataInfo> metadata = new ArrayList<>();

    public boolean isEmpty() {
        return structures.isEmpty() && metadata.isEmpty();
    }
}
