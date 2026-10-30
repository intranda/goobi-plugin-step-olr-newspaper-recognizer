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

The plugin shows the images of a volume as blocks. Each block is a structure of the volume (for example an issue or a table of contents) whose type comes from the ruleset. When the plugin is opened, it reads the structures that already exist in the METS file. A volume without structure starts with the blocks found by the automatic analysis; their type is still "— please select —".

![Blocks of a volume](screen3_en.png)

A click on a page starts a new block there; a click on the first page of a block removes it, and its pages join the previous block. A click with `CTRL` or `ALT` starts a child block (for example a supplement) inside a block that runs to the end of the block or to the next child block; on the first page of a child block it removes it, on a later page it splits it; such pages are marked with a coloured number. Hovering over a page while holding `SHIFT` enlarges it.

The drop-down of a block offers exactly the types the ruleset allows at that position, with their labels from the ruleset. A date field appears if the type allows the configured date metadata, a number field (with prefix and suffix, if configured) if it allows the number metadata. Below them follow the configured metadata fields of the type, for example the title. A field with a generated value shows that value and updates it while date and number change; it can be overwritten. An overwritten value is highlighted and has a button inside the field to restore the generated value. If the generated value changes afterwards, for example because the number was changed, this button gets a dot; clicking it shows the new value, which can be taken or dismissed. This only covers changes since the plugin was opened. When the type of a block changes, values entered in fields the new type does not show are kept as additional data; values the new type does not allow are listed in the dialog for the type change. Required values are marked with `*`. The plugin cannot be saved while a block has no type, a required value is missing, a date is invalid or — if configured — two blocks are duplicates. What blocks saving is marked at the block where it arises; see "Errors and saving".

![Type and fields of a block](screen4_en.png)

Two tools fill many blocks at once:

- **Repeat type sequence …** (in the type field) sets the types of a block and all following blocks on the same level in a repeating pattern, for example morning issue, evening issue. Date and number are kept where the new type has these fields.
- **Continue date and no. …** (depending on the type also "Continue date …" or "Continue no. …"; one button to the right of the date and number fields) fills in dates and numbers from a block onwards. Only the selected types are included. A new day starts either as soon as an included type repeats, or with every included block (option "new date for every issue"). Numbers count per day (morning 1, evening 1, morning 2 …) or per issue (morning 1, evening 2, morning 3 …); with "new date for every issue" both are the same, so the setting is locked (unless an included type has a number but no date). The publication days (chosen one by one or with the quick choices daily, Mon–Sat, Mon–Fri) and a biweekly rhythm control the dates. The preview lists the following blocks by publication day; a changed value is highlighted with the old one small and struck through above it. Blocks that are not included are greyed out, with an icon that names the reason. The switch "Show changes only" above the preview hides blocks whose values stay the same. A day with changes keeps its header and says how many of its blocks are hidden; consecutive days without changes share one row (e.g. "Mo 04.03.1912 – We 06.03.1912 · 3 days, 6 blocks without change") that opens with the arrow in front of it. A line below the preview counts the hidden blocks, with "show all" to bring them back. Blocks that are not included are always shown. Only blocks that change are applied. Types are never changed.

![Continue date and no.](screen5_en.png)

Structures and metadata that the plugin does not manage – for example articles below a supplement or a note added in the metadata editor – are kept. A badge next to the block shows how many there are; a click lists them. The "Notes" section also says how many blocks have such data (a button jumps there) and shows the additional data of the whole volume. If a change would affect them (removing the block, changing its type or its pages), the plugin asks what to do with them. Saving never drops them silently.

![Additional data of a block](screen6_en.png)

Every page shows its pagination label under its thumbnail; it can be edited there. While typing, the plugin shows what it recognised and which of the following pages count on, and `Enter` accepts the label. The rules by which blocks are paginated (the first label per type, pages without block) are edited in the dialog "Pagination …" of the actions menu or with "Rules …" in the "Pagination" row of a top-level block, which shows the rule of the block's type; a preview shows what would change before it is applied. The dialog lists the rules from the plugin configuration and below them the rules created in this session; further types are added with "Add rule". Configured rules can be changed or removed for the session and restored one by one or with "Reset the configured rules"; the configuration file stays unchanged. The "Notes" section points out pages without pagination in the METS (they can be generated by the rules). The pagination of pages changed since the last save is restored by the entry "Restore pagination from the METS …" in the actions menu (⋮); before that the plugin asks, naming how many pages get their label from the METS back and that the changes to them are lost. The entry appears only while labels differ from the METS.

