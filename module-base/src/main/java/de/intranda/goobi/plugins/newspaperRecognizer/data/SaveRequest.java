package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.ArrayList;
import java.util.List;

import lombok.Data;

/** What the frontend sends on save. */
@Data
public class SaveRequest {
    private List<NewspaperPage> pages = new ArrayList<>();
    private List<HiddenOperation> operations = new ArrayList<>();
}
