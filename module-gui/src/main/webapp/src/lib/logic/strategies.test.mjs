import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, flatten, clonePages, toggleBlock, toggleChild, setType, removePage, makeLoose } from './blocks.mjs';
import { ruleOf, ruleId, nodeKey, defaultStrategy, defaultResolver, detectStrategies, strategyOptions, restructure, relabelChain, applyStrategy, afterTyping } from './strategies.mjs';
import { pages, settings, DEFAULT_RULES, I, p, C, labels, catalog, insertPage } from './fixtures.mjs';
import { paginateParts } from './pagination.mjs';
import { previewLabel } from './typing.mjs';
import { acceptOffers } from './pagination-tools.mjs';

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

/** The detected strategy of every node of the page list, in page order. */
const detected = (list, s = settings(), chosen = new Map()) => {
  const result = detectStrategies(list, s, chosen);
  return flatten(buildTree(list).roots).map(node => result.get(nodeKey(node)));
};

/** A top-level block of type over labels, one page per label. */
const block = (type, ...labels) => [I(type, labels[0]), ...labels.slice(1).map(label => p(label))];

test('detect: each preset is recognised', () => {
  const cases = [['1 2 3', 'rule:1'], ['i ii iii', 'rule:i'], ['I II III', 'rule:I'], ['[1] [2] [3]', 'rule:[1]'], ['– 1 2', 'rule:– 1'], ['– – –', 'rule:–']];
  for (const [text, id] of cases) {
    assert.deepEqual(detected(pages(...block(M, ...text.split(' ')))), [id], text);
    assert.deepEqual(detected(pages(...block('TableOfContents', ...text.split(' ')))), [id], `${text} without rule`);
  }
});

