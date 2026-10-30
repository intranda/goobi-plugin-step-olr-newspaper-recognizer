import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streams, ruleValue, paginateBlock, paginateParts, initLabels, structureChanged, blockOffer, volumeOffers, applyOffers } from './pagination.mjs';
import { defaultResolver } from './strategies.mjs';
import { buildTree } from './blocks.mjs';
import { simulateRules } from './pagination-tools.mjs';
import { pages, settings, labels, DEFAULT_RULES, insertPage, I, p, C } from './fixtures.mjs';

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
  assert.deepEqual(list.map(page => [page.label, page.metsLabel]), [['5', '5'], ['–', '–']]);
});

test('initLabels: empty and dash spellings become –', () => {
  const list = pages({ label: '' }, { label: '-' }, { label: 'uncounted' }, { label: '–' }, { label: '3' });
  initLabels(list);
  assert.equal(labels(list), '– – – – 3');
  assert.ok(list.every(page => page.metsLabel === page.label));
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

// Streams follow a strategy per node.

/** Strategy resolver of the page list: the given strategies by node key, else the defaults. */
const resolver = (list, s, picked) => {
  const fallback = defaultResolver(buildTree(list), s);
  return key => picked[key] ?? fallback(key);
};
const all = () => true;

test('continue:previous keeps the leading uncounted value of the type rule', () => {
  const s = settings({ MorningIssue: { beginsWith: ['–', '1'] } });
  const list = pages(I('MorningIssue'), p(), p(), I('MorningIssue'), p(), p());
  const strategyOf = resolver(list, s, { '3:0': 'continue:previous' });
  assert.equal(labels(paginateParts(list, s, all, strategyOf)), '– 1 2 – 3 4');
});

test('continue:previous continues after a hand block with counting labels', () => {
  const list = pages(I('MorningIssue'), p(), I('MorningIssue', '37'), p('38'), I('MorningIssue'), p());
  const strategyOf = resolver(list, settings(), { '2:0': 'hand', '4:0': 'continue:previous' });
  assert.equal(labels(paginateParts(list, settings(), all, strategyOf)), '1 2 37 38 39 40');
});

test('continue:previous skips blocks without counting value and loose pages', () => {
  const list = pages(I('MorningIssue'), p(), p('', 0), I('MorningIssue', 'Titel'), I('MorningIssue'), I('MorningIssue'), p());
  const strategyOf = resolver(list, settings(), { '3:0': 'hand', '4:0': 'rule:–', '5:0': 'continue:previous' });
  assert.equal(labels(paginateParts(list, settings(), all, strategyOf)), '1 2 – Titel – 3 4');
});

test('continue:previous without a block before starts with its rule, without type rule at 1', () => {
  const list = pages(I('MorningIssue'), p(), I('TableOfContents'), p());
  const strategyOf = resolver(list, settings(), { '0:0': 'continue:previous', '2:0': 'continue:previous' });
  assert.equal(labels(paginateParts(list, settings(), all, strategyOf)), '1 2 3 4');
  assert.equal(labels(paginateParts(pages(I('TableOfContents'), p()), settings(), all, () => 'continue:previous')), '1 2');
});

test('rule:– on a nested block makes its pages uncounted whatever the parent does', () => {
  const list = pages(I('MorningIssue'), p(), C('NewspaperSupplement'), p('', 2), p());
  const strategyOf = resolver(list, settings(), { '2:1': 'rule:–' });
  assert.equal(labels(paginateBlock(list, settings(), 0, strategyOf)), '1 2 – – 3');
});

test('a hand node keeps its labels', () => {
  const list = pages(I('MorningIssue'), p(), C('NewspaperSupplement', 'Titel'), p('x', 2), p());
  const strategyOf = resolver(list, settings(), { '2:1': 'hand' });
  assert.equal(labels(paginateBlock(list, settings(), 0, strategyOf)), '1 2 Titel x 3');
  const hand = pages(I('MorningIssue', 'a'), p('7'), C('TableOfContents', 'b'), p('', 2));
  assert.equal(labels(paginateBlock(hand, settings(), 0, () => 'hand')), 'a 7 b ·');
});

test('continue:parent without type rule counts on from the parent', () => {
  const list = pages(I('MorningIssue'), p(), C('TableOfContents'), p('', 2), p());
  assert.equal(labels(paginateBlock(list, settings(), 0)), '1 2 3 4 5');
});

test('continue:parent: the parent keeps counting across the child, the child keeps its leading uncounted value', () => {
  const s = settings({ MorningIssue: { beginsWith: ['–', '1'] }, TableOfContents: { beginsWith: ['–', '1'] } });
  const list = pages(I('MorningIssue'), C('TableOfContents'), p('', 2), p('', 2), p());
  const strategyOf = resolver(list, s, { '1:1': 'continue:parent' });
  assert.equal(labels(paginateBlock(list, s, 0, strategyOf)), '– – 1 2 3');
});

test('continue:sibling without an earlier sibling of the type opens its own stream', () => {
  const list = pages(I('MorningIssue'), p(), C('NewspaperSupplement'), p('', 2), C('TableOfContents'), p('', 2));
  const strategyOf = resolver(list, settings(), { '2:1': 'continue:sibling', '4:1': 'continue:sibling' });
  assert.equal(labels(paginateBlock(list, settings(), 0, strategyOf)), '1 2 i ii 1 2');
});

test('parts carry their node', () => {
  const list = pages(I('MorningIssue'), p(), p(), C('NewspaperSupplement'), p('', 2), p(), C('TableOfContents'), p('', 2));
  const result = streams(list, settings());
  const parts = result.list.flatMap(stream => stream.parts);
  const supplement = parts.find(part => part.pages.includes(3));
  assert.equal(supplement.node, '3:1');
  assert.equal(supplement.block, 0);
  assert.deepEqual(supplement.pages, [3, 4]);
  const issue = result.list.find(stream => stream.pages.includes(0));
  assert.deepEqual(issue.parts.map(part => [part.node, part.pages]), [['0:0', [0, 1, 2, 5]], ['6:1', [6, 7]]]);
  const loose = streams(pages(p('', 0), I('MorningIssue')), settings()).list[0].parts[0];
  assert.deepEqual([loose.node, loose.block], [null, -1]);
});

test('streams: counting through the volume comes from the strategies, not from the settings', () => {
  const list = pages(I('MorningIssue'), p(), I('MorningIssue'), p());
  const s = { ...settings(), countThroughVolume: true };
  assert.equal(streams(list, s, () => 'rule:1').list.length, 2);
  assert.equal(streams(list, settings(), resolver(list, s, { '2:0': 'continue:previous' })).list.length, 1);
  assert.ok(streams(list, s).list.every(stream => stream.key !== 'volume'));
});

test('ruleValue follows the given strategies', () => {
  const list = pages(I('MorningIssue', '1'), p('2'), I('MorningIssue'), p());
  assert.equal(ruleValue(list, settings(), 2), '1');
  assert.equal(ruleValue(list, settings(), 2, resolver(list, settings(), { '2:0': 'continue:previous' })), '3');
  assert.equal(ruleValue(list, settings(), 2, resolver(list, settings(), { '2:0': 'hand' })), null);
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

test('structureChanged: a page inserted before a child that continues its parent counts on through the child', () => {
  const before = lab([I(M), p(), C('TableOfContents'), p('', 2), p(), p()], '1 2 3 4 5 6');
  const result = structureChanged(before, insertPage(before, 2), settings());
  assert.equal(labels(result.pages), '1 2 3 4 5 6 7');
  assert.deepEqual(result.offers, []);
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

test('structureChanged: uncounted pages are offered', () => {
  const before = lab([I(M), p(), p(), p()], '1 2 · 9');
  const after = lab([I(M), I(M), p(), p()], '1 2 · 9');
  const result = structureChanged(before, after, settings());
  assert.equal(result.offers.length, 1);
  assert.deepEqual(result.offers[0].pages, [2, 3]); // derived: page 2 is uncounted, rule gives it 2, page 3 has 9 instead of 3
  const initialised = structureChanged(lab([I(M), p(), p(), p()], '1 2 – 9'), lab([I(M), I(M), p(), p()], '1 2 – 9'), settings());
  assert.deepEqual(initialised.offers[0].pages, [2, 3]); // state after initLabels
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

test('blockOffer: an uncounted page is offered like any other', () => {
  assert.deepEqual(blockOffer(pages(I('MorningIssue', '–'), p('–'), p('7')), settings(), 0), [0, 1, 2]);
  assert.deepEqual(blockOffer(pages(I('MorningIssue', ''), p(''), p('7')), settings(), 0), [0, 1, 2]); // the filter on '' is gone too
});

test('blockOffer lists the pages the rules would change', () => {
  assert.deepEqual(blockOffer(lab([I(M), p(), p()], '1 5 6'), settings(), 0), [1, 2]);
  assert.deepEqual(blockOffer(lab([I(M), p(), p()], '1 5 ·'), settings(), 0), [1, 2]);
  assert.deepEqual(blockOffer(lab([I(M), p(), p()], '1 2 3'), settings(), 0), []);
  assert.deepEqual(blockOffer(lab([I(null), p()], '5 7'), settings(), 0), []);
});

// Fix round 1: after the continuation the old sequence rule still applies.

test('structureChanged: supplement inserted keeps own numbering after the continuation', () => {
  const before = lab([I(M), p(), p(), p(), p(), p(), p()], '1 2 3 4 5 6 9');
  const after = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p(), p()], '1 2 3 4 5 6 9');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 i ii 4 9');
  assert.deepEqual(offerShape(result.offers), [{ first: 0, pages: [6] }]); // derived
});

test('structureChanged: supplement extended keeps own numbering after the continuation', () => {
  const before = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p(), p(), p()], '1 2 3 i ii 4 5 9');
  const after = lab([I(M), p(), p(), C('NewspaperSupplement'), p('', 2), p('', 2), p(), p()], '1 2 3 i ii 4 5 9');
  const result = structureChanged(before, after, settings());
  assert.equal(labels(result.pages), '1 2 3 i ii iii 4 9');
  assert.deepEqual(offerShape(result.offers), [{ first: 0, pages: [7] }]); // derived
});

// Counting through the whole volume.

const paginateAll = (list, s) => simulateRules(list, s, { kind: 'volume' });
const each = list => labels(list).split(' ');

test('volume mode: title pages keep – per block, the count carries on', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['–', '1'] } }), countThroughVolume: true };
  const list = pages(I('MorningIssue'), p(), p(), I('MorningIssue'), p(), p());
  assert.deepEqual(each(paginateAll(list, s)), ['–', '1', '2', '–', '3', '4']);
});