With automatic pagination, a structure change can leave the labels of a block different from what the rules would give. Own labels are never overwritten silently; instead the block shows an offer below its fields: the text says how many pages would change, "Renumber by the rules" applies exactly these pages at once, and the cross hides the offer. An offer disappears when its block changes. If two or more offers are open, an entry in the "Notes" section sums them up (number of blocks and pages) with the buttons "Renumber all by the rules", "Review …", "Jump to the next" and "Hide all". "Review …" opens the rules dialog with the overwrite scope "only the offered pages"; only these pages are changed and only their offers are cleared.

The preview of the rules dialog lists one row per block of the chosen scope: the first page with its thumbnail, the type (child blocks indented, with their colour) and the first and last label before and after, for example `111–118 → 1–8`, with the number of changed pages on the right. A block whose labels are not one counting sequence shows its labels as a list instead. A click on the arrow of a row shows the pages of the block with their new label and, if changed, the old one struck through above it. At first every block has its own row. With the switch "Show changes only" above the preview, blocks without change are folded into one grey line per run ("12 blocks without change"), which can be unfolded as well; "Expand all" / "Collapse all" opens or closes all rows at once.

Saving updates the METS file in place: new blocks are added, removed blocks are deleted, changed blocks keep everything the plugin does not manage.

### Notes

Above the blocks there is a single collapsed row "Notes". It gives the number of entries per group, for example "2 to decide · 3 for information"; a click expands it. It is always there while the plugin is open, scrolls with the page and does not expand on its own. If there is no entry, it reads "Notes · none". An entry disappears as soon as its cause is gone. The entries are in three groups:

- **Saving blocked:** configuration errors and problems that prevent saving (missing type, missing required value, invalid date, duplicate), problems at a block each with a button that jumps to that block.
- **To decide:** pages without pagination in the METS (generate, jump to the next, hide) and – from two open offers on – the summary of the pagination offers.
- **For information:** unsaved changes, blocks with additional data, additional data of the volume and notices from loading.

### Errors and saving

What blocks saving stays visible at the block (the affected field is red with a message); there is no bar above the blocks for it any more. The buttons "Save" and "Save and Exit plugin" can be clicked as soon as there is something to save, even while saving is blocked. In that case a click opens the dialog "Saving not possible", which lists the points, problems at a block each with a button to the block; a click on a button closes the dialog and jumps there. Nothing is written while something blocks saving. Leaving without saving still asks for confirmation.

### Unsaved changes

Everything that differs from the last saved METS file is marked in orange (the colour Goobi uses for changes):

- **Field:** a changed value in orange and bold, with a thin orange bar to the left of the field (type, date, number, prefix, suffix, metadata fields, page labels).
- **Block:** an orange stripe at the left edge of the row if something about the block changed, that is type, values, pages, nesting or decisions about additional data ("Additional data changed"). Child blocks are marked in their own row.
- **New block:** the block also carries "new block" with a pencil icon.
- **Save button:** a small orange dot while anything is unsaved.

