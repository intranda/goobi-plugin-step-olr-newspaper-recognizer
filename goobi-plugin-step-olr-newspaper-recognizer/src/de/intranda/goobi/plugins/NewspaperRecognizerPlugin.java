package de.intranda.goobi.plugins;


import java.io.FileReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.Reader;
import java.lang.reflect.Type;
import java.util.Collection;
import java.util.List;

import org.apache.commons.configuration.SubnodeConfiguration;
import org.apache.commons.configuration.XMLConfiguration;
import org.apache.commons.configuration.reloading.FileChangedReloadingStrategy;
import org.apache.commons.configuration.tree.xpath.XPathExpressionEngine;
import org.goobi.beans.Step;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;

import de.sub.goobi.config.ConfigPlugins;
import de.sub.goobi.helper.Helper;
import de.sub.goobi.helper.exceptions.DAOException;
import de.sub.goobi.helper.exceptions.SwapException;
import lombok.Data;
import lombok.extern.log4j.Log4j;
import net.xeoh.plugins.base.annotations.PluginImplementation;

@PluginImplementation
//@Log4j
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
//		log.info("Start recognizing");
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
    
    public static void main(String[] args) throws Exception{
    	
    	Gson gson = new Gson();
    	Type nt = new TypeToken<Collection<NewspaperPage>>(){}.getType();
    	Collection<NewspaperPage> pages = gson.fromJson(new JsonReader(new FileReader("/Users/steffen/git/goobi-plugin-step-olr-newspaper-recognizer/goobi-plugin-step-olr-newspaper-recognizer/doc/demmta_1911.json")), nt);
    	
    	for (NewspaperPage page : pages) {
    		page.setIssue(page.guessIssue());
    		System.out.println(page.getFilenameAsTif() + " - " + page.getResult() + " - " + page.isIssue());
		}
    	
    	
    	
	}
    
}
