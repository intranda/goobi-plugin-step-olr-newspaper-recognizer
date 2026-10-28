import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, start, pages } from './fixtures.mjs';
import { applyTypePattern, continueFrom, followingTypeCounts, groupByDay, movePatternEntry, numberModeMatters, previewDays } from './generation.mjs';

const ALL_DAYS = [true, true, true, true, true, true, true];
const options = (overrides = {}) => ({ include: ['MorningIssue', 'EveningIssue'], mode: 'perDay', weekdays: ALL_DAYS, biweekly: false, ...overrides });

/** One level-0 block per type letter: M = morning, E = evening, X = extra edition, T = table of contents, U = untyped. */
function sequence(letters) {
  const types = { M: 'MorningIssue', E: 'EveningIssue', X: 'ExtraEdition', T: 'TableOfContents', U: null };
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
  assert.deepEqual(result.preview.map(r => r.newDay), [false, true, false]);
  assert.equal(result.start.type, 'MorningIssue');
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
  assert.equal(result.preview[0].reason, 'excluded');
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

test('continueFrom reports the old and the new values of each following block, the start block apart', () => {
  const list = sequence('MEME');
  list[2].starts[0].date = '1890-03-05';
  list[2].starts[0].number = '7';
  const result = continueFrom(list, { page: 0, level: 0 }, options(), catalog);
  assert.deepEqual(result.start, { type: 'MorningIssue', date: '1890-03-01', number: '1', prefix: 'Nr. ', suffix: 'a' });
  assert.deepEqual(result.preview.map(r => r.ref.page), [1, 2, 3]);
  assert.deepEqual(result.preview[1].before, { date: '1890-03-05', number: '7' });
  assert.deepEqual(result.preview[1].after, { date: '1890-03-02', number: '2' });
  assert.deepEqual(result.preview[0].before, { date: null, number: null });
  assert.deepEqual(result.preview[0].after, { date: '1890-03-01', number: '1' });
});

test('continueFrom names why a block is not included', () => {
  const result = continueFrom(sequence('MXUTE'), { page: 0, level: 0 }, options({ include: ['MorningIssue', 'EveningIssue', 'TableOfContents'] }), catalog);
  assert.deepEqual(result.preview.map(r => r.reason), ['excluded', 'untyped', 'noFields', null]);
  assert.deepEqual(result.preview.map(r => r.changed), [false, false, false, true]);
  assert.deepEqual(result.preview[0].before, result.preview[0].after);
  assert.equal(result.count, 1);
});

test('continueFrom counts only the blocks whose values change', () => {
  const list = sequence('MEME');
  Object.assign(list[1].starts[0], { date: '1890-03-01', number: '1', prefix: 'Nr. ', suffix: 'a' });
  const result = continueFrom(list, { page: 0, level: 0 }, options(), catalog);
  assert.deepEqual(result.preview.map(r => r.changed), [false, true, true]);
  assert.equal(result.count, 2);
});

test('groupByDay starts a group at every new day; blocks before the first new day belong to the start day', () => {
  const result = continueFrom(sequence('MXEME'), { page: 0, level: 0 }, options(), catalog);
  const groups = groupByDay(result.preview, result.start);
  assert.deepEqual(groups.map(g => [g.date, g.dayNumber, g.rows.map(r => r.ref.page)]), [
    ['1890-03-01', '1', [1, 2]],
    ['1890-03-02', '2', [3, 4]],
  ]);
});

test('groupByDay with a number-only start puts all blocks in one group without date', () => {
  // the start block carries a date, but its type has none
  const result = continueFrom(sequence('XXX'), { page: 0, level: 0 }, options({ include: ['ExtraEdition'], mode: 'perIssue' }), catalog);
  assert.equal(result.start.date, null);
  const groups = groupByDay(result.preview, result.start);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].date, null);
  assert.deepEqual(groups[0].rows.map(r => r.after.number), ['2', '3']);
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
  assert.deepEqual(result.preview.map(r => r.newDay), [true, true, true]);
});

test('dateMode perIssue respects weekdays, and per-day numbers follow the new dates', () => {
  const noSunday = [false, true, true, true, true, true, true];
  const result = continueFrom(sequence('MEM'), { page: 0, level: 0 }, options({ dateMode: 'perIssue', weekdays: noSunday }), catalog);
  assert.deepEqual(dates(result), ['1890-03-01', '1890-03-03', '1890-03-04']);
  assert.deepEqual(numbers(result), ['1', '2', '3']);
});

