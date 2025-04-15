package de.intranda.goobi.plugins.newspaperRecognizer;

import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperIssueType;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperMetadataWriteConfiguration;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperPage;
import de.intranda.goobi.plugins.newspaperRecognizer.data.NewspaperSupplementType;
import de.sub.goobi.helper.Helper;
import de.sub.goobi.helper.exceptions.SwapException;
import lombok.Data;
import lombok.NonNull;
import lombok.RequiredArgsConstructor;
import lombok.extern.log4j.Log4j2;
import org.apache.commons.lang3.StringUtils;
import org.goobi.beans.Process;
import ugh.dl.*;
import ugh.exceptions.*;

import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Log4j2
@Data
@RequiredArgsConstructor
public class MetsWriter {
    // Hard-coded metadata type names for special purposes
    private static final String LOGICAL_PHYSICAL_TYPE = "logical_physical";
    private static final String PAGE_TYPE_NAME = "page";
    private static final String PART_NUMBER_TYPE_NAME = "PartNumber";
    private static final String NUMBER_TYPE_NAME = "CurrentNo";
    private static final String NUMBER_SORT_TYPE_NAME = "CurrentNoSorting";
    private static final String DATE_ISSUED_TYPE_NAME = "DateIssued";
    private static final String DATE_ISSUED_TYPE_NAME_ALTERNATIVE = "PublicationYear";
    private static final String LOG_PAGE_NO_TYPE_NAME = "logicalPageNumber";
    private static final String PHYS_PAGE_NO_TYPE_NAME = "physPageNumber";

    private static final Pattern TITLE_GENERATOR_DATE_PATTERN = Pattern.compile("\\{date:(.*)\\}");
    private static final Pattern TITLE_GENERATOR_ISSUE_NUMBER_PATTERN = Pattern.compile("\\{no\\}");
    private static final Pattern TITLE_GENERATOR_ISSUE_PART_NUMBER_PATTERN = Pattern.compile("\\{partNo\\}");
    public static final String MISSING_PLACEHOLDER_VALUE = "[MISSING]";

    private Map<String, DocStructType> docStructTypeMap;
    private Map<String, MetadataType> metadataTypeMap;

    @NonNull
    private Process process;
    @NonNull
    private List<NewspaperIssueType> issueTypes;
    @NonNull
    private List<NewspaperSupplementType> supplementTypes;
    // whether or not to create new paginations
    @NonNull
    private boolean createNewPagination;
    // which pagination type should be used, if blank or "-", then create no pagination, otherwise create paginations
    @NonNull
    private String paginationType;
    // whether or not to use fake pagination, if true then use the form [N] where N is a number, otherwise use the bare N itself
    @NonNull
    private boolean useFakePagination;

    public void initialize() {
        Prefs prefs = process.getRegelsatz().getPreferences();
        docStructTypeMap = initializeDocStructTypeMap(prefs.getAllDocStructTypes());
        metadataTypeMap = initializeMetadataTypeMap(prefs.getAllMetadataTypes());
    }

    private Map<String, DocStructType> initializeDocStructTypeMap(Collection<DocStructType> dsTypes) {
        return dsTypes.stream()
                .collect(Collectors.toMap(
                        DocStructType::getName,
                        type -> type
                ));
    }

    private Map<String, MetadataType> initializeMetadataTypeMap(List<MetadataType> mdTypes) {
        var result = mdTypes.stream()
                .collect(Collectors.toMap(
                        MetadataType::getName,
                        type -> type
                ));

        // if by the end DATE_ISSUED_TYPE_NAME is not loaded into mapping, use alternative instead
        if (!result.containsKey(DATE_ISSUED_TYPE_NAME) && result.containsKey(DATE_ISSUED_TYPE_NAME_ALTERNATIVE)) {
            result.put(DATE_ISSUED_TYPE_NAME, result.get(DATE_ISSUED_TYPE_NAME_ALTERNATIVE));
        }

        return result;
    }

