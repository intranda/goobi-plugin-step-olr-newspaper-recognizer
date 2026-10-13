package de.intranda.goobi.plugins.newspaperRecognizer.legacy;

import java.util.List;

import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.Notice;

public record ConversionResult(List<NewspaperPage> pages, List<Notice> notices) {
}