test('movePatternEntry moves an entry and leaves its input unchanged', () => {
  const pattern = ['A', 'B', 'C'];
  assert.deepEqual(movePatternEntry(pattern, 0, 2), ['B', 'C', 'A']);
  assert.deepEqual(movePatternEntry(pattern, 2, 0), ['C', 'A', 'B']);
  assert.deepEqual(movePatternEntry(pattern, 1, 1), ['A', 'B', 'C']);
  assert.deepEqual(movePatternEntry(pattern, 0, -1), ['A', 'B', 'C']);
  assert.deepEqual(movePatternEntry(pattern, 2, 3), ['A', 'B', 'C']);
  assert.deepEqual(pattern, ['A', 'B', 'C']);
});

test('followingTypeCounts counts the types of the blocks after the start on its level', () => {
  assert.deepEqual(followingTypeCounts(sequence('MEMXEM'), { page: 0, level: 0 }), { EveningIssue: 2, MorningIssue: 2, ExtraEdition: 1 });
  assert.deepEqual(followingTypeCounts(sequence('MEM'), { page: 1, level: 0 }), { MorningIssue: 1 });
  assert.deepEqual(followingTypeCounts(sequence('M'), { page: 0, level: 0 }), {});
});

test('with a new date for every issue, per day and per issue count alike unless an included type has a number but no date', () => {
  const both = (letters, include) => ['perDay', 'perIssue'].map(mode =>
    numbers(continueFrom(sequence(letters), { page: 0, level: 0 }, options({ dateMode: 'perIssue', mode, include }), catalog)));
  const [perDay, perIssue] = both('MEME', ['MorningIssue', 'EveningIssue']);
  assert.deepEqual(perDay, perIssue);
  const [extraPerDay, extraPerIssue] = both('MXM', ['MorningIssue', 'ExtraEdition']);
  assert.notDeepEqual(extraPerDay, extraPerIssue);

  assert.equal(numberModeMatters({ dateMode: 'perDay', include: ['MorningIssue', 'EveningIssue'] }, catalog), true);
  assert.equal(numberModeMatters({ dateMode: 'perIssue', include: ['MorningIssue', 'EveningIssue'] }, catalog), false);
  assert.equal(numberModeMatters({ dateMode: 'perIssue', include: ['MorningIssue', 'ExtraEdition'] }, catalog), true);
  assert.equal(numberModeMatters({ dateMode: 'perIssue', include: ['MorningIssue', 'TableOfContents'] }, catalog), false);
});

// previewDays: the day groups of the continue preview with "only changes" (mockups 19, approach A)
const dayOf = (date, ...flags) => ({ date, dayNumber: null, rows: flags.map((flag, i) => ({ ref: { page: Number(date.slice(-2)) * 10 + i }, changed: flag === 'c', reason: flag === 's' ? 'excluded' : null })) });
const changedOrSkipped = row => row.changed || !!row.reason;
const outline = entries => entries.map(e => (e.fold ? `F${e.days.length}/${e.blocks}` : `D${e.rows.length}/${e.blocks}-${e.hidden}`));

test('previewDays folds each run of days without a shown row into one entry; days with one keep their shown rows', () => {
  const days = [dayOf('1912-03-01', '-'), dayOf('1912-03-02', '-', '-'), dayOf('1912-03-03', 'c', '-'), dayOf('1912-03-04', '-', '-'),
    dayOf('1912-03-05', '-', '-'), dayOf('1912-03-06', '-', 's'), dayOf('1912-03-07', '-', '-')];
  const entries = previewDays(days, changedOrSkipped, 20, true);
  assert.deepEqual(outline(entries), ['F2/3', 'D1/2-1', 'F2/4', 'D1/2-1', 'F1/2']);
  assert.deepEqual(entries[0].days.map(d => d.date), ['1912-03-01', '1912-03-02']);
  assert.deepEqual(entries[1].rows.map(r => r.changed), [true]);
});

test('previewDays without folding keeps every day, also one with no row left (today\'s view)', () => {
  const days = [dayOf('1912-03-01', '-', '-'), dayOf('1912-03-02', 'c', '-')];
  assert.deepEqual(outline(previewDays(days, changedOrSkipped, 20, false)), ['D0/2-2', 'D1/2-1']);
  assert.deepEqual(outline(previewDays(days, () => true, 20, false)), ['D2/2-0', 'D2/2-0']);
});

test('previewDays shows at most limit block rows; folds do not count, days and folds after the limit are left out', () => {
  const days = [dayOf('1912-03-01', 'c', 'c'), dayOf('1912-03-02', '-'), dayOf('1912-03-03', 'c', 'c'), dayOf('1912-03-04', '-'), dayOf('1912-03-05', 'c')];
  assert.deepEqual(outline(previewDays(days, changedOrSkipped, 3, true)), ['D2/2-0', 'F1/1', 'D1/2-0']);
});
