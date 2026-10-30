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

Ein Klick auf eine Seite beginnt dort einen neuen Block; ein Klick auf die erste Seite eines Blocks entfernt ihn, seine Seiten gehören dann zum vorherigen Block. Ein Klick mit `STRG` oder `ALT` beginnt einen Unterblock (zum Beispiel eine Beilage) innerhalb eines Blocks, der bis zum Ende des Blocks oder bis zum nächsten Unterblock reicht; auf der ersten Seite eines Unterblocks entfernt er ihn, auf einer späteren Seite teilt er ihn; diese Seiten werden mit einer farbigen Ziffer markiert. Mit gedrückter `SHIFT`-Taste wird eine Seite beim Überfahren vergrößert.

Das Auswahlmenü eines Blocks bietet genau die Typen an, die der Regelsatz an dieser Stelle erlaubt, mit ihren Bezeichnungen aus dem Regelsatz. Ein Datumsfeld erscheint, wenn der Typ das konfigurierte Datumsmetadatum erlaubt, ein Nummernfeld (mit Präfix und Suffix, falls konfiguriert), wenn er das Nummernmetadatum erlaubt. Darunter folgen die konfigurierten Metadatenfelder des Typs, zum Beispiel der Titel. Ein Feld mit generiertem Wert zeigt diesen Wert an und aktualisiert ihn, während sich Datum und Nummer ändern; er kann überschrieben werden. Ein überschriebener Wert ist hervorgehoben und hat im Feld eine Schaltfläche, die den generierten Wert wiederherstellt. Ändert sich der generierte Wert danach, etwa weil die Nummer geändert wurde, bekommt diese Schaltfläche einen Punkt; ein Klick zeigt den neuen Wert, der übernommen oder verworfen werden kann. Das gilt nur für Änderungen seit dem Öffnen des Plugins. Ändert sich der Typ eines Blocks, bleiben Werte aus Feldern, die der neue Typ nicht anzeigt, als zusätzliche Daten erhalten; Werte, die der neue Typ nicht erlaubt, werden im Dialog zur Typänderung aufgeführt. Pflichtwerte sind mit `*` markiert. Gespeichert werden kann erst, wenn jeder Block einen Typ hat, alle Pflichtwerte gefüllt und alle Datumsangaben gültig sind und – falls konfiguriert – keine Duplikate vorliegen. Was das Speichern sperrt, ist an dem Block markiert, an dem es entsteht; siehe „Fehler und Speichern“.

![Typ und Felder eines Blocks](screen4_de.png)

Zwei Werkzeuge füllen viele Blöcke auf einmal:

- **Typfolge wiederholen** (im Typ-Feld) setzt die Typen eines Blocks und aller folgenden Blöcke derselben Ebene nach einem sich wiederholenden Muster, zum Beispiel Morgenausgabe, Abendausgabe. Datum und Nummer bleiben erhalten, wo der neue Typ diese Felder hat.
- **Datum und Nummer fortsetzen** (je nach Typ auch „Datum fortsetzen“ oder „Nummer fortsetzen“; ein Button rechts neben den Feldern Datum und Nummer) füllt Datum und Nummer ab einem Block. Berücksichtigt werden nur die gewählten Typen. Ein neuer Tag beginnt entweder, sobald sich ein berücksichtigter Typ wiederholt, oder mit jedem berücksichtigten Block (Option „neues Datum für jede Ausgabe“). Die Nummer zählt pro Tag (Morgen 1, Abend 1, Morgen 2 …) oder pro Ausgabe (Morgen 1, Abend 2, Morgen 3 …); bei „neues Datum für jede Ausgabe“ ist beides gleich, die Einstellung ist dann gesperrt (außer ein berücksichtigter Typ hat eine Nummer, aber kein Datum). Die Erscheinungstage (einzeln wählbar oder per Schnellwahl täglich, Mo–Sa, Mo–Fr) und ein zweiwöchentlicher Rhythmus steuern das Datum. Die Vorschau listet die folgenden Blöcke nach Erscheinungstag; ein geänderter Wert steht hervorgehoben, der bisherige klein und durchgestrichen darüber. Nicht berücksichtigte Blöcke sind grau, ein Symbol nennt den Grund. Der Schalter „Nur Änderungen zeigen“ über der Vorschau blendet Blöcke aus, deren Werte gleich bleiben. Ein Tag mit Änderungen behält seine Kopfzeile und nennt, wie viele seiner Blöcke ausgeblendet sind; aufeinanderfolgende Tage ohne Änderung stehen in einer Zeile (z. B. „Mo 04.03.1912 – Mi 06.03.1912 · 3 Tage, 6 Blöcke ohne Änderung“), die sich mit dem Pfeil davor aufklappen lässt. Eine Zeile unter der Vorschau zählt die ausgeblendeten Blöcke, „alle zeigen“ holt sie zurück. Nicht berücksichtigte Blöcke bleiben immer sichtbar. Übernommen werden nur Blöcke, die sich ändern. Typen werden nie geändert.

