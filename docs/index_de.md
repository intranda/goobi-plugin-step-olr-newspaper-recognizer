---
title: Kontrolle der Ausgabenerkennung innerhalb von Zeitungen
identifier: intranda_step_newspaperRecognizer
description: Step Plugin zur manuellen Ausgabenkontrolle in Zeitungen
published: true
keywords:
    - Goobi workflow
    - Plugin
    - Step Plugin
---

## Einführung
Diese Dokumentation erläutert das Plugin zur manuellen Ausgabenkontrolle. Dieses Step-Plugin für Goobi workflow ermöglicht es Nutzern, METS-Dateien für Zeitungsbände anzureichern, so dass bequem Datums- und Ausgaben-Informationen für zahlreiche Ausgaben innerhalb eines Bandes definiert werden können. Das Plugin erstellt automatisch Strukturelemente für jede Zeitungsausgabe zusammen mit Metadaten in standardisierten und benutzerfreundlichen Formaten sowie mit Paginierungsinformationen.

## Installation
Um das Plugin nutzen zu können, müssen folgende Dateien installiert werden:

```bash
/opt/digiverso/goobi/plugins/step/plugin-step-olr-newspaper-recognizer-base.jar
/opt/digiverso/goobi/plugins/GUI/plugin-step-olr-newspaper-recognizer-gui.jar
/opt/digiverso/goobi/config/plugin_intranda_step_newspaperRecognizer.xml
```

Nach der Installation des Plugins kann dieses innerhalb des Workflows für die jeweiligen Arbeitsschritte ausgewählt und somit automatisch ausgeführt werden. Ein Workflow könnte dabei beispielhaft wie folgt aussehen:

![Beispielhafter Aufbau eines Workflows](screen1_de.png)

Für die Verwendung des Plugins muss dieses in einem Arbeitsschritt ausgewählt sein:

![Konfiguration des Arbeitsschritts für die Nutzung des Plugins](screen2_de.png)


## Überblick und Funktionsweise

Das Plugin zeigt die Bilder eines Bandes als Blöcke. Jeder Block ist eine Struktur des Bandes (zum Beispiel eine Ausgabe oder ein Inhaltsverzeichnis), deren Typ aus dem Regelsatz stammt. Beim Öffnen liest das Plugin die Strukturen, die bereits in der METS-Datei vorhanden sind. Ein Band ohne Struktur beginnt mit den Blöcken der automatischen Analyse; ihr Typ steht noch auf „— bitte wählen —“.

![Blöcke eines Bandes](screen3_de.png)

Ein Klick auf eine Seite beginnt dort einen neuen Block; ein Klick auf die erste Seite eines Blocks entfernt ihn, seine Seiten gehören dann zum vorherigen Block. Ein Klick mit `STRG` oder `ALT` beginnt einen Unterblock (zum Beispiel eine Beilage) innerhalb eines Blocks; diese Seiten werden mit einer farbigen Ziffer markiert. Mit gedrückter `SHIFT`-Taste wird eine Seite beim Überfahren vergrößert.

Das Auswahlmenü eines Blocks bietet genau die Typen an, die der Regelsatz an dieser Stelle erlaubt, mit ihren Bezeichnungen aus dem Regelsatz. Ein Datumsfeld erscheint, wenn der Typ das konfigurierte Datumsmetadatum erlaubt, ein Nummernfeld (mit Präfix und Suffix, falls konfiguriert), wenn er das Nummernmetadatum erlaubt. Pflichtwerte sind mit `*` markiert. Gespeichert werden kann erst, wenn jeder Block einen Typ hat, alle Pflichtwerte gefüllt und alle Datumsangaben gültig sind und – falls konfiguriert – keine Duplikate vorliegen.

![Typ und Felder eines Blocks](screen4_de.png)

Zwei Werkzeuge füllen viele Blöcke auf einmal:

