import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseByPattern, formatByPattern, fromIso, toIso, addDays, weekday, nextDate, WEEKDAY_PRESETS } from '../dates.mjs';

const ALL_DAYS = [true, true, true, true, true, true, true];

test('parseByPattern reads valid dates in the configured pattern', () => {
  assert.deepEqual(parseByPattern('01.03.1890', 'dd.MM.yyyy'), { y: 1890, m: 3, d: 1 });
  assert.deepEqual(parseByPattern('1890-03-01', 'yyyy-MM-dd'), { y: 1890, m: 3, d: 1 });
  assert.deepEqual(parseByPattern(' 01.03.1890 ', 'dd.MM.yyyy'), { y: 1890, m: 3, d: 1 });
});

test('parseByPattern rejects impossible or malformed dates', () => {
  assert.equal(parseByPattern('31.02.1890', 'dd.MM.yyyy'), null);
  assert.equal(parseByPattern('1.3.1890', 'dd.MM.yyyy'), null);
  assert.equal(parseByPattern('1890', 'dd.MM.yyyy'), null);
  assert.equal(parseByPattern('', 'dd.MM.yyyy'), null);
  assert.equal(parseByPattern(null, 'dd.MM.yyyy'), null);
});

test('formatByPattern and ISO round trip', () => {
  assert.equal(formatByPattern({ y: 1890, m: 3, d: 1 }, 'dd.MM.yyyy'), '01.03.1890');
  assert.equal(toIso(fromIso('0999-12-31')), '0999-12-31');
  assert.equal(fromIso('1890-13-01'), null);
});

test('addDays and weekday cross month and year ends', () => {
  assert.deepEqual(addDays({ y: 1890, m: 12, d: 31 }, 1), { y: 1891, m: 1, d: 1 });
  assert.equal(weekday({ y: 1890, m: 3, d: 2 }), 0); // a Sunday
});

test('nextDate adds one day, or eight when biweekly', () => {
  assert.deepEqual(nextDate({ y: 1890, m: 3, d: 1 }, { weekdays: ALL_DAYS, biweekly: false }), { y: 1890, m: 3, d: 2 });
  assert.deepEqual(nextDate({ y: 1890, m: 3, d: 1 }, { weekdays: ALL_DAYS, biweekly: true }), { y: 1890, m: 3, d: 9 });
});

test('nextDate skips disabled weekdays', () => {
  const noSunday = [false, true, true, true, true, true, true];
  assert.deepEqual(nextDate({ y: 1890, m: 3, d: 1 }, { weekdays: noSunday, biweekly: false }), { y: 1890, m: 3, d: 3 });
});

test('nextDate without any enabled weekday does not loop', () => {
  assert.deepEqual(nextDate({ y: 1890, m: 3, d: 1 }, { weekdays: [false, false, false, false, false, false, false], biweekly: false }), { y: 1890, m: 3, d: 2 });
});

test('weekday presets are indexed like weekday() (0 = Sunday)', () => {
  assert.deepEqual(WEEKDAY_PRESETS.daily, [true, true, true, true, true, true, true]);
  assert.deepEqual(WEEKDAY_PRESETS.monToSat, [false, true, true, true, true, true, true]);
  assert.deepEqual(WEEKDAY_PRESETS.monToFri, [false, true, true, true, true, true, false]);
});
