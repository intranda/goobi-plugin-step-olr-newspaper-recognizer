import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streams, ruleValue, paginateBlock, initLabels, structureChanged, blockOffer } from '../pagination.mjs';
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

// structureChanged: before and after are page lists carrying the old labels; labels(result.pages) is the outcome.

/** Page list from page specs without labels and a label line ('·' = empty). */
const lab = (specs, text) => {
  const words = text.split(' ');
  return pages(...specs.map((spec, i) => ({ ...spec, label: words[i] === '·' ? '' : words[i] })));
};
const loose = () => p('', 0);
const M = 'MorningIssue';
const offerShape = offers => offers.map(o => ({ first: o.first, pages: o.pages }));
const EXTRA_RULES = { ...DEFAULT_RULES, ExtraEdition: { beginsWith: ['[1]'] } };

test('structureChanged: new block takes its rule', () => {
  const before = lab([I(M), p(), p(), p(), p(), p()], '1 2 3 4 5 6');
  const after = lab([I(M), p(), p(), I(M), p(), p()], '1 2 3 4 5 6');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 1 2 3');
  assert.deepEqual(result.changed, [3, 4, 5]);
  assert.deepEqual(result.offers, []);
});

test('structureChanged: run stops at a broken old sequence and the block gets an offer', () => {
  const before = lab([I(M), p(), p(), p(), p(), p()], '1 2 3 4 9 10');
  const after = lab([I(M), p(), I(M), p(), p(), p()], '1 2 3 4 9 10');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 1 2 9 10');
  assert.deepEqual(result.changed, [2, 3]);
  assert.deepEqual(offerShape(result.offers), [{ first: 2, pages: [4, 5] }]);
});

test('structureChanged: supplement inserted continues the parent after it', () => {
  const before = lab([I(M), p(), p(), p(), p(), p(), p()], '1 2 3 4 5 6 7');
  const after = lab([I(M), p(), p(), p(), C('NewspaperSupplement'), p('', 2), p()], '1 2 3 4 5 6 7');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 4 i ii 5');
  assert.deepEqual(result.changed, [4, 5, 6]); // derived
});

test('structureChanged: supplement extended, the page leaves the issue and the issue continues after it', () => {
  const before = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p(), p()], '1 2 3 i ii 4 5');
  const after = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p('', 2), p()], '1 2 3 i ii 4 5');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 i ii iii 4');
  assert.deepEqual(result.changed, [5, 6]); // derived
});

test('structureChanged: supplement split, the second part restarts', () => {
  const before = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p('', 2), p('', 2), p()], '1 2 3 i ii iii iv 4');
  const after = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), C('NewspaperSupplement'), p('', 2), p()], '1 2 3 i ii iii iv 4');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 i ii i ii 4');
  assert.deepEqual(result.changed, [5, 6]); // derived
});

test('structureChanged: supplement removed, its pages rejoin the issue', () => {
  const before = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p(), p()], '1 2 3 i ii 4 5');
  const after = lab([I(M), p(), p(), p(), p(), p(), p()], '1 2 3 i ii 4 5');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 4 5 6 7');
  assert.deepEqual(result.changed, [3, 4, 5, 6]); // derived
});

test('structureChanged: type change with the same rule changes nothing', () => {
  const before = lab([I(M), p(), p()], '1 2 3');
  const after = lab([I('EveningIssue'), p(), p()], '1 2 3');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3');
  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.offers, []); // derived
});

test('structureChanged: type change with a different rule follows the new rule', () => {
  const before = lab([I(M), p(), p()], '1 2 3');
  const after = lab([I('ExtraEdition'), p(), p()], '1 2 3');
  const result = structureChanged(before, after, settings(EXTRA_RULES));
  assert.equal(labels(result.pages), '[1] [2] [3]');
  assert.deepEqual(result.offers, []);
});

test('structureChanged: untyped blocks keep their labels', () => {
  const before = lab([I(null), p(), p()], '5 6 7');
  const after = lab([I(null), I(null), p()], '5 6 7');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '5 6 7');
  assert.deepEqual(result.changed, []); // derived
  assert.deepEqual(result.offers, []); // derived
});

