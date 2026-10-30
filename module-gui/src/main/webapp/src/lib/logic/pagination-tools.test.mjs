import { test } from 'node:test';
import assert from 'node:assert/strict';
import { changedSinceOpening, restoreFromMets, simulateRules, sameSettings, labelRange, previewGroups, acceptOffers } from './pagination-tools.mjs';
import { pages, start, settings, labels, DEFAULT_RULES } from './fixtures.mjs';
import { detectStrategies } from './strategies.mjs';

const I = (type, label = '') => ({ label, depth: 1, starts: [start(type)] });
const p = (label = '', depth = 1) => ({ label, depth });

test('changedSinceOpening and restoreFromMets', () => {
  const list = pages(...['1', '2', '3', '4'].map(label => ({ label, metsLabel: label })));
  list[1].label = 'x';
  list[3].label = '';
  assert.deepEqual(changedSinceOpening(list), [1, 3]);
  const restored = restoreFromMets(list);
  assert.ok(restored.every(page => page.label === page.metsLabel));
  assert.deepEqual(changedSinceOpening(restored), []); // derived
  assert.equal(list[1].label, 'x', 'input unchanged'); // derived
});

test('simulateRules scopes', () => {
  const list = pages(I('MorningIssue', '9'), p('9'), I(null, '5'), p('6'), { label: 'x', depth: 0 }, I('MorningIssue', '9'), p('9'));
  const run = scope => labels(simulateRules(list, settings(), scope).pages);
  assert.equal(run({ kind: 'block', first: 0 }), '1 2 5 6 x 9 9');
  assert.equal(run({ kind: 'fromBlock', first: 0 }), '1 2 5 6 x 1 2');
  assert.equal(run({ kind: 'volume' }), '1 2 5 6 – 1 2');
  assert.equal(run({ kind: 'none' }), '9 9 5 6 x 9 9');
  assert.equal(labels(list), '9 9 5 6 x 9 9', 'input unchanged'); // derived
});

test('simulateRules block scope only paginates the block at first', () => { // derived
  const list = pages(I('MorningIssue', '9'), p('9'), I('MorningIssue', '9'), p('9'));
  assert.equal(labels(simulateRules(list, settings(), { kind: 'block', first: 2 }).pages), '9 9 1 2');
  assert.equal(labels(simulateRules(list, settings(), { kind: 'fromBlock', first: 2 }).pages), '9 9 1 2');
});

test('simulateRules: count through the volume in scope fromBlock sets continue:previous after the first block', () => {
  const M = 'MorningIssue';
  const list = pages(I(M, '1'), p('2'), I(M, '1'), p('2'), I(M, '1'), p('2'), I(M, '1'), p('2'));
  const strategies = detectStrategies(list, settings(), new Map());
  const result = simulateRules(list, settings(DEFAULT_RULES, { countThroughVolume: true }), { kind: 'fromBlock', first: 2 }, strategies);
  assert.equal(labels(result.pages), '1 2 1 2 3 4 5 6');
  assert.deepEqual([...result.strategies], [['2:0', 'rule:1'], ['4:0', 'continue:previous'], ['6:0', 'continue:previous']]);
  // the blocks after the scope that continue it follow it
  const through = pages(I(M, '1'), p('2'), I(M, '3'), p('4'), I(M, '5'), p('6'));
  const roman = simulateRules(through, settings({ ...DEFAULT_RULES, [M]: { beginsWith: ['i'] } }), { kind: 'block', first: 0 },
    detectStrategies(through, settings(), new Map()));
  assert.equal(labels(roman.pages), 'i ii iii iv v vi');
  assert.deepEqual([...roman.strategies], [['0:0', 'rule:i']]);
});

