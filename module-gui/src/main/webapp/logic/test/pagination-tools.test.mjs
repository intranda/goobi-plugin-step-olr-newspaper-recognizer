import { test } from 'node:test';
import assert from 'node:assert/strict';
import { missingRuns, fillMissing, changedSinceOpening, restoreFromMets, simulateRules, sameSettings } from '../pagination-tools.mjs';
import { pages, start, settings, labels } from './fixtures.mjs';

const I = (type, label = '') => ({ label, depth: 1, starts: [start(type)] });
const p = (label = '', depth = 1) => ({ label, depth });

test('missingRuns lists the runs of pages without label', () => {
  const list = pages(...['1', '', '', '4', ''].map(label => ({ label })));
  assert.deepEqual(missingRuns(list), [[1, 2], [4, 4]]);
});

test('missingRuns is empty when every page has a label', () => { // derived
  assert.deepEqual(missingRuns(pages({ label: '1' }, { label: '2' })), []);
});

test('fillMissing gives missing pages their rule value', () => {
  const list = pages(I('MorningIssue', '1'), p(), p(), p('4'), I(null, '5'), p(), p(), { label: '', depth: 0 });
  const out = fillMissing(list, settings());
  assert.equal(labels(out), '1 2 3 4 5 6 7 –');
  assert.equal(labels(list), '1 · · 4 5 · · ·', 'input unchanged'); // derived
});

test('fillMissing leaves labelled pages untouched', () => {
  const list = pages(I('MorningIssue', '9'), p(''), p('3'));
  assert.equal(labels(fillMissing(list, settings())), '9 10 3'); // derived
});

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
  const run = scope => labels(simulateRules(list, settings(), scope));
  assert.equal(run({ kind: 'block', first: 0 }), '1 2 5 6 x 9 9');
  assert.equal(run({ kind: 'fromBlock', first: 0 }), '1 2 5 6 x 1 2');
  assert.equal(run({ kind: 'volume' }), '1 2 5 6 – 1 2');
  assert.equal(run({ kind: 'none' }), '9 9 5 6 x 9 9');
  assert.equal(labels(list), '9 9 5 6 x 9 9', 'input unchanged'); // derived
});

test('simulateRules block scope only paginates the block at first', () => { // derived
  const list = pages(I('MorningIssue', '9'), p('9'), I('MorningIssue', '9'), p('9'));
  assert.equal(labels(simulateRules(list, settings(), { kind: 'block', first: 2 })), '9 9 1 2');
  assert.equal(labels(simulateRules(list, settings(), { kind: 'fromBlock', first: 2 })), '9 9 1 2');
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