If a value is set back to the saved one, its marker disappears. After a successful save all markers are gone. The entry "Not saved: 3 blocks, 5 page labels" in the "Notes" section sums it up (a deleted image counts as "1 deleted page" until the save after it has succeeded); a button jumps in turn to changed blocks and to changed page labels, also outside blocks (without a reachable target, for example when only the volume's additional data changed, the button is missing). The marker of an overwritten generated value (dot in the field, see above) is independent of this.

### Usage hints

The line with usage hints above the blocks no longer exists. The hints on the mouse (click, `CTRL`/`ALT`, `SHIFT`) are in Goobi's help menu (the person icon in the top navigation, "Show help functions") under "Keyboard shortcuts", in the section "Newspaper recognition". While images load, the plugin still shows a progress bar.

### Counting through the whole volume

By default every top-level block begins its numbering anew. With the choice "Counting" = "count through the whole volume" in the rules dialog (default set by `countThroughVolume="true"` on `pagination`), all top-level blocks that have a rule share one counting stream in page order: `… 7 8 | 9 10 …`. Child blocks keep their own numbering. Pages without block keep their own stream; the volume count skips them and carries on after them, and so do top-level blocks without a rule.

A non-counting first value such as `–` in `beginsWith = "– 1"` applies in every block (`… 7 8 | – 9 10 …`); a counting start value applies only in the first block, later blocks continue from the last counting label before them. If top-level types have different rules (for example one with `1`, another with `i`), the counting value of a later block's rule is not used: the block continues the stream.

With automatic pagination, a structure change paginates only up to the end of the changed block, and a typed label continues the count only up to the end of its block. Every later block whose labels the volume count would change gets its own offer; from two offers on the entry in the "Notes" section with "Renumber all by the rules" appears. The offers are recalculated after every change: here an offer does not disappear as soon as its block changes, but once the block fits the volume count.

## Configuration

Plugin configuration is done in the file `plugin_intranda_step_newspaperRecognizer.xml` as shown here:

{{CONFIG_CONTENT}}

{{CONFIG_DESCRIPTION_PROJECT_STEP}}

Parameter               | Explanation
------------------------|------------------------------------
`loadAllImages`         | Whether all images are loaded when the plugin starts.
`showDeletePageButton`  | Whether images can be deleted permanently within the plugin.
`preventDuplicates`     | If `true`, saving is blocked while two blocks with the same parent have the same type, date and number.
`pagination`            | Pagination of the pages. `enabled` (default `true`): if `false`, the plugin shows no page labels and never changes an existing pagination. `automatic` (default `true`): default for paginating blocks by the rules whenever their structure changes; it can be switched in the rules dialog. `countThroughVolume` (default `false`): default of the dialog choice "Counting" (restart in every block / count through the whole volume), see "Counting through the whole volume". Without the element all defaults apply.
`withoutBlock`          | In `pagination`: `beginsWith` is the first label of pages outside any block (default `–`, unnumbered).
`rule`                  | In `pagination`: rule for the ruleset type `docstruct`. `beginsWith`: the first label of a block of this type, one or more values separated by spaces, for example `1`, `i`, `I`, `[1]` (fictitious), `–` (unnumbered) or `– 1`. `continueInParent` (default `false`): child blocks of this type in the same parent continue each other's numbering. Types without a rule: top-level blocks are unnumbered (–), nested blocks continue the numbering of their parent. Unknown types, duplicate rules and an empty `beginsWith` are configuration errors. The former `createNewPagination`, `type` and `useFakePagination` are no longer supported and are reported as configuration errors.
`defaults`              | The fields of every type whose ruleset allows the field's metadata, on every level (child blocks included).
`type`                  | Fields for the ruleset type `docstruct`. A field with the same `key` as a default field replaces it in place; further fields follow the default fields.
`field`                 | `key`: the metadata. `role="date"` / `role="number"` (only in `defaults`, at most once each): the date or number field of a block. For the date field `format` is the input format in the plugin (default `dd.MM.yyyy`) and `storeFormat` the format of the stored value (default `yyyy-MM-dd`); for the number field `partKey` is the metadata for prefix + number + suffix (without it there are no prefix and suffix fields). Without `value` the field is an editable field. `value` generates the value shown, which can be overwritten. `hidden="true"` generates the value on every save without showing it (requires `value`). Placeholders: `{date:FORMAT}`, `{no}`, `{partNo}`, `{label}` (own value or that of the nearest enclosing block), `{parent.date:FORMAT}`, `{parent.no}`, `{parent.partNo}`, `{parent.label}` (direct parent only). An empty placeholder writes `[MISSING]`, or nothing with `skipIfEmpty="true"`. Visible fields support the date tokens `d`, `dd`, `M`, `MM`, `yy`, `yyyy` and text in single quotes.

Types, labels, the allowed hierarchy and required metadata are read from the ruleset. Labels of the fields come from the ruleset, their input type from `goobi_metadataDisplayRules.xml` of the process's project: `input`, `textarea`, `readonly` and `select1` are supported, every other type is shown as `input`. A `select1` field cannot have a `value`. Variants such as morning and evening issues are separate structure types in the ruleset; both can be exported as METS type `issue`. The configuration is checked when the plugin starts; errors are shown in the plugin and saving is disabled until they are fixed.