    public Optional<NewspaperIssueType> getIssueTypeForPage(NewspaperPage page) {
        return this.issueTypes.stream()
                .filter(t -> t.label().equals(page.getIssueTypeName()))
                .findFirst();
    }

    public Optional<NewspaperSupplementType> getSupplementTypeForPage(NewspaperPage page) {
        return this.supplementTypes.stream()
                .filter(t -> t.label().equals(page.getSupplementTypeName()))
                .findFirst();
    }

    public void write(List<NewspaperPage> pages) throws TypeNotAllowedForParentException, TypeNotAllowedAsChildException, WriteException, SwapException, IOException, PreferencesException {
        long startTime = System.nanoTime();
        // read mets file and ruleset
        DigitalDocument dd = null;
        Fileformat fileformat = null;
        try {
            fileformat = process.readMetadataFile();
            dd = fileformat.getDigitalDocument();
        } catch (Exception e) {
            log.error(e);
            return;
        }

        // get a copy of bound book children if it is not null
        DocStruct boundBook = dd.getPhysicalDocStruct();
        log.debug("boundBook has " + (boundBook.getAllChildren() == null ? "NULL" : "") + " children");

        List<DocStruct> bbChildren = null;
        if (boundBook.getAllChildren() != null) {
            bbChildren = new ArrayList<>(boundBook.getAllChildren());
        }

        // prepare volume
        DocStruct volume = purifyDigitalDocument(dd, boundBook, bbChildren);

        DocStruct currentIssue = null;
        NewspaperPage currentIssuePage = null;
        DocStruct currentSupplement = null;

        // create entry for each page
        int mainPageNo = 0; // order of current page among the current issue pages
        int supplementPageNo = 0; // order of current page among the current supplement pages

        for (int i = 0; i < pages.size(); i++) {
            NewspaperPage newspaperPage = pages.get(i);
            DocStruct page = null;
            page = dd.createDocStruct(docStructTypeMap.get(PAGE_TYPE_NAME));
            boundBook.addChild(page);

            page.setImageName(newspaperPage.getFilename());

            // process bound book children
            processBoundBookChildren(bbChildren, page, i, newspaperPage);

            // create new issue if needed
            if (currentIssue == null || Optional.ofNullable(newspaperPage.getIssueType()).isPresent()) {
                mainPageNo = 1;
                currentIssuePage = newspaperPage;
                currentIssue = createNewIssue(dd, newspaperPage);
                volume.addChild(currentIssue);
            }
            else if (Optional.ofNullable(newspaperPage.getSupplementType()).isPresent()) {
                supplementPageNo = 1;
                currentSupplement = createNewSupplement(dd, currentIssuePage, newspaperPage);
                currentIssue.addChild(currentSupplement);
            }

            if (currentSupplement != null && newspaperPage.getSupplementNumber() > 0) {
                currentSupplement.addReferenceTo(page, LOGICAL_PHYSICAL_TYPE);
            }

            if (createNewPagination) {
                int pageNo = newspaperPage.getSupplementNumber() > 0 ? supplementPageNo : mainPageNo;
                createMetadata(LOG_PAGE_NO_TYPE_NAME, Integer.toString(pageNo), page);
            }

            // link pages to issue and volume
            currentIssue.addReferenceTo(page, LOGICAL_PHYSICAL_TYPE);
            volume.addReferenceTo(page, LOGICAL_PHYSICAL_TYPE);

            mainPageNo++;

            // if frontend has a supplement numbering associated, we can count pages for the supplement
            if (newspaperPage.getSupplementNumber() > 0) {
                supplementPageNo++;
            }
        }

        process.writeMetadataFile(fileformat);

        long elapsedTime = System.nanoTime() - startTime;
        log.info("Total execution time to save a METS file for " + pages.size() + " pages is " + elapsedTime / 1000000 + " millis.");
    }

