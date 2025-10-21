---
title: Control of Issue Recognition within Newspapers
identifier: intranda_step_newspaperRecognizer
description: Step Plugin for manual issue control in newspapers
published: true
keywords:
    - Goobi workflow
    - Plugin
    - Step Plugin
---

## Introduction

This documentation explains the plugin for manual issue control. This step plugin for Goobi workflow allows users to enrich METS files for newspaper volumes, enabling convenient definition of date and issue information for numerous issues within a volume. The plugin automatically creates structural elements for each newspaper issue along with metadata in standardized and user-friendly formats, including pagination information.

## Installation

To use the plugin, the following files need to be installed:

```bash
/opt/digiverso/goobi/plugins/step/plugin-step-olr-newspaper-recognizer-base.jar
/opt/digiverso/goobi/plugins/GUI/plugin-step-olr-newspaper-recognizer-gui.jar
/opt/digiverso/goobi/config/plugin_intranda_step_newspaperRecognizer.xml
```

After installing the plugin, it can be selected within the workflow for respective operations and executed automatically. A sample workflow setup could look like this:

![Sample Workflow Structure](screen1_en.png)

To use the plugin, it must be selected in a workflow step:

![Configuration of the workflow step for plugin usage](screen2_en.png)

## Overview and Functionality

Upon entering the plugin, all images of an issue are assigned. The first image represents the first page of the issue and is displayed slightly larger. Subsequent pages to the right are considered continuation pages of the issue and are displayed smaller:

![Initial entry into the plugin](screen3_en.png)

Clicking on a continuation page designates it as a new issue page. Subsequent pages become continuation pages of the new issue. Clicking on the first page of an issue on the left makes it a continuation page of the previous issue. This process converts all issue pages into issues by clicking on respective pages.

Hovering over a page while holding down the `SHIFT` key enlarges the page for better readability of issue date or number details. These details are entered into fields labeled `Prefix`, `No.`, and `Suffix`. Additionally, the issue type can be selected:

![Entering issue details](screen4_en.png)

Depending on which weekdays are activated in the upper section of the plugin, clicking `Apply to all issues` calculates date and numbering information for all subsequent issues:

![Calculating issue information for subsequent issues](screen5_en.png)

Clicking on a continuation page while holding down the `CTRL` or `ALT` key designates this page and all following pages as supplements. Supplements are represented by a colored circle and a numeral. An additional selection menu for supplement type appears below issue information. Each supplement can be individually categorized:

![Supplements](screen6_en.png)

After saving and exiting the plugin, metadata is updated to include appropriate structural elements for each issue and supplement, along with respective page assignments and metadata.

## Configuration

Plugin configuration is done in the file `plugin_intranda_step_newspaperRecognizer.xml` as shown here:

{{CONFIG_CONTENT}}

{{CONFIG_DESCRIPTION_PROJECT_STEP}}

Parameter               | Explanation
------------------------|------------------------------------
`loadAllImages`        | This setting determines whether all images should be loaded when the plugin is launched.
`showDeletePageButton` | This setting determines if it should be possible to permanently delete pages within this plugin. `true` enables this function, `false` disables it.    
`dateFormat`           | Specifies the format for entering dates (see https://docs.oracle.com/javase/8/docs/api/java/text/SimpleDateFormat.html).    
`pagination`           | The `pagination` element defines pagination settings. `createNewPagination` controls whether a new pagination should be generated. `type` specifies the format of pagination: `1` for Arabic numerals, `i` for Roman numerals, `I` for uppercase Roman numerals. `useFakePagination` determines if fictitious pagination should be generated.
`issue`                | Each issue type that can be captured with the plugin must be configured here. Each issue type requires an `issue` element. The `type` attribute references a structural element type from the ruleset to be used for an issue of this type. The `label` attribute defines the label of this issue type in the plugin's selection menu. A description that can also be translated in translation files can be used here. The `issue` element can contain any number or no `metadata` elements. A `metadata` element has a `key` and a `value`. The `key` references a metadata from the rule set that must be available in the configured structural element. `value` defines the value of the metadata to be written. Placeholders `{no}`, `{partNo}` and `{date:FORMAT}` can be used to include the issue number, issue number with prefix and suffix, and date in any `FORMAT` in the metadata value. This way, headers for issues can easily be generated.
`supplement`           | Each supplement type that can be captured with the plugin must be configured here. Supplement types are configured analogously to issue types.                                                                                                                                                