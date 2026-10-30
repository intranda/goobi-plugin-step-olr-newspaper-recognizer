import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, flatten } from './blocks.mjs';
import { ruleOf, ruleId, nodeKey, defaultStrategy, defaultResolver } from './strategies.mjs';
import { pages, settings, DEFAULT_RULES, I, p, C } from './fixtures.mjs';

const M = 'MorningIssue';
const S = 'NewspaperSupplement';

/** The default strategy of every node of the page list, in page order. */
const defaults = (list, s) => {
  const tree = buildTree(list);
  return flatten(tree.roots).map(node => defaultStrategy(tree, node, s));
};

test('defaultStrategy: a top-level block takes the rule of its type, rule:– without one, hand without type', () => {
  const list = pages(I(M), p(), I('TableOfContents'), I(null), p());
  assert.deepEqual(defaults(list, settings()), ['rule:1', 'rule:–', 'hand']);
});

test('defaultStrategy: a nested block with a rule takes it, without one it continues its parent', () => {
  const list = pages(I(M), C(S), p('', 2), C('TableOfContents'), p('', 2), C(null));
  assert.deepEqual(defaults(list, settings()), ['rule:1', 'rule:i', 'continue:parent', 'hand']);
});

test('defaultStrategy: with continueInParent the second sibling of a type continues the first', () => {
  const list = pages(I(M), C(S), p('', 2), C('TableOfContents'), C(S), p('', 2), I(M), C(S));
  const joined = settings({ ...DEFAULT_RULES, [S]: { beginsWith: ['i'], continueInParent: true } });
  assert.deepEqual(defaults(list, joined), ['rule:1', 'rule:i', 'continue:parent', 'continue:sibling', 'rule:1', 'rule:i']);
  assert.deepEqual(defaults(list, settings()), ['rule:1', 'rule:i', 'continue:parent', 'rule:i', 'rule:1', 'rule:i']);
});

test('defaultStrategy: counting through the volume continues every later top-level block with a counting rule', () => {
  const s = { ...settings({ [M]: { beginsWith: ['1'] }, EveningIssue: { beginsWith: ['–', '1'] }, ExtraEdition: { beginsWith: ['–'] } }), countThroughVolume: true };
  const list = pages(I(M), p(), I(M), I('EveningIssue'), I('ExtraEdition'), I('TableOfContents'), I(null));
  assert.deepEqual(defaults(list, s), ['rule:1', 'continue:previous', 'continue:previous', 'rule:–', 'rule:–', 'hand']);
  assert.deepEqual(defaults(list, { ...s, countThroughVolume: false }), ['rule:1', 'rule:1', 'rule:– 1', 'rule:–', 'rule:–', 'hand']);
});

test('defaultStrategy: counting through the volume, the first top-level block starts with its rule', () => {
  const s = { ...settings(), countThroughVolume: true };
  assert.deepEqual(defaults(pages(p('', 0), I(M), p()), s), ['rule:1']);
});

test('nodeKey is first page and level', () => {
  const tree = buildTree(pages(I(M), p(), p(), C(S), p('', 2)));
  assert.deepEqual(flatten(tree.roots).map(nodeKey), ['0:0', '3:1']);
});

test('defaultResolver answers the default strategy by node key', () => {
  const list = pages(I(M), p(), C(S), C('TableOfContents'), I(null), I('TableOfContents'));
  const tree = buildTree(list);
  const resolve = defaultResolver(tree, settings());
  assert.deepEqual(flatten(tree.roots).map(node => resolve(nodeKey(node))), defaults(list, settings()));
  assert.deepEqual(['0:0', '2:1', '3:1', '4:0', '5:0'].map(resolve), ['rule:1', 'rule:i', 'continue:parent', 'hand', 'rule:–']);
});

test('ruleOf and ruleId: round trip of rule ids', () => {
  for (const id of ['rule:1', 'rule:– 1', 'rule:p. 1', 'rule:–', 'rule:[1]']) {
    assert.equal(ruleId(ruleOf(id)), id);
  }
  assert.deepEqual(ruleOf('rule:1'), ['1']);
  assert.deepEqual(ruleOf('rule:– 1'), ['–', '1']);
  assert.deepEqual(ruleOf('rule:p. 1'), ['p.', '1']);
  assert.equal(ruleId(['-', '1']), 'rule:– 1');
  assert.equal(ruleId(['uncounted']), 'rule:–');
});

test('ruleOf is null for strategies that are no rule', () => {
  for (const id of ['hand', 'continue:previous', 'continue:parent', 'continue:sibling']) {
    assert.equal(ruleOf(id), null);
  }
});
