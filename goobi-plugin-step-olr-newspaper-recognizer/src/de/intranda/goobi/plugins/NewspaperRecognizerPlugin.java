package de.intranda.goobi.plugins;

import java.io.FileReader;
import java.io.IOException;
import java.lang.reflect.Type;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import org.goobi.beans.Step;
import org.goobi.production.enums.PluginGuiType;
import org.goobi.production.plugin.interfaces.AbstractStepPlugin;
import org.goobi.production.plugin.interfaces.IPlugin;
import org.goobi.production.plugin.interfaces.IStepPlugin;
import org.joda.time.DateTime;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;
import com.google.gson.stream.JsonReader;

import de.sub.goobi.config.ConfigPlugins;
import de.sub.goobi.forms.HelperForm;
import de.sub.goobi.helper.Helper;
import de.sub.goobi.helper.exceptions.DAOException;
import de.sub.goobi.helper.exceptions.SwapException;
import de.sub.goobi.metadaten.Image;
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

    private Gson gson = new Gson();
    private List<NewspaperPage> pages;

    private boolean monday = true;
    private boolean tuesday = true;
    private boolean wednesday = true;
    private boolean thursday = true;
    private boolean friday = true;
    private boolean saturday = true;
    private boolean sunday = true;

    /**
     * initialise, read config etc.
     */
    @Override
    public void initialize(Step step, String returnPath) {
        this.returnPath = returnPath;
        this.myStep = step;
        tocDepth = ConfigPlugins.getPluginConfig(this).getInt("defaultDepth", 1);
        try {
            readExportedFile();
        } catch (IOException | InterruptedException | SwapException | DAOException e) {
            // TODO Auto-generated catch block
            log.error(e);
        }
    }

    @Override
    public boolean execute() {
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

    public void generateDates(int startIndex) {
        NewspaperPage startPage = this.pages.get(startIndex);
        int startNumber = Integer.parseInt(startPage.getNumber());
        DateTime startDate = startPage.getDate();
        for (int i = startIndex + 1; i < pages.size(); i++) {
            NewspaperPage page = this.pages.get(i);
            if (page.isIssue()) {
                startNumber++;
                startDate = startDate.plusDays(1);
                page.setNumber("" + startNumber);
                page.setDate(startDate);
            }
        }
    }

    public void noIssue(int idx) {
        NewspaperPage removePage = this.pages.get(idx);
        removePage.setIssue(false);
        NewspaperPage prevIssue = findPrevIssue(idx);
        prevIssue.addPage(removePage);
        prevIssue.addAllPages(removePage.getOtherPages());
        removePage.setOtherPages(new ArrayList<NewspaperPage>());
    }

    public void isIssue(int pageIdx, int otherPageIdx) {
        NewspaperPage issue = this.pages.get(pageIdx);
        NewspaperPage newIssue = issue.getOtherPages().get(otherPageIdx);
        newIssue.setIssue(true);
        List<NewspaperPage> reversedToAdd = new ArrayList<>();
        for (int i = issue.getOtherPages().size() - 1; i >= otherPageIdx; i--) {
            NewspaperPage removed = issue.getOtherPages().remove(i);
            if (i != otherPageIdx) {
                reversedToAdd.add(removed);
            }
        }
        for (int i = reversedToAdd.size() - 1; i >= 0; i--) {
            newIssue.addPage(reversedToAdd.get(i));
        }
    }

    private NewspaperPage findPrevIssue(int idx) {
        for (int i = idx; i >= 0; i--) {
            NewspaperPage page = this.pages.get(i);
            if (page.isIssue()) {
                return page;
            }
        }
        return null;
    }

    private void readExportedFile() throws IOException, InterruptedException, SwapException, DAOException {
        org.goobi.beans.Process pr = this.myStep.getProzess();
        String imageDir = pr.getImagesOrigDirectory(false);
        String resultF = pr.getProcessDataDirectory() + "/taskmanager/issues_result.json";
        Type nt = new TypeToken<List<NewspaperPage>>() {
        }.getType();
        try (FileReader fr = new FileReader(resultF)) {
            this.pages = gson.fromJson(new JsonReader(fr), nt);
        }
        log.info(pages.size());
        int order = 0;
        int count = 0;
        String contextPath = getContextPath();
        NewspaperPage currentIssue = null;
        for (NewspaperPage page : pages) {
            page.guessIssue();
            log.info(page.getResult());
            if (page.isIssue()) {
                currentIssue = page;
                count++;
            } else {
                if (currentIssue != null) {
                    currentIssue.addPage(page);
                }
            }
            Image image = new Image(imageDir + "/" + page.getFilename(), order++, "", page.getFilename(), page.getFilename());
            String thumbUrl = createImageUrl(image, 400, "image/jpeg", contextPath);
            image.setThumbnailUrl(thumbUrl);
            String largeThumbUrl = createImageUrl(image, 1600, "image/jpeg", contextPath);
            image.setLargeThumbnailUrl(largeThumbUrl);
            page.setImage(image);
        }
        log.info(String.format("Counted %d issues", count));
    }

    private String getContextPath() {
        HelperForm hf = (HelperForm) Helper.getManagedBeanValue("#{HelperForm}");
        return hf.getServletPathWithHostAsUrl();
    }

    private String createImageUrl(Image currentImage, Integer size, String format, String baseUrl) {
        StringBuilder url = new StringBuilder(baseUrl);
        url.append("/cs").append("?action=").append("image").append("&format=").append(format).append("&sourcepath=").append("file://" + currentImage
                .getImageName()).append("&width=").append(size).append("&height=").append(size);
        return url.toString();
    }

    public static void main(String[] args) throws Exception {

        Gson gson = new Gson();
        Type nt = new TypeToken<Collection<NewspaperPage>>() {
        }.getType();
        Collection<NewspaperPage> pages = gson.fromJson(new JsonReader(new FileReader(
                "/Users/steffen/git/goobi-plugin-step-olr-newspaper-recognizer/goobi-plugin-step-olr-newspaper-recognizer/doc/demmta_1911.json")),
                nt);

        for (NewspaperPage page : pages) {
            page.setIssue(page.guessIssue());
            System.out.println(page.getFilenameAsTif() + " - " + page.getResult() + " - " + page.isIssue());
        }

    }

}
