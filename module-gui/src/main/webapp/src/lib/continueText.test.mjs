import { test } from 'node:test';
import assert from 'node:assert/strict';
import { continueTexts } from './continueText.ts';

const P = 'plugin_newspaperRecognizer_';
const messages = {
	[P + 'monday']: 'Montag',
	[P + 'wednesday']: 'Mittwoch',
	[P + 'friday']: 'Freitag',
	[P + 'preview_number']: 'Nr.',
	[P + 'continue_foldDaysOne']: '1 Tag',
	[P + 'continue_foldDays']: '{0} Tage',
	[P + 'preview_unchangedOne']: '1 Block ohne Änderung',
	[P + 'preview_unchanged']: '{0} Blöcke ohne Änderung',
};
const t = key => messages[key] ?? key;
const fmt = (key, ...args) => t(key).replace(/\{(\d+)\}/g, (match, i) => args[i] ?? match);
const texts = continueTexts({ t, fmt, dateFormatPattern: 'dd.MM.yyyy' });

test('dayText puts the short weekday in front of the date in the pattern of the volume', () => {
	assert.equal(texts.dayText('1912-03-01'), 'Fr 01.03.1912');
	assert.equal(texts.dayText('1912-03-04'), 'Mo 04.03.1912');
});

test('dayText leaves a value that is no date as it is', () => {
	assert.equal(texts.dayText('unknown'), 'unknown');
});

test('dayHeader names the date, and the number only when the number counts per day', () => {
	const day = { date: '1912-03-01', dayNumber: '61' };
	assert.equal(texts.dayHeader(day, false), 'Fr 01.03.1912');
	assert.equal(texts.dayHeader(day, true), 'Fr 01.03.1912 · Nr. 61');
	assert.equal(texts.dayHeader({ date: null, dayNumber: '61' }, true), 'Nr. 61');
	assert.equal(texts.dayHeader({ date: null, dayNumber: null }, true), '');
});

test('foldText names a single day by itself and a run by its first and last day', () => {
	const days = [
		{ date: '1912-03-04', dayNumber: null },
		{ date: '1912-03-05', dayNumber: null },
		{ date: '1912-03-06', dayNumber: null },
	];
	assert.equal(texts.foldText({ days: days.slice(0, 1), blocks: 1 }), 'Mo 04.03.1912 · 1 Tag, 1 Block ohne Änderung');
	assert.equal(texts.foldText({ days, blocks: 6 }), 'Mo 04.03.1912 – Mi 06.03.1912 · 3 Tage, 6 Blöcke ohne Änderung');
});

test('foldText names the days by their number when the volume has no dates', () => {
	const days = [{ date: null, dayNumber: '3' }, { date: null, dayNumber: '4' }];
	assert.equal(texts.foldText({ days, blocks: 2 }), 'Nr. 3 – Nr. 4 · 2 Tage, 2 Blöcke ohne Änderung');
});