![Datum und Nummer fortsetzen](screen5_de.png)

Strukturen und Metadaten, die das Plugin nicht verwaltet – zum Beispiel Artikel unterhalb einer Beilage oder eine im Metadateneditor ergänzte Notiz – bleiben erhalten. Ein Hinweis neben dem Block zeigt ihre Anzahl; ein Klick listet sie auf. Der Bereich „Hinweise“ nennt zusätzlich, wie viele Blöcke solche Daten haben (ein Button springt dorthin), und zeigt die zusätzlichen Daten des ganzen Bandes. Würde eine Änderung sie betreffen (Block entfernen, Typ oder Seiten ändern), fragt das Plugin, was mit ihnen geschehen soll. Beim Speichern gehen sie nie unbemerkt verloren.

![Zusätzliche Daten eines Blocks](screen6_de.png)

Jede Seite zeigt ihre Seitenbezeichnung unter der Vorschau; sie kann dort bearbeitet werden. Beim Tippen zeigt das Plugin, was erkannt wurde und welche der folgenden Seiten mitzählen; `Enter` übernimmt die Bezeichnung. Die Regeln, nach denen Blöcke paginiert werden (erste Bezeichnung je Typ, Seiten ohne Block), werden im Dialog „Paginierung“ im Aktionsmenü oder mit dem letzten Eintrag „Paginierungsregeln“ im Auswahlfeld „Paginierung“ eines Blocks bearbeitet; eine Vorschau zeigt vor dem Übernehmen, was sich ändert. Der Dialog listet die Regeln aus der Plugin-Konfiguration und darunter die in dieser Sitzung angelegten; weitere Typen kommen über „Regel hinzufügen“ dazu. Konfigurierte Regeln lassen sich für die Sitzung ändern oder entfernen und einzeln oder mit „Konfigurierte Regeln zurücksetzen“ wiederherstellen; die Konfigurationsdatei bleibt unverändert. Die Paginierung der Seiten, die seit dem letzten Speichern geändert wurden, stellt der Eintrag „Paginierung aus dem METS wiederherstellen“ im Aktionsmenü (⋮) wieder her; vorher fragt das Plugin nach und nennt, wie viele Seiten ihre Bezeichnung aus dem METS zurückbekommen und dass die Änderungen an ihnen verloren gehen. Der Eintrag erscheint nur, solange sich Bezeichnungen vom METS unterscheiden.

