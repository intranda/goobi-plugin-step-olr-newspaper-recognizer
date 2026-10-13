package de.intranda.goobi.plugins.newspaperRecognizer.data;

import java.util.ArrayList;
import java.util.List;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** What the backend hands to the frontend. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PluginData {
    private List<NewspaperPage> pages = new ArrayList<>();
    private List<Notice> notices = new ArrayList<>();
    private HiddenSummary volumeHidden = new HiddenSummary();
}
