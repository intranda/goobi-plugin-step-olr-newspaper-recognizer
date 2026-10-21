import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FacesBridge } from './faces-bridge.js';

/* a page with the elements of the bridge and a Faces whose callbacks the test can fire */
function setup(resultText = 'SUCCESS') {
	const elements = {};
	const make = id => (elements[id] = { id, value: '', textContent: '', clicks: 0, click() { this.clicks++; } });
	const names = ['data_el', 'saveButton', 'saveResultEl', 'finishButton', 'restartAnalysisButton', 'deleteFileButton'];
	const form = Object.fromEntries(names.map(name => [name, make('form:' + name)]));
	make('delete_form:file_name_to_delete');
	make('delete_form:file_id_to_delete');
	form.saveResultEl.textContent = ` ${resultText}\n`;
	globalThis.document = { getElementById: id => elements[id] ?? null };
	const callbacks = {};
	globalThis.faces = { ajax: { addOnEvent: fn => (callbacks.event = fn), addOnError: fn => (callbacks.error = fn) } };
	const calls = [];
	const listener = Object.fromEntries(['busy', 'settled', 'succeeded', 'failed'].map(name => [name, (...args) => calls.push([name, ...args])]));
	return { form, elements, bridge: new FacesBridge(form), callbacks, calls, listener };
}

test('submitSave writes the data and clicks the save button', () => {
	const { bridge, form } = setup();
	bridge.submitSave('{"pages":[]}');
	assert.equal(form.data_el.value, '{"pages":[]}');
	assert.equal(form.saveButton.clicks, 1);
});

test('readData parses the data element, re-resolved by id', () => {
	const { bridge, elements } = setup();
	elements['form:data_el'].value = '{"pages":[1]}';
	assert.deepEqual(bridge.readData(), { pages: [1] });
});

test('saveSucceeded reads the trimmed text of the result element', () => {
	assert.equal(setup('SUCCESS').bridge.saveSucceeded(), true);
	assert.equal(setup('ERROR').bridge.saveSucceeded(), false);
});

test('deleteFile fills the hidden fields of delete_form before it clicks', () => {
	const { bridge, form, elements } = setup();
	bridge.deleteFile('0003.tif', 2);
	assert.equal(elements['delete_form:file_name_to_delete'].value, '0003.tif');
	assert.equal(elements['delete_form:file_id_to_delete'].value, '2');
	assert.equal(form.deleteFileButton.clicks, 1);
});

test('finish and restartAnalysis click their links', () => {
	const { bridge, form } = setup();
	bridge.finish();
	bridge.restartAnalysis();
	assert.equal(form.finishButton.clicks, 1);
	assert.equal(form.restartAnalysisButton.clicks, 1);
});

test('events of the save button are passed on, those of other sources are only busy', () => {
	const { bridge, callbacks, calls, listener } = setup();
	bridge.listen(listener);
	const save = { id: 'form:saveButton' };
	const other = { id: 'form:other' };
	callbacks.event({ status: 'begin', source: save });
	callbacks.event({ status: 'success', source: save });
	callbacks.event({ status: 'complete', source: save });
	callbacks.event({ status: 'begin', source: other });
	callbacks.event({ status: 'success', source: other });
	callbacks.event({ status: 'complete', source: other });
	assert.deepEqual(calls, [
		['busy', true], ['succeeded'], ['busy', false], ['settled'],
		['busy', true], ['busy', false],
	]);
});

test('an error of the save request is reported, one of another request is not', () => {
	const { bridge, callbacks, calls, listener } = setup();
	bridge.listen(listener);
	callbacks.error({ source: { id: 'form:other' } });
	callbacks.error({ source: { id: 'form:saveButton' } });
	callbacks.error({});
	assert.deepEqual(calls, [['failed']]);
});
