package de.intranda.goobi.plugins.newspaperRecognizer.config;

import java.util.List;

import org.goobi.api.display.enums.DisplayType;
import org.goobi.api.display.helper.ConfigDisplayRules;

import de.intranda.goobi.plugins.newspaperRecognizer.ruleset.FieldItem;

/** {@link DisplayRulesLookup} on {@code goobi_metadataDisplayRules.xml}, for one project. */
public class GoobiDisplayRules implements DisplayRulesLookup {
    private final String project;

    public GoobiDisplayRules(String project) {
        this.project = project;
    }

    @Override
    public FieldDisplay displayType(String metadata) {
        DisplayType type = ConfigDisplayRules.getInstance().getElementTypeByName(project, metadata);
        if (type == null) {
            return FieldDisplay.INPUT;
        }
        return switch (type) {
            case textarea -> FieldDisplay.TEXTAREA;
            case readonly -> FieldDisplay.READONLY;
            case select1 -> FieldDisplay.SELECT1;
            default -> FieldDisplay.INPUT;
        };
    }

    @Override
    public List<FieldItem> items(String metadata) {
        return ConfigDisplayRules.getInstance()
                .getItemsByNameAndType(project, metadata, DisplayType.select1)
                .stream()
                .map(item -> new FieldItem(item.getLabel(), item.getValue()))
                .toList();
    }
}
