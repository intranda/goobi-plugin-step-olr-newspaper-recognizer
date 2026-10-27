import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLabel, normalizeLabel, isCounting, nextLabel, follows } from '../labels.mjs';

const pick = ({ kind, number, prefix, suffix }) => ({ kind, number, prefix, suffix });

test('parseLabel recognises every row of the notation', () => {
  assert.equal(parseLabel('').kind, 'empty');
  assert.equal(parseLabel(' - ').kind, 'none');
  assert.equal(parseLabel('–').kind, 'none');
  assert.deepEqual(pick(parseLabel('S.12')), { kind: 'arabic', number: 12, prefix: 'S.', suffix: '' });
  assert.deepEqual(pick(parseLabel('12a')), { kind: 'arabic', number: 12, prefix: '', suffix: 'a' });
  assert.equal(parseLabel('iv').kind, 'roman');
  assert.equal(parseLabel('IX').upper, true);
  assert.equal(parseLabel('Titelblatt').kind, 'text');
  assert.equal(parseLabel('iiii').kind, 'text'); // invalid roman
  assert.equal(parseLabel('[3]').fictitious, true);
});

test('nextLabel continues arabic, roman, case, affixes and brackets', () => {
  assert.equal(nextLabel('5'), '6');
  assert.equal(nextLabel('S.12'), 'S.13');
  assert.equal(nextLabel('12a'), '13a');
  assert.equal(nextLabel('iv'), 'v');
  assert.equal(nextLabel('IX'), 'X');
  assert.equal(nextLabel('[3]'), '[4]');
  assert.equal(nextLabel('–'), null);
  assert.equal(nextLabel('Titelblatt'), null);
});

test('normalizeLabel trims, maps the dash and tightens brackets', () => {
  assert.equal(normalizeLabel(' [ 3 ] '), '[3]');
  assert.equal(normalizeLabel('-'), '–');
  assert.equal(normalizeLabel('  7 '), '7');
});

test('a single uppercase roman letter counts as roman', () => {
  assert.equal(parseLabel('C').kind, 'roman');
});

// additional tests, not in the brief

test('normalizeLabel maps uncounted and null like the Java side', () => {
  assert.equal(normalizeLabel('uncounted'), '–');
  assert.equal(normalizeLabel('–'), '–');
  assert.equal(normalizeLabel(null), '');
  assert.equal(normalizeLabel(undefined), '');
});

test('isCounting is true only for arabic and roman labels', () => {
  assert.equal(isCounting('7'), true);
  assert.equal(isCounting('iv'), true);
  assert.equal(isCounting('[3]'), true);
  assert.equal(isCounting(''), false);
  assert.equal(isCounting('–'), false);
  assert.equal(isCounting('Titelblatt'), false);
});

test('follows compares the normalized label with the continuation', () => {
  assert.equal(follows('5', '6'), true);
  assert.equal(follows('5', ' 6 '), true);
  assert.equal(follows('[3]', '[ 4 ]'), true);
  assert.equal(follows('5', '7'), false);
  assert.equal(follows('–', '1'), false);
  assert.equal(follows('Titelblatt', 'Titelblatt'), false);
});

test('nextLabel keeps the roman case across a length change', () => {
  assert.equal(nextLabel('viii'), 'ix');
  assert.equal(nextLabel('ix'), 'x');
  assert.equal(nextLabel('XIX'), 'XX');
});

test('nextLabel keeps the zero padding of an arabic number', () => {
  assert.equal(nextLabel('0001'), '0002');
  assert.equal(nextLabel('0099'), '0100');
  assert.equal(nextLabel('0999'), '1000');
  assert.equal(nextLabel('9999'), '10000');
  assert.equal(nextLabel('S.007a'), 'S.008a');
  assert.equal(nextLabel('[09]'), '[10]');
});

test('follows accepts the zero padded continuation', () => {
  assert.equal(follows('0001', '0002'), true);
  assert.equal(follows('0001', '2'), false);
});
