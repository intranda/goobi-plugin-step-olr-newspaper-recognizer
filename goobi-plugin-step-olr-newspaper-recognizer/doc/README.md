# Installationsanleitung OSX

## Homebrew updaten

Zunächst mal `brew` installieren:

    /usr/bin/ruby -e "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install)"

## Python und Pip installieren

    brew install python
	pip2 install --upgrade pip

## MXnet installieren

	pip2 install --upgrade setuptools
	pip2 install mxnet==0.11.0

## Python und die Installation testen

Installation testen, indem zunächst Python betreten wird:

	python2

Darin Zeile für Zeile folgenden Code einfügen:

	import mxnet as mx
	a = mx.nd.ones((2, 3))
	b = a * 2 + 1
	b.asnumpy()
	exit()

# Aufrufen des Recognizers

Material auf den Rechner kopieren und anschließend mit dem Python-Script anwenden.

	python2 predict_cnn.py <input_folder> <tmp_dir> <output_file>
	
Konkreter Aufruf für das Demomaterial innerhalb dieses Eclipse-Projekts:

	python2 predict_cnn.py material/demmta_1911 tmp_demmta_1911 demmta_1911.json
	
# Installation innerhalb eines Goobi Workflows

## Kopieren der richtigen Dateien:

Die beiden Konfigurationsdateien `goobi_opac.xml` und `goobi_projects.xml` aus dem doc-Ordner in den Goobi-config-Pfad kopieren. Also üblicherweise in eines dieser beiden Verzeichnisse:
	
	/opt/digiverso/goobi/config/
	/opt/digiverso/g2g/goobi/config/
	
Den Regelsatz `ruleset.xml` in den Regelsatz-Ordner von Goobi kopieren, also üblicherweise:

	/opt/digiverso/goobi/rulesets/
	/opt/digiverso/g2g/goobi/rulesets/

Die Dateien `predict_cnn.pypredict_cnn.py`, `issue_model_0.01-symbol.json` und `issue_model_0.01-0009.params`in den Scripts-Ordner kopieren, also üblicherweise nach:

	/opt/digiverso/goobi/scripts/
	/opt/digiverso/g2g/goobi/scripts/


## Workflow aufsetzen und konfigurieren

Es muss einen Arbeitsschritt geben, in dem das python-Script aufgerufen wird und dem die richtigen Parameter übergeben werden. Der Aufruf sieht im Allgeimenen in Goobi so aus:

	/bin/bash -c "/usr/local/bin/python2 {scriptsFolder}predict_cnn.py {origpath} {imagepath}/thumbs_cnn {processpath}/taskmanager/issues_result.json {scriptsFolder}issue_model_0.01 2>/dev/null"
	
Im nachfolgenden Arbeitsschritt wird das richtige Plugin eingebunden, so dass es für ein manuelles Betreten verfügbar ist:

	intranda_step_newspaperRecognizer	

## Workflow testen

Nun einen neuen Vorgang für den Workflow anlegen und dabei beachten, dass es sich bei dem Publikationstyp um eine Zeitung handeln muss. Andernfalls wird die Generierung der METS-Datei nicht wie gewünscht funktionieren.
	