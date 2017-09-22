package de.intranda.goobi.plugins;


import java.io.IOException;

import org.apache.commons.configuration.SubnodeConfiguration;
import org.apache.commons.configuration.XMLConfiguration;
import org.apache.commons.configuration.reloading.FileChangedReloadingStrategy;
import org.apache.commons.configuration.tree.xpath.XPathExpressionEngine;
import org.goobi.beans.Step;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;


import de.sub.goobi.config.ConfigPlugins;
import de.sub.goobi.helper.Helper;
import de.sub.goobi.helper.exceptions.DAOException;
import de.sub.goobi.helper.exceptions.SwapException;
import lombok.Data;
import lombok.extern.log4j.Log4j;
import net.xeoh.plugins.base.annotations.PluginImplementation;

@PluginImplementation
@Log4j
@Data
public class NewspaperRecognizerPlugin extends AbstractStepPlugin implements IStepPlugin, IPlugin {
	private static final String PLUGIN_NAME = "intranda_step_newspaperRecognizer";
	private static final String GUI = "/uii/plugin_newspaperRecognizer.xhtml";
	
	private int tocDepth = 0;
	
	private String returnPath;

	/**
	 * initialise, read config etc.	
	 */
	public void initialize(Step step, String returnPath) {
		this.returnPath = returnPath;
		tocDepth = ConfigPlugins.getPluginConfig(this).getInt("defaultDepth", 1);
    }
	
	public void generateToc(){
		log.info("Start recognizing");
	}
		
	@Override public boolean execute() {
		return false;
	}

	@Override
	public PluginGuiType getPluginGuiType() {
		return PluginGuiType.FULL;
	}

	@Override
	public String getTitle() {
		return PLUGIN_NAME;
	}

	@Override
	public String getDescription() {
		return PLUGIN_NAME;
	}
	
	@Override
    public String getPagePath() {
		return GUI;
	}
	
    @Override
    public String cancel() {
        return "/uii/" + returnPath;
    }

    @Override
    public String finish() {
        return "/uii/" + returnPath;
    }
}