- **Typmuster anwenden** setzt die Typen eines Blocks und aller folgenden Blöcke derselben Ebene nach einem sich wiederholenden Muster, zum Beispiel Morgenausgabe, Abendausgabe. Datum und Nummer bleiben erhalten, wo der neue Typ diese Felder hat.
- **Ab hier fortsetzen** füllt Datum und Nummer ab einem Block. Berücksichtigt werden nur die gewählten Typen. Ein neuer Tag beginnt, sobald sich ein berücksichtigter Typ wiederholt. Die Nummer zählt pro Tag (Morgen 1, Abend 1, Morgen 2 …) oder pro Ausgabe (Morgen 1, Abend 2, Morgen 3 …). Wochentage und ein zweiwöchentlicher Rhythmus steuern das Datum. Eine Vorschau zeigt das Ergebnis vor dem Übernehmen. Typen werden nie geändert.

![Ab hier fortsetzen](screen5_de.png)

Strukturen und Metadaten, die das Plugin nicht verwaltet – zum Beispiel Artikel unterhalb einer Beilage oder eine im Metadateneditor ergänzte Notiz – bleiben erhalten. Ein Hinweis neben dem Block zeigt ihre Anzahl; ein Klick listet sie auf. Würde eine Änderung sie betreffen (Block entfernen, Typ oder Seiten ändern), fragt das Plugin, was mit ihnen geschehen soll. Beim Speichern gehen sie nie unbemerkt verloren.

![Zusätzliche Daten eines Blocks](screen6_de.png)

Beim Speichern wird die METS-Datei angepasst: neue Blöcke werden ergänzt, entfernte gelöscht, geänderte behalten alles, was das Plugin nicht verwaltet.

## Konfiguration
Die Konfiguration des Plugins erfolgt in der Datei `plugin_intranda_step_newspaperRecognizer.xml` wie hier aufgezeigt:

{{CONFIG_CONTENT}}

{{CONFIG_DESCRIPTION_PROJECT_STEP}}

Parameter               | Erläuterung
------------------------|------------------------------------
`loadAllImages`         | Ob beim Start des Plugins alle Bilder geladen werden.
`showDeletePageButton`  | Ob Bilder im Plugin dauerhaft gelöscht werden können.
`preventDuplicates`     | Bei `true` ist das Speichern gesperrt, solange zwei Blöcke mit demselben Elternelement denselben Typ, dasselbe Datum und dieselbe Nummer haben.
`pagination`            | `createNewPagination` legt fest, ob eine neue Paginierung erzeugt wird (gezählt innerhalb jedes Blocks). `type`: `1` arabisch, `i` römisch, `I` römisch in Großbuchstaben, `-` keine. `useFakePagination` schreibt `[N]`.
`fields/date`           | `metadata`: das Metadatum, das aus dem Datumsfeld geschrieben wird; Typen, die es nicht erlauben, haben kein Datumsfeld. `format`: Eingabeformat im Plugin (Standard `dd.MM.yyyy`). `storeFormat`: Format des gespeicherten Werts (Standard `yyyy-MM-dd`).
`fields/number`         | `metadata`: das Metadatum, das aus dem Nummernfeld geschrieben wird. `partMetadata`: das Metadatum für Präfix + Nummer + Suffix; ohne es gibt es keine Präfix- und Suffixfelder.
`generate`              | Zusätzliche Metadaten für Blöcke des Regelsatztyps `docstruct`. Jedes `metadata` hat einen `key` (für diesen Typ erlaubt), einen `value` mit optionalen Platzhaltern und optional `skipIfEmpty="true"`. Platzhalter: `{date:FORMAT}`, `{no}`, `{partNo}`, `{label}` (eigener Wert oder der des nächsten umschließenden Blocks), `{parent.date:FORMAT}`, `{parent.no}`, `{parent.partNo}`, `{parent.label}` (nur das direkte Elternelement). Ein leerer Platzhalter schreibt `[MISSING]`, mit `skipIfEmpty` gar nichts.

Typen, Bezeichnungen, die erlaubte Hierarchie und Pflichtmetadaten werden aus dem Regelsatz gelesen. Varianten wie Morgen- und Abendausgaben sind eigene Strukturtypen im Regelsatz; beide können als METS-Typ `issue` exportiert werden. Die Konfiguration wird beim Start des Plugins geprüft; Fehler werden im Plugin angezeigt, und das Speichern ist gesperrt, bis sie behoben sind.
