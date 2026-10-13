package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.List;

import de.intranda.goobi.plugins.newspaperRecognizer.data.HiddenSummary;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.Notice;

public record ReadResult(List<NewspaperPage> pages, HiddenSummary volumeHidden, List<Notice> notices) {
}