test('volume mode: a counting start value applies only in the first block', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  assert.deepEqual(each(paginateAll(pages(I('MorningIssue'), p(), I('MorningIssue'), p()), s)), ['1', '2', '3', '4']);
});

test('volume mode: pages without block and rule-less blocks without counting labels are skipped, the count continues after them', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true, withoutBlock: ['–'] };
  const list = pages(I('MorningIssue'), p(), { label: 'x', depth: 0 }, I(null, 'Titel'), p('Karte'), I('MorningIssue'), p());
  assert.deepEqual(each(paginateAll(list, s)), ['1', '2', '–', 'Titel', 'Karte', '3', '4']);
  // a rule-less block with a counting label (u2) counts, the next block continues after it
  const counting = pages(I('MorningIssue'), p(), { label: 'x', depth: 0 }, I(null, 'u'), p('u2'), I('MorningIssue'), p());
  assert.deepEqual(each(paginateAll(counting, s)), ['1', '2', '–', 'u', 'u2', 'u3', 'u4']);
});

test('block mode is unchanged: every block starts again', () => {
  const s = settings({ MorningIssue: { beginsWith: ['1'] } });
  assert.deepEqual(each(paginateAll(pages(I('MorningIssue'), p(), I('MorningIssue'), p()), s)), ['1', '2', '1', '2']);
});

