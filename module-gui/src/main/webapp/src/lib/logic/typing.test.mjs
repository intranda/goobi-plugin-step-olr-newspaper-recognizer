import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewLabel, ownNumbering, followValue } from './typing.mjs';
import { pages, start, settings, labels, C } from './fixtures.mjs';

const I = (type, label = '') => ({ label, depth: 1, starts: [start(type)] });
const p = (label = '', depth = 1) => ({ label, depth });

// one MorningIssue with the given labels
const issue = (...list) => pages(I('MorningIssue', list[0]), ...list.slice(1).map(label => p(label)));

test('follow: the run continues the old sequence and stops at own numbering', () => {
  const list = issue('1', '2', '3', '4', '9');
  const result = previewLabel(list, settings(), 1, '5', 'follow');
  assert.equal(labels(result.pages), '1 5 6 7 9');
  assert.deepEqual(result.run, [2, 3]);
  assert.equal(result.stop, 4);
  assert.equal(result.kind, 'arabic');
});

test('toEnd counts on regardless of own numbering', () => {
  const list = issue('1', '2', '3', '4', '9');
  const result = previewLabel(list, settings(), 1, '5', 'toEnd');
  assert.equal(labels(result.pages), '1 5 6 7 8');
  assert.deepEqual(result.run, [2, 3, 4]); // derived
  assert.equal(result.stop, null);
});

test('single changes only this page', () => {
  const list = issue('1', '2', '3', '4', '9');
  const result = previewLabel(list, settings(), 1, '5', 'single');
  assert.equal(labels(result.pages), '1 5 3 4 9');
  assert.deepEqual(result.run, []);
});

test('empty text follows the page before again', () => {
  const list = issue('1', '5', '6', '7', '9');
  const result = previewLabel(list, settings(), 1, '', 'follow');
  assert.equal(labels(result.pages), '1 2 3 4 9');
  assert.equal(result.value, '2');
  assert.equal(result.kind, 'empty');
});

test('roman and free text', () => {
  const list = issue('1', '2', '3', '4', '5');
  const roman = previewLabel(list, settings(), 1, 'iv', 'follow');
  assert.equal(roman.kind, 'roman');
  assert.equal(labels(roman.pages), '1 iv v vi vii');
  const text = previewLabel(list, settings(), 1, 'Titelblatt', 'follow');
  assert.equal(text.kind, 'text');
  assert.deepEqual(text.run, []);
  assert.equal(labels(text.pages), '1 Titelblatt 3 4 5');
});

test('the run ends with the stream', () => {
  const list = pages(I('MorningIssue', '1'), p('2'), p('3'), I('MorningIssue', '1'), p('2'));
  const result = previewLabel(list, settings(), 1, '7', 'toEnd');
  assert.deepEqual(result.run, [2]);
  assert.equal(result.end, 2);
  assert.equal(labels(result.pages), '1 7 8 1 2');
});

test('ownNumbering', () => {
  const list = issue('1', '2', '3', '4', '9');
  assert.equal(ownNumbering(list, settings(), 4), true);
  assert.equal(ownNumbering(list, settings(), 2), false);
  assert.equal(ownNumbering(list, settings(), 0), false);
  const text = issue('1', 'Titelblatt', '3');
  assert.equal(ownNumbering(text, settings(), 1), false);
});

// extras (not in the brief)

test('extra: previewLabel does not change the given pages', () => {
  const list = issue('1', '2', '3');
  previewLabel(list, settings(), 1, '5', 'toEnd');
  assert.equal(labels(list), '1 2 3');
});

test('extra: followValue is the rule value, else the next value of the stream, else –', () => {
  const rules = settings({ MorningIssue: { beginsWith: ['–', '1'] } });
  assert.equal(followValue(pages(I('MorningIssue', '5'), p('x')), rules, 0), '–'); // derived: rule value of the first page
  assert.equal(followValue(issue('1', '7'), settings(), 1), '2'); // derived
  assert.equal(followValue(pages(p('', 0), p('7', 0)), settings({}, { withoutBlock: null }), 1), '–'); // derived
});

test('extra: a page that stops the run is not marked as stop when the run ends at the stream end', () => {
  const list = issue('1', '2', '3');
  const result = previewLabel(list, settings(), 1, '5', 'follow');
  assert.equal(result.stop, null); // derived
  assert.equal(result.end, 2); // derived
});

test('volume mode: typing in block 2 changes nothing in block 3', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const list = pages(I('MorningIssue', '1'), p('2'), I('MorningIssue', '3'), p('4'), I('MorningIssue', '5'), p('6'));
  for (const mode of ['follow', 'toEnd']) {
    const result = previewLabel(list, s, 2, '7', mode);
    assert.deepEqual(labels(result.pages).split(' '), ['1', '2', '7', '8', '5', '6']);
    assert.deepEqual(result.run, [3]); // derived
    assert.equal(result.stop, null); // derived
    assert.equal(result.end, 3); // derived
  }
});

test('typing on a parent page runs through a child that continues its parent', () => {
  const list = pages(I('MorningIssue', '1'), p('2'), C('TableOfContents', '3'), p('4', 2), p('5'), p('6'));
  const follow = previewLabel(list, settings(), 1, '10', 'follow');
  assert.equal(labels(follow.pages), '1 10 11 12 13 14');
  assert.deepEqual([follow.run, follow.stop, follow.end], [[2, 3, 4, 5], null, 5]);
  const toEnd = previewLabel(list, settings(), 1, '10', 'toEnd');
  assert.equal(labels(toEnd.pages), '1 10 11 12 13 14');
  assert.deepEqual([toEnd.run, toEnd.end], [[2, 3, 4, 5], 5]);
});