test('acceptOffers: the blocks continuing an accepted block follow it', () => {
  const M = 'MorningIssue';
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(I(M, '1'), p('2'), I(M, '9'), p('9'), I(M, '11'), p('12'), I(M, '20'), p('x'));
  const strategies = new Map([['0:0', 'rule:1'], ['2:0', 'hand'], ['4:0', 'continue:previous'], ['6:0', 'hand']]);
  const result = acceptOffers(list, s, [{ first: 2, pages: [2, 3] }], strategies);
  assert.equal(labels(result.pages), '1 2 3 4 5 6 20 x');
  // the hand block the chain stops at would continue it (its default is continue:previous): offered
  assert.deepEqual(result.offers, [{ first: 6, pages: [6, 7] }]);
  assert.equal(labels(list), '1 2 9 9 11 12 20 x', 'input unchanged'); // derived
  // the dialog's scope offers does the same
  assert.equal(labels(simulateRules(list, s, { kind: 'offers', first: null, offers: [{ first: 2, pages: [2, 3] }] }, strategies).pages), labels(result.pages));
});

test('simulateRules: the hand block the chain after the scope stops at is offered', () => {
  const M = 'MorningIssue';
  const list = pages(I(M, '1'), p('2'), I(M, '3'), p('4'), I(M, '20'), p('x'));
  const strategies = new Map([['0:0', 'rule:1'], ['2:0', 'continue:previous'], ['4:0', 'hand']]);
  const roman = settings({ ...DEFAULT_RULES, [M]: { beginsWith: ['i'] } }, { countThroughVolume: true });
  const result = simulateRules(list, roman, { kind: 'block', first: 0 }, strategies);
  assert.equal(labels(result.pages), 'i ii iii iv 20 x');
  assert.deepEqual(result.offers, [{ first: 4, pages: [4, 5] }]);
  // scope offers: the offers of the chains after the offered blocks
  const offered = simulateRules(pages(I(M, '1'), p('2'), I(M, '9'), p('9'), I(M, '11'), p('12'), I(M, '20'), p('x')),
    settings(DEFAULT_RULES, { countThroughVolume: true }), { kind: 'offers', first: null, offers: [{ first: 2, pages: [2, 3] }] },
    new Map([['0:0', 'rule:1'], ['2:0', 'hand'], ['4:0', 'continue:previous'], ['6:0', 'hand']]));
  assert.deepEqual(offered.offers, [{ first: 6, pages: [6, 7] }]);
  assert.deepEqual(simulateRules(list, roman, { kind: 'none', first: null }, strategies).offers, []);
});

test('acceptOffers: a block split off a volume counted through, accepted, the hand block after it fits', () => {
  const M = 'MorningIssue';
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(I(M, '1'), p('2'), I(M, '3'), p('4'), p('9'), p('10'), I(M, '7'), p('8'));
  const strategies = detectStrategies(list, s, new Map());
  assert.deepEqual([...strategies.values()], ['rule:1', 'hand', 'hand']); // derived
  const result = acceptOffers(list, s, [{ first: 2, pages: [4, 5] }], strategies);
  assert.equal(labels(result.pages), '1 2 3 4 5 6 7 8');
  assert.deepEqual(result.offers, []);
});

test('sameSettings compares the rules by meaning, not by the order of their keys', () => {
  const a = settings({ MorningIssue: { beginsWith: ['–', '1'], continueInParent: false }, Supplement: { beginsWith: ['i'], continueInParent: true } });
  const b = { withoutBlock: ['–'], rules: { Supplement: { continueInParent: true, beginsWith: ['i'] }, MorningIssue: { beginsWith: ['–', '1'] } }, automatic: true, enabled: true };
  assert.ok(sameSettings(a, b));
  assert.ok(sameSettings(a, { ...b, countThroughVolume: false }), 'countThroughVolume missing is false');
  assert.ok(sameSettings(a, { ...b, rules: { ...b.rules, EveningIssue: { beginsWith: [] } } }), 'a rule without values is no rule');
  assert.ok(!sameSettings(a, { ...b, rules: { ...b.rules, MorningIssue: { beginsWith: ['1'] } } }), 'beginsWith');
  assert.ok(!sameSettings(a, { ...b, rules: { ...b.rules, Supplement: { beginsWith: ['i'] } } }), 'continueInParent');
  assert.ok(!sameSettings(a, { ...b, rules: { MorningIssue: b.rules.MorningIssue } }), 'a removed rule');
  assert.ok(!sameSettings(a, { ...b, withoutBlock: [] }), 'withoutBlock');
  assert.ok(!sameSettings(a, { ...b, automatic: false }), 'automatic');
  assert.ok(!sameSettings(a, { ...b, countThroughVolume: true }), 'countThroughVolume');
});