test('volume mode: paginateBlock of a later block continues from the block before', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const list = pages(I('MorningIssue', '1'), p('2'), I('MorningIssue', '9'), p('9'));
  assert.deepEqual(each(paginateBlock(list, s, 2)), ['1', '2', '3', '4']);
});

// Automatic pagination and offers in volume mode.

const setup = () => {
  // blocks of 2 pages labelled 1 2 | 3 4 | 5 6 | 7 8; a page inserted into block 2
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const before = pages(I('MorningIssue', '1'), p('2'), I('MorningIssue', '3'), p('4'), I('MorningIssue', '5'), p('6'), I('MorningIssue', '7'), p('8'));
  const after = insertPage(before, 3);
  const r = structureChanged(before, after, s);
  return { s, before, after, r };
};

test('volume mode: a new page in block 2 paginates block 2 only, later blocks get cumulative offers', () => {
  const { r } = setup();
  assert.deepEqual(labels(r.pages).split(' ').slice(0, 5), ['1', '2', '3', '4', '5']);
  assert.deepEqual(labels(r.pages).split(' ').slice(5), ['5', '6', '7', '8']); // untouched
  assert.deepEqual(r.offers.map(o => o.first), [5, 7]);
  assert.equal(r.offerFrom, 5);
});

test('applyOffers: accepting the later offer first gives its cumulative labels', () => {
  const { s, r } = setup();
  const later = applyOffers(r.pages, s, [r.offers[1]], r.offerFrom);
  assert.deepEqual(labels(later).split(' ').slice(7), ['8', '9']);
  assert.deepEqual(labels(later).split(' ').slice(5, 7), ['5', '6']);
});

