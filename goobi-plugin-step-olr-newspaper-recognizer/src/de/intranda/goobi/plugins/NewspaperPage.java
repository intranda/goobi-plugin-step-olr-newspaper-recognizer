package de.intranda.goobi.plugins;

import lombok.Data;

@Data
public class NewspaperPage {
	private String filename;
	private String result;
	private boolean issue;
	
	public String getFilenameAsTif(){
		return filename.replace(".jpg", ".tif");
	}
	
	public boolean guessIssue(){
		double value = Double.parseDouble(result);
		return value < -0.8;
	}
	
	public boolean guessIssue(double level){
		double value = Double.parseDouble(result);
		return value < level;
	}
}
