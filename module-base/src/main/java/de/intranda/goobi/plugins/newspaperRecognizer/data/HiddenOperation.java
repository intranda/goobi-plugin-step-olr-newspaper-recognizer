package de.intranda.goobi.plugins.newspaperRecognizer.data;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/** The user's choice for hidden data of one block, sent with the save request. */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class HiddenOperation {
    private String blockId;
    private HiddenConflictKind kind;
    private HiddenAction action;
}
