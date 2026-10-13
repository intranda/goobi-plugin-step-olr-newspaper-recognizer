package de.intranda.goobi.plugins.newspaperRecognizer.config;

import com.google.gson.annotations.SerializedName;

/** How the plugin shows a metadata field. Every other display type of the metadata display rules is shown as {@link #INPUT}. */
public enum FieldDisplay {
    @SerializedName("input")
    INPUT,
    @SerializedName("textarea")
    TEXTAREA,
    @SerializedName("readonly")
    READONLY,
    @SerializedName("select1")
    SELECT1
}