test('applyOffers: all at once equals one by one in page order', () => {
  const { s, r } = setup();
  const all = applyOffers(r.pages, s, r.offers, r.offerFrom);
  const oneByOne = r.offers.reduce((list, o) => applyOffers(list, s, [o], r.offerFrom), r.pages);
  assert.deepEqual(labels(all), labels(oneByOne));
  assert.deepEqual(labels(all).split(' '), ['1', '2', '3', '4', '5', '6', '7', '8', '9']);
});

test('applyOffers in block mode equals accepting each offer with paginateBlock', () => {
  const list = lab([I(M), p(), p(), I(M), p(), p()], '1 5 6 1 7 8');
  const offers = [{ first: 0, pages: [1, 2] }, { first: 3, pages: [4, 5] }];
  const accept = (pagesNow, offer) => {
    const fresh = paginateBlock(pagesNow, settings(), offer.first);
    return pagesNow.map((page, i) => (offer.pages.includes(i) ? { ...page, label: fresh[i].label } : page));
  };
  const expected = offers.reduce(accept, list);
  assert.equal(labels(applyOffers(list, settings(), offers, null)), labels(expected));
  assert.equal(labels(expected), '1 2 3 1 2 3'); // derived
  assert.equal(labels(list), '1 5 6 1 7 8', 'input unchanged'); // derived
});

test('volumeOffers: a block that already fits gets no offer', () => {
  const { s, r } = setup();
  const list = applyOffers(r.pages, s, [r.offers[0]], r.offerFrom);
  assert.deepEqual(volumeOffers(list, s, r.offerFrom).map(o => o.first), [7]);
});

test('switching to volume mode with scope none changes no label', () => {
  const list = pages(I('MorningIssue', '1'), p('2'), I('MorningIssue', '1'), p('2'));
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  assert.equal(labels(simulateRules(list, s, { kind: 'none' })), labels(list));
});

// extras (not in the brief)

test('extra: volume mode, a new block detects its pages as moved although the stream stays the same', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['–', '1'] } }), countThroughVolume: true };
  const before = lab([I(M), p(), I(M), p(), p()], '– 1 – 2 3');
  const after = lab([I(M), p(), I(M), p(), I(M)], '– 1 – 2 3');
  assert.deepEqual(each(structureChanged(before, after, s).pages), ['–', '1', '–', '2', '–']); // derived
});

