package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.io.IOException;

import org.goobi.beans.Process;

import ugh.dl.Fileformat;

public class ProcessMetsStore implements MetsStore {
    private final Process process;

    public ProcessMetsStore(Process process) {
        this.process = process;
    }

    @Override
    public Fileformat read() throws Exception {
        return process.readMetadataFile();
    }

    @Override
    public void write(Fileformat fileformat) throws Exception {
        if (!process.writeMetadataFile(fileformat)) {
            throw new IOException("The METS file of process " + process.getId() + " was not written");
        }
    }
}