test('detect: continue:previous after a counting block, rule:1 when the count restarts', () => {
  assert.deepEqual(detected(pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'))), ['rule:1', 'continue:previous']);
  assert.deepEqual(detected(pages(...block(M, '1', '2', '3'), ...block(M, '1', '2'))), ['rule:1', 'rule:1']);
  // the previous block that counts, past a loose page and an unnumbered block
  const skipping = pages(...block(M, '1', '2'), p('–', 0), ...block('TableOfContents', '–'), ...block(M, '3', '4'));
  assert.deepEqual(detected(skipping), ['rule:1', 'rule:–', 'continue:previous']);
  // a continuing block keeps the leading uncounted value of its type's rule
  const evening = settings({ ...DEFAULT_RULES, EveningIssue: { beginsWith: ['–', '1'] } });
  assert.deepEqual(detected(pages(...block(M, '1', '2'), ...block('EveningIssue', '–', '3')), evening), ['rule:1', 'continue:previous']);
});

test('detect: nested own count and continuing the parent, with a child type without rule', () => {
  const own = pages(I(M, '1'), p('2'), p('3'), C('TableOfContents', 'i'), p('ii', 2), p('4'));
  assert.deepEqual(detected(own), ['rule:1', 'rule:i']);
  const continuing = pages(I(M, '1'), p('2'), p('3'), C('TableOfContents', '4'), p('5', 2), p('6'));
  assert.deepEqual(detected(continuing), ['rule:1', 'continue:parent']);
});

test('detect: a child whose default continues its parent is read after its parent', () => {
  const s = settings({ ...DEFAULT_RULES, EveningIssue: { beginsWith: ['–', '1'] } });
  const list = pages(I('EveningIssue', '–'), C('TableOfContents', '1'), p('2', 2), p('3'));
  assert.deepEqual(detected(list, s), ['rule:– 1', 'continue:parent']);
  // continue:parent fails: the child still gets a rule
  assert.deepEqual(detected(pages(I(M, '1'), C('TableOfContents', 'i'), p('ii', 2), p('2'))), ['rule:1', 'rule:i']);
});

test('detect: a child reads its own rule when its parent cannot be read with it continuing', () => {
  const s = settings({ ...DEFAULT_RULES, EveningIssue: { beginsWith: ['–', '1'] } });
  const list = pages(I('EveningIssue', '–'), C('TableOfContents', '1'), p('2', 2), p('1'));
  assert.deepEqual(detected(list, s), ['rule:– 1', 'rule:1']);
  assert.deepEqual(detected(pages(I(M, '1'), p('2'), C('TableOfContents', '1'), p('2', 2), p('3'))), ['rule:1', 'rule:1']);
});

test('detect: a child that ends up hand makes its parent read once more', () => {
  assert.deepEqual(detected(pages(I(M, '1'), p('2'), C('TableOfContents', '7'), p('8'))), ['hand', 'hand']);
});

test('detect: a later sibling of the same type continuing the first', () => {
  const list = pages(I(M, '1'), C(S, 'i'), p('ii', 2), C('TableOfContents', 'I'), C(S, 'iii'), p('iv', 2));
  assert.deepEqual(detected(list), ['rule:1', 'rule:i', 'rule:I', 'continue:sibling']);
});

test('detect: free text makes a block hand', () => {
  assert.deepEqual(detected(pages(...block(M, '1', 'Titelblatt', '3'))), ['hand']);
  // a gap is hand as well, and a following block continues its count
  assert.deepEqual(detected(pages(...block(M, '1', '2', '4'), ...block(M, '5'))), ['hand', 'continue:previous']);
});

test('detect: an untyped block labelled 1 2 3 is rule:1, not hand', () => {
  assert.deepEqual(detected(pages(...block(null, '1', '2', '3'))), ['rule:1']);
  assert.deepEqual(detected(pages(...block(null, '1', 'x'))), ['hand']);
});

test('detect: chosen breaks a tie', () => {
  const list = pages(...block(M, '–', '–'), ...block(M, '1'));
  assert.deepEqual(detected(list), ['rule:–', 'rule:1']);
  assert.deepEqual(detected(list, settings(), new Map([['0003.tif:0', 'continue:previous']])), ['rule:–', 'continue:previous']);
  // a chosen entry that does not match is passed over
  assert.deepEqual(detected(list, settings(), new Map([['0003.tif:0', 'rule:i']])), ['rule:–', 'rule:1']);
});

test('detect: the type default wins over earlier entries of the list', () => {
  // one page – matches rule:– 1 and rule:–: an untyped block takes the earlier entry, a type without rule its default rule:–
  assert.deepEqual(detected(pages(...block(null, '–'))), ['rule:– 1']);
  assert.deepEqual(detected(pages(...block('TableOfContents', '–'))), ['rule:–']);
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  assert.deepEqual(detected(pages(...block(M, '–', '–'), ...block(M, '1')), s), ['rule:–', 'continue:previous']);
});

test('detect: configured non-preset rule', () => {
  // beginsWith="p. 1" is split at blanks like every rule: the first page p., then 1, 2, …
  const s = settings({ ...DEFAULT_RULES, [M]: { beginsWith: ['p.', '1'] } });
  assert.deepEqual(detected(pages(...block(M, 'p.', '1', '2')), s), ['rule:p. 1']);
  assert.deepEqual(detected(pages(...block('TableOfContents', 'p.', '1', '2')), s), ['rule:p. 1']);
  assert.deepEqual(detected(pages(...block('TableOfContents', 'p.', '1', '2'))), ['hand']);
});

test("detect: '' and – are the same", () => {
  assert.deepEqual(detected(pages(...block(M, '', '1', '2'))), ['rule:– 1']);
  assert.deepEqual(detected(pages(...block(M, '', '-', 'uncounted', '–'))), ['rule:–']);
  assert.deepEqual(detected(pages(...block(M, '1', '2'), ...block(M, '', '3')), settings({ ...DEFAULT_RULES, [M]: { beginsWith: ['–', '1'] } })),
    ['rule:1', 'continue:previous']);
});

test('strategyOptions: top-level vs nested entries, hand only when current, disabled continue entries', () => {
  const s = settings({ ...DEFAULT_RULES, X: { beginsWith: ['p.', '1'] }, Y: { beginsWith: ['-', '1'] }, Z: { beginsWith: ['p.', '1'] } });
  const tree = buildTree(pages(I(M), C(S), C('TableOfContents'), C(S), I(M)));
  const [first, supplement, toc, second, last] = flatten(tree.roots);
  const ids = (node, current) => strategyOptions(tree, node, s, current).map(option => option.id + (option.disabled ? '!' : ''));
  const rules = ['rule:1', 'rule:i', 'rule:I', 'rule:[1]', 'rule:– 1', 'rule:–', 'rule:p. 1'];
  assert.deepEqual(ids(first, 'rule:1'), [...rules, 'continue:previous!', 'rules']);
  assert.deepEqual(ids(last, 'hand'), [...rules, 'hand', 'continue:previous', 'rules']);
  assert.deepEqual(ids(supplement, 'rule:i'), [...rules, 'continue:parent', 'continue:sibling!', 'rules']);
  assert.deepEqual(ids(toc, 'hand'), [...rules, 'hand', 'continue:parent', 'continue:sibling!', 'rules']);
  assert.deepEqual(ids(second, 'continue:sibling'), [...rules, 'continue:parent', 'continue:sibling', 'rules']);
  const options = strategyOptions(tree, second, s, 'rule:i');
  assert.deepEqual(options[0], { id: 'rule:1', kind: 'rule', beginsWith: ['1'] });
  assert.deepEqual(options[6], { id: 'rule:p. 1', kind: 'rule', beginsWith: ['p.', '1'] });
  assert.deepEqual(options.find(option => option.id === 'continue:sibling'), { id: 'continue:sibling', kind: 'continue', type: S, disabled: false });
  assert.deepEqual(options.at(-1), { id: 'rules', kind: 'rules' });
});

test('strategyOptions: a current rule that is no entry follows the configured rules', () => {
  const tree = buildTree(pages(I(M)));
  const s = settings({ ...DEFAULT_RULES, X: { beginsWith: ['p.', '1'] }, Y: { beginsWith: [''] } });
  const options = strategyOptions(tree, tree.roots[0], s, 'rule:S. 1');
  assert.deepEqual(options.map(option => option.id),
    ['rule:1', 'rule:i', 'rule:I', 'rule:[1]', 'rule:– 1', 'rule:–', 'rule:p. 1', 'rule:S. 1', 'continue:previous', 'rules']);
  assert.deepEqual(options[7], { id: 'rule:S. 1', kind: 'rule', beginsWith: ['S.', '1'] });
  assert.equal(strategyOptions(tree, tree.roots[0], s, 'rule:p. 1').length, 9);
});

test('detect: relabelling the whole volume by the detected strategies changes no label', () => {
  const list = pages(...block(M, '1', '2'), p('–', 0), ...block(M, '3', '4'), C(S, 'i'), p('ii', 2), C('TableOfContents', '5'), p('6', 2), p('7'),
    C(S, 'iii'), ...block(M, 'x', '8'), ...block(null, '9'), ...block('TableOfContents', '–'), ...block(M, '1'));
  const result = detectStrategies(list, settings(), new Map());
  assert.equal(labels(paginateParts(list, settings(), () => true, key => result.get(key))), labels(list));
  assert.deepEqual(detected(list), ['rule:1', 'continue:previous', 'rule:i', 'continue:parent', 'continue:sibling', 'hand', 'continue:previous',
    'rule:–', 'rule:1']);
});

/** count top-level blocks of size pages each, labels by label(page index, index in block). */
const volume = (count, size, label, child = null) => pages(...Array.from({ length: count }, (_, b) => Array.from({ length: size }, (_, k) => {
  const i = b * size + k;
  if (k === 0) {
    return I(M, label(i, k));
  }
  return child && k >= size - child.length ? (k === size - child.length ? C(S, child[0]) : p(child[k - size + child.length], 2)) : p(label(i, k));
})).flat());

const timed = run => {
  const start = performance.now();
  const result = run();
  return { result, ms: performance.now() - start };
};

test('detect: Goobi default 1…3000 over 300 blocks stays fast', () => {
  const list = volume(300, 10, i => String(i + 1));
  const { result, ms } = timed(() => detected(list));
  assert.deepEqual(result, ['rule:1', ...Array(299).fill('continue:previous')]);
  assert.ok(ms < 300, `${ms} ms`);
});

test('detect: 3000 pages of free text stay fast', () => {
  const list = volume(300, 10, i => `Text ${i % 3 ? 'a' : 'b'}`);
  const { result, ms } = timed(() => detected(list));
  assert.deepEqual(result, Array(300).fill('hand'));
  assert.ok(ms < 300, `${ms} ms`);
});

test('detect: 300 blocks with a supplement each', () => {
  const list = volume(300, 10, (i, k) => String(k + 1), ['i', 'ii']);
  const { result, ms } = timed(() => detected(list));
  assert.deepEqual(result, Array(300).fill(['rule:1', 'rule:i']).flat());
  assert.ok(ms < 300, `${ms} ms`);
});

// Relabelling after changes (per-block pagination design, decisions 7, 9 and 11).

/** restructure with the strategies the app would hold before the change: detected from the labels. */
const changed = (before, after, s = settings()) => restructure(before, after, s, new Map(), detectStrategies(before, s, new Map()));
/** Offers as [first page of the top-level block, offered pages]. */
const offered = result => result.offers.map(offer => [offer.first, offer.pages.join()]);
/** count blocks of MorningIssue with two pages each, labelled 1, 2, … through the volume. */
const counted = count => pages(...Array.from({ length: count }, (_, b) => block(M, String(2 * b + 1), String(2 * b + 2))).flat());

test('restructure: no structure change leaves every label alone', () => {
  const before = pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'), ...block(M, '–', '–'), ...block(M, 'Titel', 'x'),
    I(M, '1'), C(S, 'i'), p('ii', 2), p('2'), p('–', 0), ...block('TableOfContents', '–'), ...block(null, '7', '9'));
  const result = changed(before, clonePages(before));
  assert.equal(labels(result.pages), labels(before));
  assert.deepEqual(result.offers, []);
});

test('restructure: an untyped block over uncounted pages gets the rule once it is typed', () => {
  const loose = pages(p('–', 0), p('–', 0), p('–', 0));
  const untyped = changed(loose, toggleBlock(loose, 0));
  assert.equal(labels(untyped.pages), '– – –');
  assert.deepEqual(untyped.offers, []);
  const typed = changed(untyped.pages, setType(untyped.pages, { page: 0, level: 0 }, M, catalog));
  assert.equal(labels(typed.pages), '1 2 3');
  assert.deepEqual(typed.offers, []);
});

test('restructure: a new block over counting labels keeps them and is offered', () => {
  const goobi = pages(...Array.from({ length: 12 }, (_, i) => p(String(i + 1), 0)));
  const typed = setType(toggleBlock(goobi, 4), { page: 4, level: 0 }, M, catalog);
  const result = changed(goobi, typed);
  assert.equal(labels(result.pages), labels(goobi));
  assert.deepEqual(offered(result), [[4, '4,5,6,7,8,9,10,11']]);
  // the same in two steps: a click makes an untyped block, then the type
  const untyped = changed(goobi, toggleBlock(goobi, 4));
  const later = changed(untyped.pages, setType(untyped.pages, { page: 4, level: 0 }, M, catalog));
  assert.equal(labels(later.pages), labels(goobi));
  assert.deepEqual(offered(later), [[4, '4,5,6,7,8,9,10,11']]);
});

test('restructure: splitting keeps the labels of the new part and offers it', () => {
  const before = pages(...block(M, '1', '2', '3', '4', '5', '6'));
  const result = changed(before, toggleBlock(before, 3));
  assert.equal(labels(result.pages), '1 2 3 4 5 6');
  assert.deepEqual(offered(result), [[3, '3,4,5']]);
});

test('restructure: a new untyped block keeps counting labels', () => {
  const goobi = pages(...Array.from({ length: 12 }, (_, i) => p(String(i + 1), 0)));
  const result = changed(goobi, toggleBlock(goobi, 4));
  assert.equal(labels(result.pages), labels(goobi));
  assert.deepEqual(result.offers, []);
});

test('restructure: moving a boundary relabels strategy blocks and offers instead of relabelling hand pages', () => {
  const before = pages(...block(M, '1', '2', '3', '4'), ...block(M, '1', '2', '3'), ...block(M, 'x', 'y'));
  // the last page of the first block moves into the second: both have a strategy and are relabelled
  const back = changed(before, pages(...block(M, '1', '2', '3'), ...block(M, '4', '1', '2', '3'), ...block(M, 'x', 'y')));
  assert.equal(labels(back.pages), '1 2 3 1 2 3 4 x y');
  // the hand block after them stops the chain ('x' counts, roman 10), but is not offered: without counting through the volume its default
  // is rule:1, not continue:previous
  assert.deepEqual(back.offers, []);
  // the first page of the hand block moves into the second: it keeps its labels and is offered, so is the hand block
  const fromHand = changed(before, pages(...block(M, '1', '2', '3', '4'), ...block(M, '1', '2', '3', 'x'), ...block(M, 'y')));
  assert.equal(labels(fromHand.pages), '1 2 3 4 1 2 3 x y');
  assert.deepEqual(offered(fromHand), [[4, '7'], [8, '8']]);
  // the last page of the second block moves into the hand block: it is offered, not relabelled
  const intoHand = changed(before, pages(...block(M, '1', '2', '3', '4'), ...block(M, '1', '2'), ...block(M, '3', 'x', 'y')));
  assert.equal(labels(intoHand.pages), '1 2 3 4 1 2 3 x y');
  assert.deepEqual(offered(intoHand), [[6, '6,7,8']]);
});

test('restructure: merging a hand block keeps its labels and offers', () => {
  const before = pages(...block(M, '1', '2', '3'), ...block(M, 'x', '5', 'y'));
  const result = changed(before, toggleBlock(before, 3));
  assert.equal(labels(result.pages), '1 2 3 x 5 y');
  assert.deepEqual(offered(result), [[0, '3,5']]);
});

test('restructure: merging a strategy block relabels the merged block', () => {
  const before = pages(...block(M, '1', '2', '3'), ...block(M, '1', '2'));
  const result = changed(before, toggleBlock(before, 3));
  assert.equal(labels(result.pages), '1 2 3 4 5');
  assert.deepEqual(result.offers, []);
});

test('restructure: a new child over counting labels does not duplicate numbers in the parent', () => {
  const before = pages(...block(M, '1', '2', '3', '4', '5', '6'));
  const after = setType(toggleChild(before, 4, catalog), { page: 4, level: 1 }, S, catalog);
  const result = changed(before, after);
  assert.equal(labels(result.pages), '1 2 3 4 5 6');
  assert.deepEqual(offered(result), [[0, '4,5']]);
});

test('restructure: removing a child relabels the pages it gives back to its parent', () => {
  const before = pages(I(M, '1'), p('2'), C(S, 'i'), p('ii', 2), p('3'));
  const result = changed(before, toggleChild(before, 2, catalog));
  assert.equal(labels(result.pages), '1 2 3 4 5');
  assert.deepEqual(result.offers, []);
  // pages of a removed hand child keep their labels and are offered
  const hand = pages(I(M, '1'), p('2'), C(S, 'x'), p('y', 2), p('3'));
  const kept = changed(hand, toggleChild(hand, 2, catalog));
  assert.equal(labels(kept.pages), '1 2 x y 3');
  assert.deepEqual(offered(kept), [[0, '2,3,4']]);
});

test('restructure: a type change keeps continue:previous', () => {
  const before = counted(5);
  const result = changed(before, setType(before, { page: 4, level: 0 }, 'EveningIssue', catalog));
  assert.equal(labels(result.pages), labels(before));
  assert.deepEqual(result.offers, []);
});

test("restructure: a type change moves the default strategy to the new type's default", () => {
  const s = settings({ ...DEFAULT_RULES, ExtraEdition: { beginsWith: ['i'] } });
  const before = pages(...block(M, '1', '2'));
  const result = changed(before, setType(before, { page: 0, level: 0 }, 'ExtraEdition', catalog), s);
  assert.equal(labels(result.pages), 'i ii');
  assert.deepEqual(result.offers, []);
});

test('restructure: deleting a page renumbers the continuing blocks', () => {
  const before = pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'), ...block(M, '6', '7'));
  assert.equal(labels(changed(before, removePage(before, 1)).pages), '1 2 3 4 5 6');
  // the first page of a continuing block: the block keeps its strategy
  assert.equal(labels(changed(before, removePage(before, 3)).pages), '1 2 3 4 5 6');
});

test('restructure: a block that becomes loose leaves the stream, the blocks continuing it follow', () => {
  const before = pages(...block(M, '1', '2'), ...block(M, '3', '4'), ...block(M, '5', '6'));
  const result = changed(before, makeLoose(before, 2));
  assert.equal(labels(result.pages), '1 2 – – 3 4');
  assert.deepEqual(result.offers, []);
});

test('restructure: automatic false changes nothing', () => {
  const s = settings(DEFAULT_RULES, { automatic: false });
  const before = pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'), ...block(M, '6', '7'));
  const after = removePage(before, 1);
  const result = changed(before, after, s);
  assert.equal(labels(result.pages), labels(after));
  assert.deepEqual(result.offers, []);
});

// Ported from structureChanged, which the strategies replaced: the scenarios that still describe intended behaviour, with the outcome of the strategy
// model (per-block pagination design, decisions 7, 9 and 11).

/** Page list from page specs without labels and a label line ('·' = empty). */
const lab = (specs, text) => {
  const words = text.split(' ');
  return pages(...specs.map((spec, i) => ({ ...spec, label: words[i] === '·' ? '' : words[i] })));
};
const loose = () => p('', 0);
const EXTRA_RULES = { ...DEFAULT_RULES, ExtraEdition: { beginsWith: ['[1]'] } };

test('restructure: a page inserted before a child that continues its parent counts on through the child', () => {
  const before = lab([I(M), p(), C('TableOfContents'), p('', 2), p(), p()], '1 2 3 4 5 6');
  const result = changed(before, insertPage(before, 2));
  assert.equal(labels(result.pages), '1 2 3 4 5 6 7');
  assert.deepEqual(result.offers, []);
});

test('restructure: a supplement extended into its parent continues its own count, the parent continues after it', () => {
  const before = lab([I(M), p(), p(), C(S), p('', 2), p(), p()], '1 2 3 i ii 4 5');
  const after = lab([I(M), p(), p(), C(S), p('', 2), p('', 2), p()], '1 2 3 i ii 4 5');
  const result = changed(before, after);
  assert.equal(labels(result.pages), '1 2 3 i ii iii 4');
  assert.deepEqual(result.offers, []);
});

test('restructure: a supplement split keeps the labels of the new part and offers it', () => {
  const before = lab([I(M), p(), p(), C(S), p('', 2), p('', 2), p('', 2), p()], '1 2 3 i ii iii iv 4');
  const after = lab([I(M), p(), p(), C(S), p('', 2), C(S), p('', 2), p()], '1 2 3 i ii iii iv 4');
  const result = changed(before, after);
  assert.equal(labels(result.pages), '1 2 3 i ii iii iv 4');
  assert.deepEqual(offered(result), [[0, '5,6']]);
});

test('restructure: a type change with the same rule changes nothing', () => {
  const before = lab([I(M), p(), p()], '1 2 3');
  const result = changed(before, lab([I('EveningIssue'), p(), p()], '1 2 3'));
  assert.equal(labels(result.pages), '1 2 3');
  assert.deepEqual(result.offers, []);
});

test('restructure: untyped blocks keep their labels', () => {
  const result = changed(lab([I(null), p(), p()], '5 6 7'), lab([I(null), I(null), p()], '5 6 7'));
  assert.equal(labels(result.pages), '5 6 7');
  assert.deepEqual(result.offers, []);
});

test('restructure: bulk, removing all blocks gives every page the rule for pages without block', () => {
  const result = changed(lab([I(M), p(), I(M), p(), I(M), p()], '1 2 1 2 1 2'), lab([loose(), loose(), loose(), loose(), loose(), loose()], '1 2 1 2 1 2'));
  assert.equal(labels(result.pages), '– – – – – –');
});

test('restructure: bulk, a type pattern is one type change per block', () => {
  const before = lab([I(M), p(), I(M), p()], '1 2 1 2');
  const result = changed(before, lab([I('ExtraEdition'), p(), I('ExtraEdition'), p()], '1 2 1 2'), settings(EXTRA_RULES));
  assert.equal(labels(result.pages), '[1] [2] [1] [2]');
});

test('restructure: a new block over an uncounted page and a counting label keeps them and is offered', () => {
  const result = changed(lab([I(M), p(), p(), p()], '1 2 · 9'), lab([I(M), I(M), p(), p()], '1 2 · 9'));
  assert.equal(labels(result.pages), '1 2 · 9');
  assert.deepEqual(offered(result), [[1, '1,2,3']]);
  const initialised = changed(lab([I(M), p(), p(), p()], '1 2 – 9'), lab([I(M), I(M), p(), p()], '1 2 – 9'));
  assert.deepEqual(offered(initialised), [[1, '1,2,3']]); // state after initLabels
});

test('restructure: degenerate volumes', () => {
  assert.equal(labels(changed(lab([I(M)], '1'), lab([loose()], '1')).pages), '–');
  assert.equal(labels(changed(lab([loose(), loose(), loose()], '– – –'), lab([loose(), loose(), I(M)], '– – –')).pages), '– – 1');
  const onePage = changed(lab([I(M), p()], '1 2'), lab([I(M), I(M)], '1 2'));
  assert.equal(labels(onePage.pages), '1 2');
  assert.deepEqual(offered(onePage), [[1, '1']]);
  const looseStart = changed(lab([loose(), loose(), I(M), p()], '– – 1 2'), lab([loose(), I(M), I(M), p()], '– – 1 2'));
  assert.equal(labels(looseStart.pages), '– 1 1 2');
  assert.deepEqual(looseStart.offers, []);
});

test('restructure: a type change makes no offer for the block before', () => {
  const before = lab([I(M), p(), I(M), p(), p()], '1 5 1 2 3');
  const result = changed(before, lab([I(M), p(), I('ExtraEdition'), p(), p()], '1 5 1 2 3'), settings(EXTRA_RULES));
  assert.equal(labels(result.pages), '1 5 [1] [2] [3]');
  assert.deepEqual(result.offers, []);
});

test('restructure: a new block after a hand block offers both, the labels stay', () => {
  const result = changed(lab([I(M), p(), p(), p()], '1 2 7 8'), lab([I(M), p(), p(), I(M)], '1 2 7 8'));
  assert.equal(labels(result.pages), '1 2 7 8');
  assert.deepEqual(offered(result), [[0, '2'], [3, '3']]);
});

test('restructure: a supplement inserted into a hand block keeps the labels and offers the supplement', () => {
  const before = lab([I(M), p(), p(), p(), p(), p(), p()], '1 2 3 4 5 6 9');
  const result = changed(before, lab([I(M), p(), p(), C(S), p('', 2), p(), p()], '1 2 3 4 5 6 9'));
  assert.equal(labels(result.pages), '1 2 3 4 5 6 9');
  assert.deepEqual(offered(result), [[0, '3,4']]);
});

test('restructure: a supplement extended into a hand block keeps the page it gets and offers it', () => {
  const before = lab([I(M), p(), p(), C(S), p('', 2), p(), p(), p()], '1 2 3 i ii 4 5 9');
  const result = changed(before, lab([I(M), p(), p(), C(S), p('', 2), p('', 2), p(), p()], '1 2 3 i ii 4 5 9'));
  assert.equal(labels(result.pages), '1 2 3 i ii 4 5 9');
  assert.deepEqual(offered(result), [[0, '5']]);
});

test('restructure: a page inserted into a block paginates that block only', () => {
  const before = lab([I(M), p(), p(), I(M), p()], '1 2 3 1 2');
  const result = changed(before, insertPage(before, 2));
  assert.equal(labels(result.pages), '1 2 3 4 1 2');
  assert.deepEqual(result.offers, []);
});

test('restructure: counting through the volume, splitting a block of a volume counted per block keeps every label', () => {
  // each block restarts at 1, so each reads rule:1; the part split off (3 4) continues the part before it and is no offer
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const four = () => [I(M), p(), p(), p()];
  const before = lab([...four(), ...four(), ...four()], '1 2 3 4 1 2 3 4 1 2 3 4');
  const result = changed(before, lab([...four(), I(M), p(), I(M), p(), ...four()], '1 2 3 4 1 2 3 4 1 2 3 4'), s);
  assert.equal(labels(result.pages), '1 2 3 4 1 2 3 4 1 2 3 4');
  assert.deepEqual(result.offers, []);
  assert.deepEqual([...detectStrategies(result.pages, s, new Map())], [['0:0', 'rule:1'], ['4:0', 'rule:1'], ['6:0', 'continue:previous'], ['8:0', 'rule:1']]);
});

test('restructure: counting through the volume, a page inserted into block 2 renumbers the blocks continuing it', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const before = counted(4);
  assert.equal(labels(changed(before, insertPage(before, 3), s).pages), '1 2 3 4 5 6 7 8 9');
  assert.equal(labels(changed(before, insertPage(before, 7), s).pages), '1 2 3 4 5 6 7 8 9');
});

