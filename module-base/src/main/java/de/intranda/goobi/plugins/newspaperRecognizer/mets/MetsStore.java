package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import ugh.dl.Fileformat;

/** Reads and writes the process METS file. */
public interface MetsStore {
    Fileformat read() throws Exception;

    void write(Fileformat fileformat) throws Exception;
}
