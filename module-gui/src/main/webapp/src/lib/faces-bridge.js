// @ts-check
/**
 * The bridge to the JSF forms of plugin_newspaperRecognizer.xhtml: the plugin page keeps its data in a hidden input and triggers the
 * backend by clicking hidden command links, whose AJAX requests report back through Faces' event callbacks.
 * Everything that touches those elements or `faces` is here, so the rest of the app can work with a fake of it.
 */

/**
 * @typedef {object} FormElements
 * @property {HTMLInputElement} data_el hidden input with the data as JSON (read on load and after a save, written before a save)
 * @property {HTMLElement} saveButton command link that saves the data
 * @property {HTMLElement} saveResultEl element whose text is 'SUCCESS' after a save that was written
 * @property {HTMLElement} finishButton command link that leaves the plugin
 * @property {HTMLElement} restartAnalysisButton command link that deletes the manual data and starts the analysis again
 * @property {HTMLElement} deleteFileButton command link that deletes the image named by the two hidden fields of delete_form
 */

/**
 * @typedef {object} SaveListener
 * @property {(busy: boolean) => void} busy a request is on its way / has been answered
 * @property {() => void} settled the save request has been answered, whatever its outcome
 * @property {() => void} succeeded the save request was processed (the result still says whether it was written)
 * @property {() => void} failed the save request never reached the backend
 */

export class FacesBridge {
	/** @param {FormElements} elements */
	constructor(elements) {
		this.dataEl = elements.data_el;
		this.saveButton = elements.saveButton;
		this.saveResultEl = elements.saveResultEl;
		this.finishButton = elements.finishButton;
		this.restartAnalysisButton = elements.restartAnalysisButton;
		this.deleteFileButton = elements.deleteFileButton;
	}

	/** The partial response replaces the elements, so they are re-resolved by id instead of read detached. */
	readData() {
		this.dataEl = /** @type {HTMLInputElement} */ (document.getElementById(this.dataEl.id)) || this.dataEl;
		return JSON.parse(this.dataEl.value);
	}

	/** @param {string} json */
	submitSave(json) {
		this.dataEl.value = json;
		this.saveButton.click();
	}

	/** True if the backend confirmed that the data was written. */
	saveSucceeded() {
		const el = document.getElementById(this.saveResultEl.id) || this.saveResultEl;
		return (el.textContent ?? '').trim() === 'SUCCESS';
	}

	finish() {
		this.finishButton.click();
	}

	restartAnalysis() {
		this.restartAnalysisButton.click();
	}

	/**
	 * @param {string} filename
	 * @param {number} index
	 */
	deleteFile(filename, index) {
		/** @type {HTMLInputElement} */ (document.getElementById('delete_form:file_name_to_delete')).value = filename;
		/** @type {HTMLInputElement} */ (document.getElementById('delete_form:file_id_to_delete')).value = String(index);
		this.deleteFileButton.click();
	}

	/**
	 * Listens to the AJAX requests of Faces. Faces resolves the source element by id, so the save button is compared by id, not identity.
	 * @param {SaveListener} listener
	 */
	listen(listener) {
		const isSave = (/** @type {{ source?: { id: string } }} */ data) => !!data.source && data.source.id === this.saveButton.id;
		faces.ajax.addOnEvent(data => {
			switch (data.status) {
				case 'begin':
					listener.busy(true);
					break;
				case 'complete':
					listener.busy(false);
					if (isSave(data)) {
						listener.settled();
					}
					break;
				case 'success':
					if (isSave(data)) {
						listener.succeeded();
					}
					break;
			}
		});
		faces.ajax.addOnError(data => {
			if (isSave(data)) {
				listener.failed();
			}
		});
	}
}