test('extra: volume mode, the beginsWith values of a new block are counted within that block', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['–', '1'] } }), countThroughVolume: true };
  const before = lab([I(M), p(), p(), p(), p()], '– 1 2 3 4');
  const after = lab([I(M), p(), p(), I(M), p()], '– 1 2 3 4');
  assert.deepEqual(each(structureChanged(before, after, s).pages), ['–', '1', '2', '–', '3']); // derived
});

test('extra: block mode structureChanged has offerFrom null', () => {
  const before = lab([I(M), p(), p(), p(), p(), p()], '1 2 3 4 9 10');
  const after = lab([I(M), p(), I(M), p(), p(), p()], '1 2 3 4 9 10');
  assert.equal(structureChanged(before, after, settings()).offerFrom, null); // derived
});

test('extra: volume mode, a change in the last block leaves offerFrom null and makes no volume offers', () => {
  const { s, before } = setup();
  const after = insertPage(before, 7);
  const r = structureChanged(before, after, s);
  assert.deepEqual(each(r.pages), ['1', '2', '3', '4', '5', '6', '7', '8', '9']); // derived
  assert.equal(r.offerFrom, null); // derived
  assert.deepEqual(r.offers, []); // derived
});

test('extra: volume mode, every later block that would change gets an offer, also behind a block that fits', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const before = pages(I(M, '1'), p('2'), I(M, '3'), p('4'), I(M, '6'), p('7'), I(M, '7'), p('8'));
  const r = structureChanged(before, insertPage(before, 1), s);
  assert.deepEqual(each(r.pages).slice(0, 3), ['1', '2', '3']); // derived
  assert.deepEqual(offerShape(r.offers), [{ first: 3, pages: [3, 4] }, { first: 7, pages: [7, 8] }]); // derived
});

test('extra: simulateRules scope offers equals applyOffers', () => {
  const { s, r } = setup();
  const scope = { kind: 'offers', first: null, offers: r.offers, from: r.offerFrom };
  assert.equal(labels(simulateRules(r.pages, s, scope)), labels(applyOffers(r.pages, s, r.offers, r.offerFrom)));
});

// Ruling option 2: in volume mode the changed blocks keep today's offers, the volume offers follow.

test('volume mode: a changed block with a broken old sequence is offered against the volume count, a later block that fits is not', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const before = lab([I(M), p(), p(), p(), p(), p(), I(M), p()], '1 2 3 4 9 10 7 8');
  const after = lab([I(M), p(), I(M), p(), p(), p(), I(M), p()], '1 2 3 4 9 10 7 8');
  const r = structureChanged(before, after, s);
  assert.deepEqual(each(r.pages), ['1', '2', '3', '4', '9', '10', '7', '8']); // derived
  assert.equal(r.offerFrom, 2); // derived
  assert.deepEqual(offerShape(r.offers), [{ first: 2, pages: [4, 5] }]); // derived
  const all = applyOffers(r.pages, s, r.offers, r.offerFrom);
  const oneByOne = r.offers.reduce((list, o) => applyOffers(list, s, [o], r.offerFrom), r.pages);
  assert.deepEqual(each(all), ['1', '2', '3', '4', '5', '6', '7', '8']); // derived
  assert.deepEqual(each(oneByOne), each(all));
});

test('block mode: a page inserted into a block paginates that block only', () => {
  const before = lab([I(M), p(), p(), I(M), p()], '1 2 3 1 2');
  const r = structureChanged(before, insertPage(before, 2), settings());
  assert.deepEqual(each(r.pages), ['1', '2', '3', '4', '1', '2']); // derived
  assert.deepEqual(r.offers, []); // derived
});

// Fix round 1: a later offer takes its pages from the volume count after the earlier offers.

