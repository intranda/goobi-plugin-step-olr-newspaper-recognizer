---
title: ZZZ
identifier: intranda_step_ZZZplugin_intranda_step_newspaperRecognizer
description: Step Plugin zur manuellen Ausgabenkontrolle
published: false
---

## Einführung
Diese Dokumentation erläutert das Plugin zur manuellen Ausgabenkontrolle. Dieses Step-Plugin für den Goobi-Workflow ermöglicht es Nutzern, METS-Dateien für Zeitungsbände anzureichern, sodass jede Zeitungsausgabe einfach mit Datums- und Ausgabenummer-Informationen für tausende Ausgaben definiert werden kann. Es erstellt automatisch Strukturelemente für jede Zeitungsausgabe, zusammen mit Metadaten in standardisierten und benutzerfreundlichen Formaten sowie mit Paginierungsinformationen.

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
Beim Betreten des Plugins werden alle Bilder einer Ausgabe zugeordnet. Das erste Bild ist hierbei die erste Seite der Ausgabe und wird etwas größer dargestellt. Alle Seiten rechts davon sind Folgeseiten der Ausgabe und werden kleiner dargestellt:

![Erstes Betreten des Plugins](screen3_de.png)

Mit einem Klick auf eine Folgeseite wird diese Seite zu einer neuen Ausgabeseite. Alle Folgeseiten danach werden zu Folgeseiten der neuen Ausgabe. Ein Klick auf die erste Seite einer Ausgabe auf der linken Seite macht diese Seite zu einer Folgeseite der vorherigen Ausgabe. Auf diese Weise werden zunächst alle Ausgabenseiten zu Ausgaben gemacht, indem die jeweiligen Seiten angeklickt werden.

Wenn die Maus über eine Seite bewegt wird während dabei die UMSCHALT Taste auf der Tastatur gehalten wird, wird die Seite vergrößert. So lassen sich Details wie das Datum der Ausgabe oder die Ausgabennummer besser ablesen. Diese Informationen werden in die Felder `Präfix`, `Nr. ` und `Suffix` eingetragen. Darüber hinaus kann der Ausgabentyp ausgewählt werden:

![Ausgabendetails eintragen](screen4_de.png)

Je nachdem welche Wochentage im oberen Bereich des Plugins aktiviert sind, werden bei einem Klick auf `Auf alle Ausgaben anwenden` die Datums- und Nummerierungsinformationen für alle Folgeausgaben berechnet:

![Ausgabeninformationen für Folgeausgaben berechnen](screen5_de.png)

Wenn eine Folgeseite einer Ausgabe angeklickt wird während dabei die STRG oder ALT Taste auf der Tastatur gehalten wird, wird diese Seite und alle folgenden Seiten zu einer Beilage. Beilage werden mit einem farbigen Kreis und einer Ziffer dargestellt. Unterhalb der Ausgabeninformationen taucht ein zusätzliches Auswahlmenü für den Beilagentypen auf. Jede Beilage kann individuell typisiert werden:

![Beilagen](screen6_de.png)

Nach dem Speichern und Verlassen des Plugins werden die Metadaten so aktualisiert, dass sie pro Ausgabe und Beilage passende Strukturelemente mit den jeweiligen Seitenzuweisungen und Metadaten enthalten.


## Konfiguration
Die Konfiguration des Plugins erfolgt in der Datei `plugin_intranda_step_newspaperRecognizer.xml` wie hier aufgezeigt:

{{CONFIG_CONTENT}}

{{CONFIG_DESCRIPTION_PROJECT_STEP}}

Parameter               | Erläuterung
------------------------|------------------------------------
`loadAllImages`                      | Hiermit kann eingestellt werden, dass beim Laden des Plugins alle Bilder direkt geladen werden sollen.
`showDeletePageButton`                      | Hiermit kann eingestellt werden, ob es möglich sein soll Seiten innerhalb dieses Plugins permanent zu löschen. Der Wert `true` aktiviert diese Funktion, `false` schaltet sie aus.
`dateFormat`                      | Hier kann eingestellt werden, in welchem Format das Datum einzugeben ist (siehe https://docs.oracle.com/javase/8/docs/api/java/text/SimpleDateFormat.html).
`pagination`                      | Das `pagination` Element definiert Paginierungseinstellungen. Mit `createNewPagination` kann gesteuert werden, ob eine neue Paginierung erzeugt werden soll. Der `type` gibt an, welches Format die Paginierung haben soll: `1` für arabische Zahlen, `i` für römische Zahlen, `I` für großgeschriebene römische Zahlen. Mit `useFakePagination` kann gesteuert werden, ob eine fingierte Paginierung erzeugt werden soll.
`issue`                      | Jeder Ausgabentyp, der mit dem Plugin erfassbar sein soll, muss hier konfiguriert werden. Pro Ausgabentyp muss es ein `issue` Element geben. Das `type` Attribut referenziert einen Strukturelementtypen aus dem Regelsatz, der für eine Ausgabe dieses Typs verwendet werden soll. Das Attribut `label` definiert die Beschriftung dieses Ausgabetypen im Auswahlmenü des Plugins. Hier kann auch ein Messagekey stehen, der in den Übersetzungsdateien übersetzt werden kann. Das `issue` Element kann beliebig viele oder keine `metadata` Elemente enthalten. Ein `metadata` Element hat einen `key` und einen `value`. Der `key` referenziert ein Metadatum aus dem Regelsatz, welches im jeweilig konfigurierten Strukturelement verfügbar sein muss. `value` definiert den Wert des Metadatums, welcher geschrieben werden soll. Es können die Platzhalter `{no}`, `{partNo}` und `{date:FORMAT}` verwendet werden, um im Wert des Metadatums die Ausgabennummer, Ausgabennummer mit Präfix und Suffix sowie das Datum in beliebigem `FORMAT` zu verwenden. Auf diese Weise können einfach Überschriften für die Ausgaben erzeugt werden.
`supplement`                      | Jeder Beilagentyp, der mit dem Plugin erfassbar sein soll, muss hier konfiguriert werden. Pro Beilagentyp muss es ein `supplement` Element geben. Die Beilagentypen sind analog zu den Ausgabentypen zu konfigurieren.
