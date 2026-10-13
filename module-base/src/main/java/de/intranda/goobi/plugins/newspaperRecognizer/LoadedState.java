package de.intranda.goobi.plugins.newspaperRecognizer;

import de.intranda.goobi.plugins.newspaperRecognizer.data.PluginData;
import ugh.dl.DigitalDocument;
import ugh.dl.Fileformat;

/** The METS file as loaded for this session and what the frontend gets from it. */
public record LoadedState(Fileformat fileformat, DigitalDocument digitalDocument, String volumeType, PluginData data) {
}
