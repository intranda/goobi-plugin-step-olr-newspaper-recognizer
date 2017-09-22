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

	python2 predict_cnn.py material/thumbnails/

Der neue Aufruf mit Zielpfad lautet dann:

	python2 predict_cnn.py <input_folder> <tmp_dir> <output_file>
	
Konkreter Aufruf für das Demomaterial innerhalb dieses Eclipse-Projekts:

	python2 predict_cnn.py material/demmta_1911 tmp_demmta_1911 demmta_1911.json
	
