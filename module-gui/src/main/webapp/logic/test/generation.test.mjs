import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, start, pages } from './fixtures.mjs';
import { applyTypePattern, continueFrom } from '../generation.mjs';

const ALL_DAYS = [true, true, true, true, true, true, true];
const options = (overrides = {}) => ({ include: ['MorningIssue', 'EveningIssue'], mode: 'perDay', weekdays: ALL_DAYS, biweekly: false, ...overrides });

/** One level-0 block per type letter: M = morning, E = evening, X = extra edition, T = table of contents. */
function sequence(letters) {
  const types = { M: 'MorningIssue', E: 'EveningIssue', X: 'ExtraEdition', T: 'TableOfContents' };
  return pages(...[...letters].map((letter, i) => ({
    depth: 1,
    starts: [start(types[letter], i === 0 ? { date: '1890-03-01', number: '1', prefix: 'Nr. ', suffix: 'a' } : {})],
  })));
}

const dates = result => result.pages.map(p => p.starts[0].date);
const numbers = result => result.pages.map(p => p.starts[0].number);

test('M E M E per day: 1, 1, 2, 2 on 01., 01., 02., 02.', () => {
  const result = continueFrom(sequence('MEME'), { page: 0, level: 0 }, options(), catalog);
  assert.deepEqual(numbers(result), ['1', '1', '2', '2']);
  assert.deepEqual(dates(result), ['1890-03-01', '1890-03-01', '1890-03-02', '1890-03-02']);
  assert.deepEqual(result.preview.map(r => r.note), ['start', 'sameDay', 'newDay', 'sameDay']);
  assert.equal(result.count, 3);
});

test('M E M E per issue: 1, 2, 3, 4', () => {
  const result = continueFrom(sequence('MEME'), { page: 0, level: 0 }, options({ mode: 'perIssue' }), catalog);
  assert.deepEqual(numbers(result), ['1', '2', '3', '4']);
  assert.deepEqual(dates(result), ['1890-03-01', '1890-03-01', '1890-03-02', '1890-03-02']);
});

test('M M E: a repeated morning issue starts a new day', () => {
  const perDay = continueFrom(sequence('MME'), { page: 0, level: 0 }, options(), catalog);
  assert.deepEqual(numbers(perDay), ['1', '2', '2']);
  assert.deepEqual(dates(perDay), ['1890-03-01', '1890-03-02', '1890-03-02']);
  assert.deepEqual(numbers(continueFrom(sequence('MME'), { page: 0, level: 0 }, options({ mode: 'perIssue' }), catalog)), ['1', '2', '3']);
});

test('blocks of types that are not included stay untouched', () => {
  const result = continueFrom(sequence('MXEM'), { page: 0, level: 0 }, options(), catalog);
  assert.deepEqual(numbers(result), ['1', null, '1', '2']);
  assert.equal(result.preview[1].note, 'notIncluded');
});

test('an included type without date gets the current day number, or the next number per issue', () => {
  const included = options({ include: ['MorningIssue', 'ExtraEdition'] });
  assert.deepEqual(numbers(continueFrom(sequence('MXM'), { page: 0, level: 0 }, included, catalog)), ['1', '1', '2']);
  assert.deepEqual(numbers(continueFrom(sequence('MXM'), { page: 0, level: 0 }, { ...included, mode: 'perIssue' }, catalog)), ['1', '2', '3']);
  assert.equal(continueFrom(sequence('MXM'), { page: 0, level: 0 }, included, catalog).pages[1].starts[0].date, null);
});

test('prefix and suffix are copied to part-numbered types only', () => {
  const result = continueFrom(sequence('MEX'), { page: 0, level: 0 }, options({ include: ['MorningIssue', 'EveningIssue', 'ExtraEdition'] }), catalog);
  assert.deepEqual([result.pages[1].starts[0].prefix, result.pages[1].starts[0].suffix], ['Nr. ', 'a']);
  assert.deepEqual([result.pages[2].starts[0].prefix, result.pages[2].starts[0].suffix], [null, null]);
});

test('weekdays and biweekly decide the next date', () => {
  const noSunday = [false, true, true, true, true, true, true];
  assert.deepEqual(dates(continueFrom(sequence('MM'), { page: 0, level: 0 }, options({ weekdays: noSunday }), catalog)), ['1890-03-01', '1890-03-03']);
  assert.deepEqual(dates(continueFrom(sequence('MM'), { page: 0, level: 0 }, options({ biweekly: true }), catalog)), ['1890-03-01', '1890-03-09']);
});

test('a start without date still numbers; without date and number nothing happens', () => {
  const list = sequence('MM');
  list[0].starts[0].date = null;
  const numbered = continueFrom(list, { page: 0, level: 0 }, options({ mode: 'perIssue' }), catalog);
  assert.deepEqual([numbers(numbered), dates(numbered)], [['1', '2'], [null, null]]);
  list[0].starts[0].number = 'IV';
  const nothing = continueFrom(list, { page: 0, level: 0 }, options(), catalog);
  assert.equal(nothing.error, 'NO_DATE_OR_NUMBER');
  assert.equal(nothing.pages, list);
});

test('continueFrom never changes types and leaves its input unchanged', () => {
  const list = sequence('MEME');
  const result = continueFrom(list, { page: 0, level: 0 }, options(), catalog);
  assert.deepEqual(result.pages.map(p => p.starts[0].type), list.map(p => p.starts[0].type));
  assert.equal(list[1].starts[0].number, null);
});

test('applyTypePattern loops over this and the following siblings and clears fields', () => {
  const list = sequence('MMMT');
  list[1].starts[0].date = '1890-03-02';
  const result = applyTypePattern(list, { page: 1, level: 0 }, ['EveningIssue', 'ExtraEdition'], catalog);
  assert.deepEqual(result.map(p => p.starts[0].type), ['MorningIssue', 'EveningIssue', 'ExtraEdition', 'EveningIssue']);
  assert.equal(result[1].starts[0].date, '1890-03-02');
  assert.equal(result[2].starts[0].date, null);
});

test('applyTypePattern on a child block stays within its parent', () => {
  const list = pages(
    { depth: 2, starts: [start('MorningIssue'), start(null)] },
    { depth: 2, starts: [start(null)] },
    { depth: 2, starts: [start('MorningIssue'), start(null)] },
  );
  const result = applyTypePattern(list, { page: 0, level: 1 }, ['TableOfContents'], catalog);
  assert.deepEqual([result[0].starts[1].type, result[1].starts[0].type, result[2].starts[1].type], ['TableOfContents', 'TableOfContents', null]);
});

test('dateMode perIssue: every included dated block gets the next date', () => {
  const result = continueFrom(sequence('MEME'), { page: 0, level: 0 }, options({ dateMode: 'perIssue', mode: 'perIssue' }), catalog);
  assert.deepEqual(dates(result), ['1890-03-01', '1890-03-02', '1890-03-03', '1890-03-04']);
  assert.deepEqual(numbers(result), ['1', '2', '3', '4']);
  assert.deepEqual(result.preview.map(r => r.note), ['start', 'newDay', 'newDay', 'newDay']);
});

test('dateMode perIssue respects weekdays, and per-day numbers follow the new dates', () => {
  const noSunday = [false, true, true, true, true, true, true];
  const result = continueFrom(sequence('MEM'), { page: 0, level: 0 }, options({ dateMode: 'perIssue', weekdays: noSunday }), catalog);
  assert.deepEqual(dates(result), ['1890-03-01', '1890-03-03', '1890-03-04']);
  assert.deepEqual(numbers(result), ['1', '2', '3']);
});
