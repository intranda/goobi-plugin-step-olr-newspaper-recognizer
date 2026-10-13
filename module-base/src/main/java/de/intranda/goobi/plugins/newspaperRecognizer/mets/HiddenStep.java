package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import de.intranda.goobi.plugins.newspaperRecognizer.model.BlockNode;
import ugh.dl.DocStruct;

/** One change to hidden data, decided by {@link HiddenDataResolver} and carried out by {@link MetsWriter}. */
public sealed interface HiddenStep permits HiddenStep.RemoveStructure, HiddenStep.RemoveMetadata, HiddenStep.Shorten, HiddenStep.Rehome {

    record RemoveStructure(DocStruct structure) implements HiddenStep {
    }

    record RemoveMetadata(DocStruct owner, Object entry) implements HiddenStep {
    }

    /** Keeps only the references (in the whole subtree) to pages between {@code firstPage} and {@code lastPage}. */
    record Shorten(DocStruct structure, int firstPage, int lastPage) implements HiddenStep {
    }

    /** Moves the structure below the block written for {@code target}; {@code null} means the volume. */
    record Rehome(DocStruct structure, BlockNode target) implements HiddenStep {
    }
}