Jeder Block, auch verschachtelte, hat ein Auswahlfeld „Paginierung“, das angibt, wie seine Seiten gezählt werden. Es bietet die Regeln (die erste Bezeichnung je Typ aus der Konfiguration oder dem Regeldialog, zum Beispiel „1, 2, 3“ oder „i, ii, iii“) und unter einem Trenner die Fortsetzungen: „Zählung des vorigen Blocks fortsetzen“ bei einem Block der obersten Ebene, „Zählung des übergeordneten Blocks fortsetzen“ oder „Zählung des vorigen Blocks vom Typ <Typ> fortsetzen“ bei einem verschachtelten Block; ein nicht mögliches Angebot (kein früherer Block) ist ausgegraut. Eine Auswahl nummeriert die Seiten des Blocks sofort neu, und der Block behält seine Auswahl bei Strukturänderungen: spätere Änderungen nummerieren ihn danach neu, und Blöcke, die ihn fortsetzen, folgen. Ein neuer Block oder ein Block mit neuem Typ beginnt mit der für seinen Typ konfigurierten Regel (ohne Regel: unnummeriert bei einem Block der obersten Ebene, die Zählung des Elternblocks bei einem verschachtelten Block); der Eintrag „unnummeriert“ (–) lässt seine Seiten ohne Nummer. Der letzte Eintrag „Paginierungsregeln“ öffnet den Regeldialog. Wurden Bezeichnungen eines Blocks von Hand geändert, zeigt das Feld „von Hand geändert“; wer dann einen anderen Eintrag wählt, wird vorher gefragt, da die von Hand geänderten Bezeichnungen ersetzt werden.

Bei automatischer Paginierung kann eine Strukturänderung dazu führen, dass die Bezeichnungen eines Blocks von dem abweichen, was die Regeln ergäben. Eigene Bezeichnungen werden nie stillschweigend überschrieben; stattdessen zeigt der Block unter seinen Feldern ein Angebot: Der Text nennt, wie viele Seiten sich ändern würden, „Neu nach Regeln“ übernimmt genau diese Seiten sofort, das Kreuz blendet das Angebot aus. Eine von Hand getippte Bezeichnung ändert nur ihren eigenen Block. Zählt der Block danach weiter nach einem Eintrag seines Auswahlfelds „Paginierung“, werden die folgenden Blöcke, die seine Zählung fortsetzen, mit ihm neu nummeriert; wird er „von Hand geändert“ (oder wurde nur diese eine Bezeichnung geändert), behalten sie ihre Bezeichnungen, und jeder, der sich ändern würde, zeigt stattdessen ein solches Angebot. Ein Angebot verschwindet, sobald sich sein Block ändert. Sind zwei oder mehr Angebote offen, fasst ein Eintrag im Bereich „Hinweise“ sie zusammen (Anzahl der Blöcke und Seiten) mit den Buttons „Alle neu nach Regeln“, „Prüfen“, „Zum nächsten springen“ und „Alle ausblenden“. „Prüfen“ öffnet den Regeldialog mit dem Überschreib-Umfang „nur die angebotenen Seiten“; nur diese Seiten werden geändert und nur ihre Angebote entfallen.

Die Vorschau im Regeldialog zeigt eine Zeile je Block des gewählten Umfangs: die erste Seite mit Vorschaubild, den Typ (Unterblöcke eingerückt, mit ihrer Farbe) und die erste und letzte Bezeichnung vorher und nachher, zum Beispiel `111–118 → 1–8`, rechts die Zahl der geänderten Seiten. Bilden die Bezeichnungen eines Blocks keine zusammenhängende Zählung, werden sie stattdessen als Liste gezeigt. Ein Klick auf den Pfeil einer Zeile zeigt die Seiten des Blocks mit ihrer neuen Bezeichnung und, falls geändert, der alten darüber durchgestrichen. Zunächst hat jeder Block eine eigene Zeile. Mit dem Schalter „Nur Änderungen zeigen“ über der Vorschau werden Blöcke ohne Änderung je Folge in einer grauen Zeile zusammengefasst („12 Blöcke ohne Änderung“), die sich ebenfalls aufklappen lässt; „Alle aufklappen“ / „Alle zuklappen“ öffnet oder schließt alle Zeilen auf einmal.