test('restructure: counting through the volume, a new block keeps its labels and is offered with the leading – of its rule', () => {
  const s = settings({ [M]: { beginsWith: ['–', '1'] } }, { countThroughVolume: true });
  const result = changed(lab([I(M), p(), p(), p(), p()], '– 1 2 3 4'), lab([I(M), p(), p(), I(M), p()], '– 1 2 3 4'), s);
  assert.equal(labels(result.pages), '– 1 2 3 4');
  assert.deepEqual(offered(result), [[3, '3,4']]);
});

test('applyStrategy: picking i on a supplement renumbers the rest of its parent', () => {
  const list = pages(I(M, '1'), p('2'), C('TableOfContents', '3'), p('4', 2), p('5'));
  const strategies = detectStrategies(list, settings(), new Map());
  assert.deepEqual([strategies.get('0:0'), strategies.get('2:1')], ['rule:1', 'continue:parent']); // derived
  const result = applyStrategy(list, settings(), strategies, { first: 2, level: 1 }, 'rule:i');
  assert.equal(labels(result.pages), '1 2 i ii 3');
  assert.deepEqual(result.offers, []);
  assert.equal(labels(list), '1 2 3 4 5', 'input unchanged'); // derived
});

test('relabelChain: stops at the first block that does not continue and offers it when hand', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(...block(M, 'i', 'ii'), ...block(M, '3', '4'), ...block(M, '20', '21'), ...block(M, '22', '23'));
  const strategies = new Map([['0:0', 'rule:i'], ['2:0', 'continue:previous'], ['4:0', 'hand'], ['6:0', 'continue:previous']]);
  const result = relabelChain(list, s, strategies, 0);
  assert.equal(labels(result.pages), 'i ii iii iv 20 21 22 23');
  assert.deepEqual(offered(result), [[4, '4,5']]);
  // a hand block that would not belong to the chain (its default is no continue entry) is not offered
  assert.deepEqual(relabelChain(list, settings(), strategies, 0).offers, []);
  const manual = relabelChain(list, settings(DEFAULT_RULES, { automatic: false }), strategies, 0);
  assert.equal(labels(manual.pages), labels(list));
  assert.deepEqual(manual.offers, []);
});