    private DocStruct purifyDigitalDocument(DigitalDocument dd, DocStruct boundBook, List<DocStruct> bbChildren) {
        DocStruct anchor = dd.getLogicalDocStruct();
        DocStruct volume;
        List<DocStruct> anchorsChildren = anchor.getAllChildren();
        if (anchor.getType().isAnchor() && anchorsChildren != null && !anchorsChildren.isEmpty()) {
            volume = anchor.getAllChildren().get(0);
        } else {
            volume = anchor;
        }

        List<DocStruct> volumesChildren = volume.getAllChildren();
        if (volumesChildren != null) {
            List<DocStruct> children = new ArrayList<>(volumesChildren);
            for (DocStruct child : children) {
                volume.removeChild(child);
                volume.removeReferenceTo(child);
            }
        }

        // remove all files from FileSet
        FileSet fs = dd.getFileSet();
        List<ContentFile> files = fs.getAllFiles();
        if (files != null) {
            files.clear();
        }

        if (bbChildren != null) {
            for (DocStruct child : bbChildren) {
                boundBook.removeChild(child);
                volume.removeReferenceTo(child);
            }
        }

        return volume;
    }

    private void processBoundBookChildren(List<DocStruct> bbChildren, DocStruct page, int currentNumber, NewspaperPage newspaperPage) {
        if (bbChildren == null) {
            createMetadata(PHYS_PAGE_NO_TYPE_NAME, "" + (currentNumber + 1), page);
            return;
        }

        // bbChildren != null, process them
        Optional<DocStruct> oldPage = bbChildren.stream().filter(p -> newspaperPage.getFilename().equals(p.getImageName())).findAny();

        // process old physical pages
        createMetadata(PHYS_PAGE_NO_TYPE_NAME, "" + (currentNumber + 1), page);

        if (createNewPagination) {
            // no need to process old logical page
            return;
        }

        // process old logical pages
        // TODO
        List<Metadata> oldLogPage = oldPage.map(p -> (List<Metadata>) p.getAllMetadataByType(metadataTypeMap.get(LOG_PAGE_NO_TYPE_NAME)))
                .orElse(Collections.emptyList());

        if (oldLogPage.isEmpty()) {
            createMetadata(LOG_PAGE_NO_TYPE_NAME, "uncounted", page);
        } else {
            createMetadata(LOG_PAGE_NO_TYPE_NAME, oldLogPage.getFirst().getValue(), page);
        }
    }

    private DocStruct createNewIssue(DigitalDocument dd, NewspaperPage newspaperPage) throws TypeNotAllowedForParentException {
        var issueType = getIssueTypeForPage(newspaperPage);
        if (issueType.isEmpty()) {
            throw new IllegalStateException("Unable to load issue type \"" + newspaperPage.getIssueTypeName() + "\"");
        }

        var result = dd.createDocStruct(docStructTypeMap.get(issueType.get().rulesetType()));

        if (!StringUtils.isBlank(newspaperPage.getMetadata().number())) {
            createMetadata(NUMBER_TYPE_NAME, newspaperPage.getMetadata().number(), result);
            createMetadata(NUMBER_SORT_TYPE_NAME, newspaperPage.getMetadata().number(), result);
            createMetadata(PART_NUMBER_TYPE_NAME, newspaperPage.generatePartNumber(), result);
        } else {
            String message = "The newspaper issue for image \"" + newspaperPage.getFilename() + "\" has no number associated!";
            log.warn(message);
            Helper.setFehlerMeldung(message);
        }

        newspaperPage.getMetsDateString().ifPresent(date -> createMetadata(DATE_ISSUED_TYPE_NAME, date, result));

        for (NewspaperMetadataWriteConfiguration mc : issueType.get().customMetadata()) {
            createMetadata(mc.key(), generateValue(newspaperPage, mc.value()), result);
        }

        return result;
    }

