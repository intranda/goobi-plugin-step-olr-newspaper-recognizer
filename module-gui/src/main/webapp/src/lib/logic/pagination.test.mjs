import { test } from 'node:test';
import assert from 'node:assert/strict';
import { streams, ruleValue, paginateBlock, paginateParts, initLabels, blockOffer, applyOffers } from './pagination.mjs';
import { defaultResolver } from './strategies.mjs';
import { buildTree } from './blocks.mjs';
import { simulateRules } from './pagination-tools.mjs';
import { pages, settings, labels, DEFAULT_RULES, I, p, C } from './fixtures.mjs';

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

/** Page list from page specs without labels and a label line ('·' = empty). */
const lab = (specs, text) => {
  const words = text.split(' ');
  return pages(...specs.map((spec, i) => ({ ...spec, label: words[i] === '·' ? '' : words[i] })));
};
const M = 'MorningIssue';

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

// Counting through the whole volume.

const paginateAll = (list, s) => simulateRules(list, s, { kind: 'volume' }).pages;
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

// Offers.

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

test('switching to volume mode with scope none changes no label', () => {
  const list = pages(I('MorningIssue', '1'), p('2'), I('MorningIssue', '1'), p('2'));
  const s = { ...settings({ MorningIssue: { beginsWith: ['1'] } }), countThroughVolume: true };
  assert.equal(labels(simulateRules(list, s, { kind: 'none' }).pages), labels(list));
});