test('relabelChain: a chain that changes nothing offers nothing', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(...block(M, '1', '2'), ...block(M, '3', '4'), ...block(M, '20', '21'), ...block(M, '22', '23'));
  const strategies = new Map([['0:0', 'rule:1'], ['2:0', 'continue:previous'], ['4:0', 'hand'], ['6:0', 'continue:previous']]);
  const result = relabelChain(list, s, strategies, 0);
  assert.equal(labels(result.pages), labels(list));
  assert.deepEqual(result.offers, []);
});

test('relabelChain: a hand block without counting labels is passed over like the streams do', () => {
  const list = pages(...block(M, '1', '2'), ...block(M, 'Titel', '–'), ...block(M, '3', '4'));
  const strategies = detectStrategies(list, settings(), new Map());
  assert.deepEqual([...strategies.values()], ['rule:1', 'hand', 'continue:previous']); // derived
  const result = applyStrategy(list, settings(), strategies, { first: 0, level: 0 }, 'rule:i');
  assert.equal(labels(result.pages), 'i ii Titel – iii iv');
  assert.deepEqual(result.offers, []);
});

test('relabelChain: a block that joins another stream after a change is relabelled', () => {
  const list = pages(...block(M, '1', '2', '3'), ...block(M, '1', '2'), ...block(M, '3', '4'));
  const strategies = detectStrategies(list, settings(), new Map());
  assert.deepEqual([...strategies.values()], ['rule:1', 'rule:1', 'continue:previous']); // derived
  assert.equal(labels(applyStrategy(list, settings(), strategies, { first: 3, level: 0 }, 'rule:–').pages), '1 2 3 – – 4 5');
  const relabelled = pages(...block(M, '1', '2', '3'), ...block(M, '–', '–'), ...block(M, '3', '4'));
  const result = relabelChain(relabelled, settings(), new Map(strategies).set('3:0', 'rule:–'), 3);
  assert.equal(labels(result.pages), '1 2 3 – – 4 5');
  assert.deepEqual(result.offers, []);
});