Beim Speichern wird die METS-Datei angepasst: neue Blöcke werden ergänzt, entfernte gelöscht, geänderte behalten alles, was das Plugin nicht verwaltet.

### Hinweise

Über den Blöcken steht eine einzelne, eingeklappte Zeile „Hinweise“. Sie nennt je Gruppe die Zahl der Einträge, zum Beispiel „1 sperrt das Speichern · 2 zu entscheiden · 3 zur Info“; ein Klick klappt sie auf. Sie steht immer da, solange das Plugin geöffnet ist, scrollt mit der Seite und klappt nicht von selbst auf. Gibt es keinen Eintrag, lautet sie „Hinweise · keine“. Ein Eintrag verschwindet, sobald seine Ursache behoben ist. Die Einträge stehen in drei Gruppen:

- **Speichern gesperrt:** Konfigurationsfehler und Probleme, die das Speichern verhindern (fehlender Typ, fehlender Pflichtwert, ungültiges Datum, Duplikat), Probleme an einem Block jeweils mit einem Button, der zu diesem Block springt.
- **Zu entscheiden:** ab zwei offenen Angeboten die Zusammenfassung der Paginierungsangebote.
- **Zur Info:** nicht gespeicherte Änderungen, Blöcke mit zusätzlichen Daten, zusätzliche Daten des Bandes und Meldungen vom Laden.

### Fehler und Speichern

Was das Speichern sperrt, bleibt am Block sichtbar (das betroffene Feld ist rot mit Meldung); über den Blöcken erscheint dafür kein Balken mehr. Die Schaltflächen „Speichern“ und „Speichern und Plugin verlassen“ sind klickbar, sobald es etwas zu speichern gibt, auch wenn das Speichern gesperrt ist. In diesem Fall öffnet ein Klick den Dialog „Speichern nicht möglich“, der die Punkte auflistet, Probleme an einem Block mit je einem Button zum Block; ein Klick auf einen Button schließt den Dialog und springt dorthin. Es wird nichts geschrieben, solange etwas das Speichern sperrt. Das Verlassen ohne Speichern fragt wie bisher nach.

### Nicht gespeicherte Änderungen

Alles, was sich von der zuletzt gespeicherten METS-Datei unterscheidet, ist orange markiert (die Farbe, die Goobi für Geändertes verwendet):

- **Feld:** geänderter Wert orange und fett, mit einem schmalen orangen Balken links vom Feld (Typ, Datum, Nummer, Präfix, Suffix, Metadatenfelder, Seitenbezeichnungen).
- **Block:** ein orangefarbener Streifen am linken Rand der Zeile, wenn sich am Block etwas geändert hat, also Typ, Werte, Seiten, Verschachtelung oder Entscheidungen zu zusätzlichen Daten („Zusätzliche Daten geändert“). Unterblöcke werden in ihrer eigenen Zeile markiert.
- **Neuer Block:** der Block trägt zusätzlich „neuer Block“ mit einem Stift-Symbol.
- **Speichern-Schaltfläche:** ein kleiner orangefarbener Punkt, solange etwas ungespeichert ist.

Wird ein Wert auf den gespeicherten zurückgesetzt, verschwindet seine Markierung. Nach einem erfolgreichen Speichern sind alle Markierungen weg. Der Eintrag „Nicht gespeichert: 3 Blöcke, 5 Seitenbezeichnungen“ im Bereich „Hinweise“ fasst es zusammen (ein gelöschtes Bild zählt als „1 gelöschte Seite“, bis das Speichern danach gelungen ist); ein Button springt der Reihe nach zu geänderten Blöcken und zu geänderten Seitenbezeichnungen, auch außerhalb von Blöcken (ohne erreichbares Ziel, etwa bei nur geänderten zusätzlichen Daten des Bandes, fehlt der Button). Die Markierung eines überschriebenen generierten Werts (Punkt im Feld, siehe oben) bleibt davon unabhängig.

