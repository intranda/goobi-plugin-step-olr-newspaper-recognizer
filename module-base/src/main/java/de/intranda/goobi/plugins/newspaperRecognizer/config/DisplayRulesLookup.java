package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.util.List;

import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.FieldItem;

/** The metadata display rules of the process's project, see {@link GoobiDisplayRules}. */
public interface DisplayRulesLookup {
    /** Every field is an input field. */
    DisplayRulesLookup INPUT_ONLY = new DisplayRulesLookup() {
        @Override
        public FieldDisplay displayType(String metadata) {
            return FieldDisplay.INPUT;
        }

        @Override
        public List<FieldItem> items(String metadata) {
            return List.of();
        }
    };

    FieldDisplay displayType(String metadata);

    /** The selectable values of a {@link FieldDisplay#SELECT1} field. */
    List<FieldItem> items(String metadata);
}