test('structureChanged: pages without block get the rule for pages without block', () => {
  const before = lab([I(M), p(), I(M), p(), I(M), p()], '1 2 4 5 1 2');
  const after = lab([I(M), p(), loose(), loose(), I(M), p()], '1 2 4 5 1 2');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 – – 1 2');
  assert.deepEqual(result.offers, []); // derived
});

test('structureChanged: automatic off changes nothing', () => {
  const before = lab([I(M), p(), p(), p(), p(), p()], '1 2 3 4 9 10');
  const after = lab([I(M), p(), I(M), p(), p(), p()], '1 2 3 4 9 10');
  const result = structureChanged(before, after, settings(DEFAULT_RULES, { automatic: false }));
  assert.equal(labels(result.pages), '1 2 3 4 9 10');
  assert.deepEqual(result.pages, after);
  assert.deepEqual(result.changed, []);
  assert.deepEqual(result.offers, []);
});

test('structureChanged: bulk, remove all blocks paginates everything as pages without block', () => {
  const before = lab([I(M), p(), I(M), p(), I(M), p()], '1 2 1 2 1 2');
  const after = lab([loose(), loose(), loose(), loose(), loose(), loose()], '1 2 1 2 1 2');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '– – – – – –');
});

test('structureChanged: bulk, a type pattern counts as one type change per block', () => {
  const before = lab([I(M), p(), I(M), p()], '1 2 1 2');
  const after = lab([I('ExtraEdition'), p(), I('ExtraEdition'), p()], '1 2 1 2');
  const result = structureChanged(before, after, settings(EXTRA_RULES));
  assert.equal(labels(result.pages), '[1] [2] [1] [2]');
});

test('structureChanged: offers exclude pages without label', () => {
  const before = lab([I(M), p(), p(), p()], '1 2 · 9');
  const after = lab([I(M), I(M), p(), p()], '1 2 · 9');
  const result = structureChanged(before, after, settings());
  assert.equal(result.offers.length, 1);
  assert.ok(!result.offers[0].pages.includes(2));
  assert.deepEqual(result.offers[0].pages, [3]); // derived
});

test('structureChanged handles degenerate volumes', () => {
  const single = structureChanged(lab([I(M)], '1'), lab([loose()], '1'), settings());
  assert.equal(labels(single.pages), '–');

  const lastBlock = structureChanged(lab([loose(), loose(), loose()], '– – –'), lab([loose(), loose(), I(M)], '– – –'), settings());
  assert.equal(labels(lastBlock.pages), '– – 1');

  const onePage = structureChanged(lab([I(M), p()], '1 2'), lab([I(M), I(M)], '1 2'), settings());
  assert.equal(labels(onePage.pages), '1 1');

  const looseStart = structureChanged(lab([loose(), loose(), I(M), p()], '– – 1 2'), lab([loose(), I(M), I(M), p()], '– – 1 2'), settings());
  assert.equal(labels(looseStart.pages), '– 1 1 2');
});

// Extra tests for spec behaviour not covered by the brief; every expected value is derived from the spec.

test('structureChanged: a type change makes no offer for the block before', () => {
  const before = lab([I(M), p(), I(M), p(), p()], '1 5 1 2 3');
  const after = lab([I(M), p(), I('ExtraEdition'), p(), p()], '1 5 1 2 3');
  const result = structureChanged(before, after, settings(EXTRA_RULES));
  assert.equal(labels(result.pages), '1 5 [1] [2] [3]');
  assert.deepEqual(result.offers, []);
});

test('structureChanged: a new block offers the block before when its own numbering differs from the rules', () => {
  const before = lab([I(M), p(), p(), p()], '1 2 7 8');
  const after = lab([I(M), p(), p(), I(M)], '1 2 7 8');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 7 1');
  assert.deepEqual(offerShape(result.offers), [{ first: 0, pages: [2] }]);
});

test('blockOffer lists the labelled pages the rules would change', () => {
  assert.deepEqual(blockOffer(lab([I(M), p(), p()], '1 5 6'), settings(), 0), [1, 2]);
  assert.deepEqual(blockOffer(lab([I(M), p(), p()], '1 5 ·'), settings(), 0), [1]);
  assert.deepEqual(blockOffer(lab([I(M), p(), p()], '1 2 3'), settings(), 0), []);
  assert.deepEqual(blockOffer(lab([I(null), p()], '5 7'), settings(), 0), []);
});