test('relabelChain: 3000 pages in one chain stay fast', () => {
  const list = volume(300, 10, i => String(i < 10 ? i + 1 : i + 1001));
  const strategies = new Map(Array.from({ length: 300 }, (_, b) => [`${b * 10}:0`, b ? 'continue:previous' : 'rule:1']));
  const { result, ms } = timed(() => relabelChain(list, settings(), strategies, 0));
  assert.equal(labels(result.pages), Array.from({ length: 3000 }, (_, i) => String(i + 1)).join(' '));
  assert.ok(ms < 300, `${ms} ms`);
});

// Typing a label (final review I1): a block typed into "edited by hand" offers the blocks the chain would change instead of renumbering them.

/** The page list after typing text on page index in mode, as commitLabel takes it: the typing, then afterTyping. */
const typed = (list, s, index, text, mode) => {
  const strategies = detectStrategies(list, s, new Map());
  const result = previewLabel(list, s, index, text, mode, key => strategies.get(key) ?? 'hand');
  return { strategies, ...afterTyping(result.pages, s, strategies, new Map(), index, mode) };
};

test('afterTyping: a hand-typed label on the last page of a block offers the continuing blocks and changes nothing after it', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'), ...block(M, '6', '7'));
  const result = typed(list, s, 2, '13', 'follow');
  assert.deepEqual([...result.strategies.values()], ['rule:1', 'continue:previous', 'continue:previous']); // derived
  assert.equal(labels(result.pages), '1 2 13 4 5 6 7');
  assert.deepEqual(offered(result), [[3, '3,4'], [5, '5,6']]);
  // accepting both renumbers the blocks by their own strategy relative to the typed label
  const all = acceptOffers(result.pages, s, result.offers, detectStrategies(result.pages, s, new Map()));
  assert.equal(labels(all.pages), '1 2 13 14 15 16 17');
  const first = acceptOffers(result.pages, s, result.offers.slice(0, 1), detectStrategies(result.pages, s, new Map()));
  assert.equal(labels(first.pages), '1 2 13 14 15 16 17');
});