test('labelRange: a counting sequence is a range', () => assert.equal(labelRange(['111', '112', '113']), '111–113'));
test('labelRange: a non-sequence is never shown as a range', () => {
  assert.equal(labelRange(['–', '9', '10']), '–, 9, 10');
  assert.equal(labelRange(['1', '2', '5', '6', '7', '9']), '1, 2, …, 9');
});
test('labelRange: none, one, roman and up to four labels', () => { // derived
  assert.equal(labelRange([]), '');
  assert.equal(labelRange(['7']), '7');
  assert.equal(labelRange(['i', 'ii', 'iii', 'iv']), 'i–iv');
  assert.equal(labelRange(['1', '3', '5', '7']), '1, 3, 5, 7');
  assert.equal(labelRange(['1', '1']), '1, 1');
});

test('previewGroups: one group per block with before/after and changed count', () => {
  const child = (label, starts = []) => ({ label, depth: 2, starts });
  const loose = label => ({ label, depth: 0 });
  // the supplement lies in the middle of the morning issue: the issue is one group over its own pages, the supplement follows it
  const list = pages(I('MorningIssue', '9'), p('10'), child('i', [start('NewspaperSupplement')]), child('ii'), p('11'),
    I('EveningIssue', '1'), p('2'), loose('x'), loose('y'));
  const simulated = ['1', '2', 'i', 'ii', '3', '1', '2', '–', '–'].map(label => ({ label }));
  const groups = previewGroups(list, simulated, [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  assert.deepEqual(groups, [
    { first: 0, level: 0, child: 0, type: 'MorningIssue', root: 0, pages: [0, 1, 4], before: ['9', '10', '11'], after: ['1', '2', '3'], changed: 3 },
    { first: 2, level: 1, child: 1, type: 'NewspaperSupplement', root: 0, pages: [2, 3], before: ['i', 'ii'], after: ['i', 'ii'], changed: 0 },
    { first: 5, level: 0, child: 0, type: 'EveningIssue', root: 5, pages: [5, 6], before: ['1', '2'], after: ['1', '2'], changed: 0 },
    { first: 7, level: -1, child: 0, type: null, root: 7, pages: [7, 8], before: ['x', 'y'], after: ['–', '–'], changed: 2 },
  ]);
});

test('previewGroups: a child block starting on the first page of its parent still follows it', () => { // derived
  const list = pages({ label: '1', depth: 2, starts: [start('MorningIssue'), start('NewspaperSupplement')] }, p('2'));
  const groups = previewGroups(list, list, [0, 1]);
  assert.deepEqual(groups.map(group => [group.type, group.pages.join()]), [['MorningIssue', '1'], ['NewspaperSupplement', '0']]);
});

test('previewGroups: only the pages in indexes; a gap splits a loose run', () => { // derived
  const list = pages(I('MorningIssue', '1'), p('2'), p('3'), { label: 'x', depth: 0 }, { label: 'y', depth: 0 }, { label: 'z', depth: 0 });
  const groups = previewGroups(list, list, [1, 2, 3, 5]);
  assert.deepEqual(groups.map(group => [group.first, group.level, group.pages.join()]), [[1, 0, '1,2'], [3, -1, '3'], [5, -1, '5']]);
});