    private DocStruct createNewSupplement(DigitalDocument dd, NewspaperPage parentIssue, NewspaperPage newspaperPage) throws TypeNotAllowedForParentException {
        var supplementType = getSupplementTypeForPage(newspaperPage);
        if (supplementType.isEmpty()) {
            throw new IllegalStateException("Unable to load supplement type \"" + newspaperPage.getSupplementTypeName() + "\"");
        }

        var result = dd.createDocStruct(docStructTypeMap.get(supplementType.get().rulesetType()));

        for (NewspaperMetadataWriteConfiguration mc : supplementType.get().customMetadata()) {
            createMetadata(mc.key(), generateValue(parentIssue, mc.value()), result);
        }

        return result;
    }

    private void createMetadata(String metadataTypeName, String value, DocStruct docstruct) {
        MetadataType metadataType = Optional.ofNullable(metadataTypeMap.get(metadataTypeName))
                .orElseThrow(() -> new IllegalArgumentException("Unknown metadata type \"" + metadataTypeName + "\""));

        // check whether the input metadataType is LOG_PAGE_NO_TYPE_NAME, if so modify value accordingly
        if (LOG_PAGE_NO_TYPE_NAME.equals(metadataTypeName)) {
            value = createFakePagination(value);
        }
        try {
            Metadata md = new Metadata(metadataType);
            md.setValue(value);
            docstruct.addMetadata(md);
        } catch (MetadataTypeNotAllowedException e) {
            String message = "Error writing metadata \"" + metadataType.getName() + "\"";
            log.error(message, e);
            Helper.setFehlerMeldung(message, e);
        }
    }

    private String createFakePagination(String pagination) {
        if (!createNewPagination) {
            // just return the old one
            return pagination;
        }

        if (StringUtils.isBlank(paginationType) || "-".equals(paginationType)) {
            // no pagination needed
            return "";
        }

        // format the numbers according to the configured paginationType
        String value = formatPagination(pagination);
        if (!useFakePagination) {
            return value;
        }

        return "[" + value + "]";
    }

    private String formatPagination(String pagination) {
        String value = pagination.replace("[", "").replace("]", "");
        boolean isArabic = Pattern.matches("\\d+", value);
        int num;
        RomanNumeral roman = null;
        if (isArabic) {
            num = Integer.parseInt(value);
            roman = new RomanNumeral(num);
        } else {
            // create a Roman Numeral
            roman = new RomanNumeral(value.toUpperCase());
            num = roman.intValue();
        }

        switch (paginationType) {
            case "1":
                return String.valueOf(num);
            case "i":
                return roman.getNumber().toLowerCase();
            case "I":
                return roman.getNumber();
            default:
                // unknown types
                return value;
        }
    }

    private String generateValue(NewspaperPage referencePage, String value) {
        value = replaceRegexOccurrenceWith(
                value,
                TITLE_GENERATOR_DATE_PATTERN,
                m -> DateTimeFormatter.ofPattern(m.group(1)).format(referencePage.getDate().orElseThrow())
        );
        value = replaceRegexOccurrenceWith(
                value,
                TITLE_GENERATOR_ISSUE_NUMBER_PATTERN,
                m -> referencePage.getMetadata().number()
        );
        value = replaceRegexOccurrenceWith(
                value,
                TITLE_GENERATOR_ISSUE_PART_NUMBER_PATTERN,
                m -> referencePage.generatePartNumber()
        );
        return value;
    }

    private String replaceRegexOccurrenceWith(String s, Pattern regex, Function<Matcher, String> targetValueFunction) {
        var matcher = regex.matcher(s);
        if (matcher.find()) {
            String targetValue = null;
            try {
                targetValue = targetValueFunction.apply(matcher);
            } catch (RuntimeException e) {
                // Ignore any issues
            }
            if (StringUtils.isBlank(targetValue)) {
                targetValue = MISSING_PLACEHOLDER_VALUE;
            }
            s = matcher.replaceAll(targetValue);
        }
        return s;
    }
}