test('volume mode: accepting all offers equals accepting one by one with the offers recomputed in between', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const before = lab([I(M), p(), p(), p(), p(), p(), I(M), p()], '1 2 3 4 9 10 11 8');
  const after = lab([I(M), p(), I(M), p(), p(), p(), I(M), p()], '1 2 3 4 9 10 11 8');
  const r = structureChanged(before, after, s);
  assert.deepEqual(offerShape(r.offers), [{ first: 2, pages: [4, 5] }, { first: 6, pages: [6] }]);
  assert.equal(r.offerFrom, 2);
  const all = applyOffers(r.pages, s, r.offers, r.offerFrom);
  const first = applyOffers(r.pages, s, [r.offers[0]], r.offerFrom);
  const recomputed = applyOffers(first, s, volumeOffers(first, s, r.offerFrom), r.offerFrom);
  assert.deepEqual(each(recomputed), ['1', '2', '3', '4', '5', '6', '7', '8']);
  assert.deepEqual(each(all), each(recomputed));
});

// Follow-up R10: when counting through the volume the offers start at the first block that no longer fits.

test('volume mode: splitting a block of a per-block volume offers every block from the first that no longer fits', () => {
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  const block = () => [I(M), p(), p(), p()];
  const before = lab([...block(), ...block(), ...block()], '1 2 3 4 1 2 3 4 1 2 3 4');
  const after = lab([...block(), I(M), p(), I(M), p(), ...block()], '1 2 3 4 1 2 3 4 1 2 3 4');
  const r = structureChanged(before, after, s);
  assert.deepEqual(each(r.pages), ['1', '2', '3', '4', '1', '2', '3', '4', '1', '2', '3', '4']); // derived
  assert.equal(r.offerFrom, 4); // derived
  assert.deepEqual(offerShape(r.offers), [{ first: 4, pages: [4, 5] }, { first: 6, pages: [6, 7] }, { first: 8, pages: [8, 9, 10, 11] }]); // derived
  const all = applyOffers(r.pages, s, r.offers, r.offerFrom);
  assert.deepEqual(each(all), ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12']);
  const oneByOne = r.offers.reduce(list => {
    const open = volumeOffers(list, s, r.offerFrom);
    return open.length ? applyOffers(list, s, [open[0]], r.offerFrom) : list;
  }, r.pages);
  assert.deepEqual(each(oneByOne), each(all));
});

// Final review: in volume mode applyOffers counts once; accepting a subset of the offers at once must equal accepting them one by one.

test('volume mode: accepting some offers at once equals one by one in page order on varied volumes', () => {
  let seed = 7;
  const rnd = n => { seed = (seed * 48271) % 2147483647; return seed % n; };
  const types = [M, 'EveningIssue', null, 'TableOfContents'];
  for (let t = 0; t < 400; t++) {
    const specs = [];
    const blocks = 2 + rnd(6);
    for (let b = 0; b < blocks; b++) {
      const length = 1 + rnd(4);
      const type = types[rnd(4)];
      const loose = rnd(8) === 0;
      for (let k = 0; k < length; k++) {
        const label = rnd(5) === 0 ? '' : rnd(6) === 0 ? '–' : String(1 + rnd(20));
        if (loose) {
          specs.push(p(label, 0));
        } else if (k === 0) {
          specs.push(I(type, label));
        } else {
          specs.push(rnd(6) === 0 ? C('NewspaperSupplement', label) : p(label, specs.at(-1).depth === 2 && rnd(2) ? 2 : 1));
        }
      }
    }
    const list = pages(...specs);
    const s = {
      ...settings({ [M]: { beginsWith: rnd(2) ? ['1'] : ['–', '1'] }, EveningIssue: { beginsWith: ['i'] }, NewspaperSupplement: { beginsWith: ['i'] } }),
      countThroughVolume: true,
    };
    const from = rnd(list.length);
    const offers = volumeOffers(list, s, from).filter(() => rnd(3) > 0);
    const oneByOne = offers.reduce((out, offer) => applyOffers(out, s, [offer], from), list);
    assert.equal(labels(applyOffers(list, s, offers, from)), labels(oneByOne), `case ${t}`);
  }
});