### Bedienhinweise

Die Zeile mit den Bedienhinweisen über den Blöcken gibt es nicht mehr. Die Hinweise zur Maus (Klick, `STRG`/`ALT`, `SHIFT`) stehen im Hilfemenü von Goobi (Symbol Person oben in der Navigation, „Hilfefunktionen anzeigen“) unter „Tastenkombinationen“, im Abschnitt „Zeitungserkennung“. Beim Laden der Bilder zeigt das Plugin weiterhin einen Fortschrittsbalken.

### Durch den ganzen Band zählen

Standardmäßig beginnt jeder Block der obersten Ebene seine Zählung neu. Mit der Auswahl „Zählung“ = „durch den ganzen Band zählen“ im Regeldialog (vorausgewählt durch `countThroughVolume="true"` an `pagination`) setzt der Dialog bei allen Blöcken der obersten Ebene, für deren Typ eine Regel gilt, den Eintrag „Zählung des vorigen Blocks fortsetzen“; sie teilen sich so einen gemeinsamen Zählstrom in Seitenreihenfolge: `… 7 8 | 9 10 …`. Die Einstellung wählt nur die Dialogauswahl vor; danach zählt das Auswahlfeld des jeweiligen Blocks. Unterblöcke haben ein eigenes Auswahlfeld; standardmäßig behalten sie ihre eigene Zählung. Seiten ohne Block behalten ihren eigenen Strom; die Bandzählung überspringt sie und setzt danach fort, ebenso Blöcke der obersten Ebene ohne Regel.

Ein nicht zählender erster Wert wie `–` bei `beginsWith = "– 1"` gilt in jedem Block (`… 7 8 | – 9 10 …`); ein zählender Startwert gilt nur im ersten Block, spätere Blöcke zählen ab dem letzten zählenden Wert davor weiter. Haben Typen der obersten Ebene unterschiedliche Regeln (zum Beispiel einer `1`, ein anderer `i`), wird der zählende Wert der Regel eines späteren Blocks nicht verwendet: der Block setzt den Strom fort.

Bei automatischer Paginierung paginiert eine Strukturänderung nur bis zum Ende des geänderten Blocks, ebenso setzt eine eingegebene Bezeichnung die Zählung nur bis zum Ende ihres Blocks fort. Jeder spätere Block, dessen Bezeichnungen die Bandzählung ändern würde, erhält sein eigenes Angebot; ab zwei Angeboten erscheint der Eintrag im Bereich „Hinweise“ mit „Alle neu nach Regeln“. Die Angebote werden nach jeder Änderung neu berechnet: Ein Angebot verschwindet hier nicht schon, wenn sich sein Block ändert, sondern sobald der Block zur Bandzählung passt.

## Konfiguration
Die Konfiguration des Plugins erfolgt in der Datei `plugin_intranda_step_newspaperRecognizer.xml` wie hier aufgezeigt:

{{CONFIG_CONTENT}}

{{CONFIG_DESCRIPTION_PROJECT_STEP}}

