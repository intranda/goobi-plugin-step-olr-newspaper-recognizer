package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import ugh.dl.DigitalDocument;
import ugh.dl.DocStruct;

/** The volume is the logical top structure, or its first child if the top structure is an anchor. */
public final class VolumeLocator {

    private VolumeLocator() {
    }

    public static DocStruct find(DigitalDocument dd) {
        DocStruct top = dd.getLogicalDocStruct();
        if (top.getType().isAnchor() && top.getAllChildren() != null && !top.getAllChildren().isEmpty()) {
            return top.getAllChildren().get(0);
        }
        return top;
    }
}
