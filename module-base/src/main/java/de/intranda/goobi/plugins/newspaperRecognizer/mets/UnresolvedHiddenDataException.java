package de.intranda.goobi.plugins.newspaperRecognizer.mets;

import java.util.List;

/** Saving would drop or misplace hidden data the user has not decided about. */
public class UnresolvedHiddenDataException extends Exception {
    private static final long serialVersionUID = 1L;
    private final List<String> problems;

    public UnresolvedHiddenDataException(List<String> problems) {
        super(String.join("; ", problems));
        this.problems = List.copyOf(problems);
    }

    public List<String> getProblems() {
        return problems;
    }
}