test('afterTyping: a block that still matches a strategy after the typing renumbers the blocks continuing it', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'), ...block(M, '6', '7'));
  const result = typed(list, s, 0, 'i', 'follow');
  assert.equal(labels(result.pages), 'i ii iii iv v vi vii');
  assert.deepEqual(result.offers, []);
});

test('afterTyping: a single label never renumbers later blocks, also when the block still matches', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true });
  const list = pages(...block(M, '1'), ...block(M, '2', '3'), ...block(M, '4', '5'));
  assert.equal(labels(typed(list, s, 0, 'i', 'follow').pages), 'i ii iii iv v'); // derived: the chain runs in follow mode
  const result = typed(list, s, 0, 'i', 'single');
  assert.equal(labels(result.pages), 'i 2 3 4 5');
  assert.deepEqual(offered(result), [[1, '1,2'], [3, '3,4']]);
});

test('afterTyping: without automatic pagination nothing is relabelled or offered', () => {
  const s = settings(DEFAULT_RULES, { countThroughVolume: true, automatic: false });
  const list = pages(...block(M, '1', '2', '3'), ...block(M, '4', '5'));
  const result = typed(list, s, 2, '13', 'follow');
  assert.equal(labels(result.pages), '1 2 13 4 5');
  assert.deepEqual(result.offers, []);
});
