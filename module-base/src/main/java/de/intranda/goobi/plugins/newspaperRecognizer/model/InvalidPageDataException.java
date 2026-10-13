package de.intranda.goobi.plugins.newspaperRecognizer.model;

/** The page list sent by the frontend does not describe a valid block tree. */
public class InvalidPageDataException extends Exception {
    private static final long serialVersionUID = 1L;

    public InvalidPageDataException(String message) {
        super(message);
    }
}
