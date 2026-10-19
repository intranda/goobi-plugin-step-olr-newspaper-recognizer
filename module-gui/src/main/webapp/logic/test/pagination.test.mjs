import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streams, ruleValue, paginateBlock, initLabels } from '../pagination.mjs';
import { pages, start, settings, labels, DEFAULT_RULES } from './fixtures.mjs';

const I = (type, label = '') => ({ label, depth: 1, starts: [start(type)] });
const p = (label = '', depth = 1) => ({ label, depth });
const C = (type, label = '') => ({ label, depth: 2, starts: [start(type)] });

const keys = (result, indexes) => indexes.map(i => result.byPage[i]);

test('streams: a rule-less child stays in the parent stream', () => {
  const list = pages(I('MorningIssue'), p(), C('TableOfContents'), p('', 2));
  const result = streams(list, settings());
  assert.equal(new Set(keys(result, [0, 1, 2, 3])).size, 1);
  assert.equal(result.list.length, 1);
});

test('streams: a child with a rule opens its own stream and does not interrupt the parent', () => {
  const list = pages(I('MorningIssue'), p(), p(), C('NewspaperSupplement'), p('', 2), p());
  const result = streams(list, settings());
  assert.equal(result.list.length, 2);
  const issue = result.list.find(s => s.pages.includes(0));
  const supplement = result.list.find(s => s.pages.includes(3));
  assert.deepEqual(issue.pages, [0, 1, 2, 5]);
  assert.deepEqual(supplement.pages, [3, 4]);
  assert.notEqual(issue.key, supplement.key);
  assert.deepEqual(issue.rule, ['1']);
  assert.deepEqual(supplement.rule, ['i']);
  assert.equal(issue.block, 0);
  assert.equal(supplement.block, 0);
});

test('streams: continueInParent joins the children of one parent', () => {
  const list = pages(I('MorningIssue'), p(), C('NewspaperSupplement'), p('', 2), C('NewspaperSupplement'), p('', 2), p());
  const joined = settings({ ...DEFAULT_RULES, NewspaperSupplement: { beginsWith: ['i'], continueInParent: true } });
  const separate = settings({ ...DEFAULT_RULES, NewspaperSupplement: { beginsWith: ['i'], continueInParent: false } });
  const supplements = result => result.list.filter(s => s.pages.some(i => [2, 3, 4, 5].includes(i)));
  assert.deepEqual(supplements(streams(list, joined)).map(s => s.pages), [[2, 3, 4, 5]]);
  assert.deepEqual(supplements(streams(list, separate)).map(s => s.pages), [[2, 3], [4, 5]]);
});

test('streams: pages without block form one stream per run', () => {
  const list = pages(p('', 0), p('', 0), I('MorningIssue'), p(), p('', 0));
  const result = streams(list, settings());
  const loose = result.list.filter(s => s.block === -1);
  assert.deepEqual(loose.map(s => s.pages), [[0, 1], [4]]);
  assert.notEqual(loose[0].key, loose[1].key);
  assert.equal(result.list.find(s => s.pages.includes(2)).block, 2);
});

test('ruleValue uses the n-th rule value, then continues the last counting label', () => {
  const list = pages(I('MorningIssue', '–'), p('1'), p('7'));
  const rules = settings({ MorningIssue: { beginsWith: ['–', '1'] } });
  assert.deepEqual([0, 1, 2].map(i => ruleValue(list, rules, i)), ['–', '1', '2']);
});

test('ruleValue skips free text when continuing', () => {
  const list = pages(I('MorningIssue', '1'), p('Titelblatt'), p());
  assert.equal(ruleValue(list, settings(), 2), '2');
});

test('ruleValue is null without a rule', () => {
  const list = pages(I(null, '5'), p('6'));
  assert.equal(ruleValue(list, settings(), 1), null);
});

test('paginateBlock paginates each stream from its own rule', () => {
  const plain = pages(I('MorningIssue'), p(), C('NewspaperSupplement'), p('', 2), p());
  assert.equal(labels(paginateBlock(plain, settings(), 0)), '1 2 i ii 3');

  const twice = pages(I('MorningIssue'), p(), C('NewspaperSupplement'), p('', 2), p(), C('NewspaperSupplement'), p('', 2));
  const joined = settings({ ...DEFAULT_RULES, NewspaperSupplement: { beginsWith: ['i'], continueInParent: true } });
  assert.equal(labels(paginateBlock(twice, joined, 0)), '1 2 i ii 3 iii iv');
  assert.equal(labels(paginateBlock(twice, settings(), 0)), '1 2 i ii 3 i ii');
});

test('paginateBlock keeps untyped blocks', () => {
  const list = pages(I(null, '5'), p('6'), p('7'));
  assert.equal(labels(paginateBlock(list, settings(), 0)), '5 6 7');
});

test('initLabels normalises and remembers the METS label', () => {
  const list = pages({ label: ' 5 ' }, {});
  initLabels(list);
  assert.deepEqual(list.map(page => [page.label, page.metsLabel]), [['5', '5'], ['', '']]);
});

// Extra tests for spec behaviour not covered by the brief.

test('streams: continueInParent does not join the children of different parents', () => {
  const list = pages(I('MorningIssue'), C('NewspaperSupplement'), p('', 2), I('MorningIssue'), C('NewspaperSupplement'), p('', 2));
  const joined = settings({ ...DEFAULT_RULES, NewspaperSupplement: { beginsWith: ['i'], continueInParent: true } });
  const supplements = streams(list, joined).list.filter(s => s.rule[0] === 'i');
  assert.deepEqual(supplements.map(s => s.pages), [[1, 2], [4, 5]]);
});

test('streams: the key is stable for equal membership', () => {
  const list = pages(I('MorningIssue'), p(), p());
  assert.equal(streams(list, settings()).list[0].key, streams(pages(I('MorningIssue'), p(), p()), settings()).list[0].key);
});

test('paginateBlock does not change the input pages or pages outside the block', () => {
  const list = pages(p('x', 0), I('MorningIssue'), p(), I('MorningIssue', '9'));
  const out = paginateBlock(list, settings(), 1);
  assert.equal(labels(out), 'x 1 2 9');
  assert.equal(labels(list), 'x · · 9');
});

test('paginateBlock numbers a page of free text as uncounted and does not let it consume a number', () => {
  const list = pages(I('MorningIssue', '1'), p('Titelblatt'), p());
  assert.equal(labels(paginateBlock(list, settings(), 0)), '1 2 3');
});

test('ruleValue continues bracketed labels', () => {
  const list = pages(I('MorningIssue', '1'), p('[2]'), p());
  assert.equal(ruleValue(list, settings(), 2), '[3]');
});
