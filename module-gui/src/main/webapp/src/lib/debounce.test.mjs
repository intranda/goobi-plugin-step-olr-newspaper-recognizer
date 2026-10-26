import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DebouncedEdits } from './debounce.ts';

/*
 * an input event as the browser hands it over: currentTarget is the field only while the event is dispatched, null afterwards (and
 * Svelte's delegated handler removes its own currentTarget once it is done)
 */
function type(handlers, value) {
	const event = { currentTarget: { value } };
	handlers.oninput(event);
	event.currentTarget = null;
}

test('the value typed is applied after the pause, when the input event is long over', async () => {
	const applied = [];
	const handlers = new DebouncedEdits(() => {}, 10).field('number', value => applied.push(value));
	type(handlers, '7');
	await new Promise(resolve => setTimeout(resolve, 30));
	assert.deepEqual(applied, ['7']);
});

test('leaving the field applies the value typed at once', () => {
	const applied = [];
	const handlers = new DebouncedEdits(() => {}, 1000).field('prefix', value => applied.push(value));
	type(handlers, 'A');
	handlers.onblur();
	assert.deepEqual(applied, ['A']);
});

test('Enter applies the last value typed', () => {
	const applied = [];
	const handlers = new DebouncedEdits(() => {}, 1000).field('date', value => applied.push(value));
	type(handlers, '1912-03-0');
	type(handlers, '1912-03-05');
	handlers.onkeydown({ key: 'Enter' });
	assert.deepEqual(applied, ['1912-03-05']);
});