Parameter               | Erläuterung
------------------------|------------------------------------
`loadAllImages`         | Ob beim Start des Plugins alle Bilder geladen werden.
`showDeletePageButton`  | Ob Bilder im Plugin dauerhaft gelöscht werden können.
`preventDuplicates`     | Bei `true` ist das Speichern gesperrt, solange zwei Blöcke mit demselben Elternelement denselben Typ, dasselbe Datum und dieselbe Nummer haben.
`pagination`            | Paginierung der Seiten. `enabled` (Standard `true`): bei `false` zeigt das Plugin keine Seitenbezeichnungen und ändert eine vorhandene Paginierung nie. `automatic` (Standard `true`): Vorgabe, ob Blöcke bei jeder Strukturänderung nach den Regeln paginiert werden; im Regeldialog umschaltbar. `countThroughVolume` (Standard `false`): wählt die Dialogauswahl „Zählung“ (in jedem Block neu beginnen / durch den ganzen Band zählen), siehe „Durch den ganzen Band zählen“. Ohne das Element gelten alle Standardwerte.
`withoutBlock`          | In `pagination`: `beginsWith` ist die erste Bezeichnung der Seiten außerhalb von Blöcken (Standard `–`, unpaginiert).
`rule`                  | In `pagination`: Regel für den Regelsatztyp `docstruct`. `beginsWith`: erste Bezeichnung eines Blocks dieses Typs, ein oder mehrere durch Leerzeichen getrennte Werte, zum Beispiel `1`, `i`, `I`, `[1]` (fiktiv), `–` (unpaginiert) oder `– 1`. `continueInParent` (Standard `false`): Unterblöcke dieses Typs im selben Elternblock zählen einander fort. Typen ohne Regel: Blöcke der obersten Ebene bleiben unpaginiert (–), verschachtelte Blöcke zählen die Zählung ihres Elternblocks fort. Unbekannte Typen, doppelte Regeln und ein leeres `beginsWith` sind Konfigurationsfehler. Die früheren `createNewPagination`, `type` und `useFakePagination` werden nicht mehr unterstützt und als Konfigurationsfehler gemeldet.
`defaults`              | Die Felder aller Typen, deren Regelsatz das Metadatum des Feldes erlaubt, auf jeder Ebene (auch in Unterblöcken).
`type`                  | Felder für den Regelsatztyp `docstruct`. Ein Feld mit demselben `key` wie ein Standardfeld ersetzt es an seiner Stelle; weitere Felder folgen nach den Standardfeldern.
`field`                 | `key`: das Metadatum. `role="date"` / `role="number"` (nur in `defaults`, je höchstens einmal): das Datums- bzw. Nummernfeld eines Blocks. Beim Datumsfeld ist `format` das Eingabeformat im Plugin (Standard `dd.MM.yyyy`) und `storeFormat` das Format des gespeicherten Werts (Standard `yyyy-MM-dd`); beim Nummernfeld ist `partKey` das Metadatum für Präfix + Nummer + Suffix (ohne es gibt es keine Präfix- und Suffixfelder). Ohne `value` ist das Feld ein Eingabefeld. `value` erzeugt den angezeigten Wert, der überschrieben werden kann. `hidden="true"` erzeugt den Wert bei jedem Speichern, ohne ihn anzuzeigen (erfordert `value`). Platzhalter: `{date:FORMAT}`, `{no}`, `{partNo}`, `{label}` (eigener Wert oder der des nächsten umschließenden Blocks), `{parent.date:FORMAT}`, `{parent.no}`, `{parent.partNo}`, `{parent.label}` (nur das direkte Elternelement). Ein leerer Platzhalter schreibt `[MISSING]`, mit `skipIfEmpty="true"` gar nichts. Sichtbare Felder unterstützen die Datumszeichen `d`, `dd`, `M`, `MM`, `yy`, `yyyy` und Text in einfachen Anführungszeichen.

Typen, Bezeichnungen, die erlaubte Hierarchie und Pflichtmetadaten werden aus dem Regelsatz gelesen. Die Bezeichnungen der Felder stammen aus dem Regelsatz, ihre Eingabeart aus der `goobi_metadataDisplayRules.xml` des Projekts des Vorgangs: unterstützt werden `input`, `textarea`, `readonly` und `select1`, jede andere Art wird als `input` angezeigt. Ein `select1`-Feld kann keinen `value` haben. Varianten wie Morgen- und Abendausgaben sind eigene Strukturtypen im Regelsatz; beide können als METS-Typ `issue` exportiert werden. Die Konfiguration wird beim Start des Plugins geprüft; Fehler werden im Plugin angezeigt, und das Speichern ist gesperrt, bis sie behoben sind.
