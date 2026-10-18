import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, VOLUME, start, pages, shape } from './fixtures.mjs';
import {
  buildTree, flatten, validatePages, toggleBlock, toggleChild, setType, setDateInput, initStarts, validateBlocks,
  removeAllBlocks, resetToAnalysis, removePage, toSaveRequest, siblingsFrom,
} from '../blocks.mjs';

const issueWithSupplement = () => pages(
  { depth: 1, starts: [start('MorningIssue', { id: 'b1' })] },
  { depth: 1 },
  { depth: 2, starts: [start('NewspaperSupplement', { id: 'b2' })] },
  { depth: 2 },
  { depth: 1 },
  { depth: 1, starts: [start('EveningIssue', { id: 'b3' })] },
);

test('buildTree builds blocks, child blocks and pages without structure', () => {
  const tree = buildTree(pages({ depth: 0 }, ...issueWithSupplement()));
  assert.deepEqual(tree.loose, [0]);
  assert.deepEqual(tree.roots.map(n => [n.start.id, n.first, n.last]), [['b1', 1, 5], ['b3', 6, 6]]);
  const child = tree.roots[0].children[0];
  assert.deepEqual([child.start.id, child.level, child.first, child.last], ['b2', 1, 3, 4]);
  assert.equal(child.parent, tree.roots[0]);
  assert.deepEqual(flatten(tree.roots).map(n => n.start.id), ['b1', 'b2', 'b3']);
});

test('validatePages finds pages deeper than their enclosing blocks', () => {
  assert.equal(validatePages(issueWithSupplement()), null);
  assert.deepEqual(validatePages(pages({ depth: 1, starts: [start(null)] }, { depth: 2 })), { page: 1, reason: 'DEPTH_EXCEEDS' });
  assert.deepEqual(validatePages(pages({ depth: 1, starts: [start(null), start(null)] })), { page: 0, reason: 'TOO_MANY_STARTS' });
  assert.throws(() => buildTree(pages({ depth: 2 })), /Invalid page data at page 1/);
});

test('siblingsFrom returns the block and its following siblings only', () => {
  const tree = buildTree(issueWithSupplement());
  assert.deepEqual(siblingsFrom(tree, { page: 0, level: 0 }).map(n => n.start.id), ['b1', 'b3']);
  assert.deepEqual(siblingsFrom(tree, { page: 2, level: 1 }).map(n => n.start.id), ['b2']);
});

test('toggleBlock adds a block and keeps the input unchanged', () => {
  const before = issueWithSupplement();
  const after = toggleBlock(before, 1);
  assert.equal(shape(after), '1/1 1/1 2/1 2/0 1/0 1/1');
  assert.equal(after[1].starts[0].type, null);
  assert.equal(shape(before), '1/1 1/0 2/1 2/0 1/0 1/1');
});

test('toggleBlock inside a child block ends the child before the page', () => {
  assert.equal(shape(toggleBlock(issueWithSupplement(), 3)), '1/1 1/0 2/1 1/1 1/0 1/1');
});

test('toggleBlock on a child start moves the child into the new block', () => {
  const after = toggleBlock(issueWithSupplement(), 2);
  assert.equal(shape(after), '1/1 1/0 2/2 2/0 1/0 1/1');
  assert.deepEqual(after[2].starts.map(s => s.id), [null, 'b2']);
});

test('toggleBlock removes a block; its pages join the previous block', () => {
  assert.equal(shape(toggleBlock(issueWithSupplement(), 5)), '1/1 1/0 2/1 2/0 1/0 1/0');
});

test('toggleBlock removes the first block; its pages become pages without structure', () => {
  assert.equal(shape(toggleBlock(issueWithSupplement(), 0)), '0/0 0/0 0/0 0/0 0/0 1/1');
});

test('toggleBlock on a page without structure takes the following pages without structure', () => {
  assert.equal(shape(toggleBlock(pages({ depth: 0 }, { depth: 0 }, { depth: 1, starts: [start('MorningIssue')] }), 0)), '1/1 1/0 1/1');
});

test('toggleChild removes a child; its pages go back to the parent', () => {
  assert.equal(shape(toggleChild(issueWithSupplement(), 2)), '1/1 1/0 1/0 1/0 1/0 1/1');
});

test('toggleChild inside a child splits it', () => {
  assert.equal(shape(toggleChild(issueWithSupplement(), 3)), '1/1 1/0 2/1 2/1 1/0 1/1');
});

test('toggleChild right after a child extends it', () => {
  assert.equal(shape(toggleChild(issueWithSupplement(), 4)), '1/1 1/0 2/1 2/0 2/0 1/1');
});

test('toggleChild elsewhere starts a child, also on a block start', () => {
  assert.equal(shape(toggleChild(issueWithSupplement(), 1)), '1/1 2/1 2/1 2/0 1/0 1/1');
  assert.equal(shape(toggleChild(issueWithSupplement(), 5)), '1/1 1/0 2/1 2/0 1/0 2/2');
});

test('toggleChild starts a child that runs to the end of the block', () => {
  const list = pages(
    { depth: 1, starts: [start('MorningIssue', { id: 'b1' })] },
    { depth: 1 },
    { depth: 1 },
    { depth: 1 },
    { depth: 1, starts: [start('EveningIssue', { id: 'b3' })] },
    { depth: 1 },
  );
  assert.equal(shape(toggleChild(list, 1)), '1/1 2/1 2/0 2/0 1/1 1/0');
});

test('toggleChild on a block start starts a child that runs to the end of the block', () => {
  const list = pages({ depth: 1, starts: [start('MorningIssue', { id: 'b1' })] }, { depth: 1 }, { depth: 1 });
  assert.equal(shape(toggleChild(list, 0)), '2/2 2/0 2/0');
});

test('toggleChild ends a new child before the next child', () => {
  const list = pages(
    { depth: 1, starts: [start('MorningIssue', { id: 'b1' })] },
    { depth: 1 },
    { depth: 1 },
    { depth: 2, starts: [start('NewspaperSupplement', { id: 'b2' })] },
    { depth: 2 },
    { depth: 1 },
  );
  assert.equal(shape(toggleChild(list, 1)), '1/1 2/1 2/0 2/1 2/0 1/0');
});

test('toggleChild right after a child extends it to the end of the block', () => {
  const list = pages(
    { depth: 1, starts: [start('MorningIssue', { id: 'b1' })] },
    { depth: 2, starts: [start('NewspaperSupplement', { id: 'b2' })] },
    { depth: 2 },
    { depth: 1 },
    { depth: 1 },
    { depth: 1 },
    { depth: 1, starts: [start('EveningIssue', { id: 'b3' })] },
  );
  assert.equal(shape(toggleChild(list, 3)), '1/1 2/1 2/0 2/0 2/0 2/0 1/1');
});

test('toggleChild ignores pages without structure', () => {
  assert.equal(shape(toggleChild(pages({ depth: 0 }), 0)), '0/0');
});

test('setType clears fields the new type does not have and invalid child types', () => {
  const list = issueWithSupplement();
  Object.assign(list[0].starts[0], { date: '1890-03-01', dateInput: '01.03.1890', prefix: 'Nr. ', number: '1', suffix: 'a' });
  const extra = setType(list, { page: 0, level: 0 }, 'ExtraEdition', catalog);
  assert.deepEqual([extra[0].starts[0].date, extra[0].starts[0].dateInput, extra[0].starts[0].number, extra[0].starts[0].prefix], [null, '', '1', null]);
  assert.equal(extra[2].starts[0].type, null);
  const evening = setType(list, { page: 0, level: 0 }, 'EveningIssue', catalog);
  assert.deepEqual([evening[0].starts[0].date, evening[0].starts[0].suffix, evening[2].starts[0].type], ['1890-03-01', 'a', 'NewspaperSupplement']);
});

test('setType to "please select" keeps every value', () => {
  const list = issueWithSupplement();
  Object.assign(list[0].starts[0], { date: '1890-03-01', number: '1' });
  const untyped = setType(list, { page: 0, level: 0 }, null, catalog);
  assert.deepEqual([untyped[0].starts[0].type, untyped[0].starts[0].date, untyped[0].starts[0].number], [null, '1890-03-01', '1']);
});

test('setDateInput keeps invalid input as dateRaw', () => {
  const s = start('MorningIssue');
  setDateInput(s, '01.03.1890', 'dd.MM.yyyy');
  assert.deepEqual([s.date, s.dateRaw, s.dateInput], ['1890-03-01', null, '01.03.1890']);
  setDateInput(s, '1890', 'dd.MM.yyyy');
  assert.deepEqual([s.date, s.dateRaw], [null, '1890']);
  setDateInput(s, '', 'dd.MM.yyyy');
  assert.deepEqual([s.date, s.dateRaw], [null, null]);
});

test('initStarts fills the date input and remembers the loaded type', () => {
  const list = pages({ depth: 1, starts: [start('MorningIssue', { id: 'b1', date: '1890-03-01' })] }, { depth: 1, starts: [start('EveningIssue', { id: 'b2', dateRaw: '1890' })] });
  initStarts(list, 'dd.MM.yyyy');
  assert.deepEqual([list[0].starts[0].dateInput, list[0].starts[0].originalType, list[1].starts[0].dateInput], ['01.03.1890', 'MorningIssue', '1890']);
});

test('validateBlocks flags missing types, wrong positions, dateRaw, required values and duplicates', () => {
  const list = pages(
    { depth: 1, starts: [start(null)] },
    { depth: 2, starts: [start('EveningIssue', { date: '1890-03-01', number: '1' }), start('TableOfContents')] },
    { depth: 1, starts: [start('MorningIssue', { dateRaw: '1890' })] },
    { depth: 1, starts: [start('ExtraEdition', { number: ' ' })] },
    { depth: 1, starts: [start('EveningIssue', { date: '1890-03-01', number: '1' })] },
  );
  const result = validateBlocks(list, catalog, VOLUME, true);
  assert.deepEqual(result.missingType, [{ page: 0, level: 0 }]);
  assert.deepEqual(result.notAllowed, [{ page: 1, level: 1 }]);
  assert.deepEqual(result.invalidDate, [{ page: 2, level: 0 }]);
  assert.deepEqual(result.missingRequired, [{ page: 3, level: 0 }]);
  assert.deepEqual(result.duplicates, [{ page: 1, level: 0 }, { page: 4, level: 0 }]);
  assert.equal(result.valid, false);
  assert.equal(validateBlocks(list, catalog, VOLUME, false).duplicates.length, 0);
});

test('validateBlocks accepts morning and evening issue with the same date and number', () => {
  const list = pages(
    { depth: 1, starts: [start('MorningIssue', { date: '1890-03-01', number: '1' })] },
    { depth: 1, starts: [start('EveningIssue', { date: '1890-03-01', number: '1' })] },
  );
  assert.equal(validateBlocks(list, catalog, VOLUME, true).valid, true);
});

test('removeAllBlocks leaves one untyped block over all pages', () => {
  assert.equal(shape(removeAllBlocks(issueWithSupplement())), '1/1 1/0 1/0 1/0 1/0 1/0');
});

test('resetToAnalysis starts untyped blocks on the first page and detected pages', () => {
  const list = pages({ depth: 0, result: -0.9 }, { depth: 0, result: 0.2 }, { depth: 0, result: -0.85 });
  const reset = resetToAnalysis(list);
  assert.equal(shape(reset), '1/1 1/0 1/1');
  assert.equal(reset[2].starts[0].type, null);
});

test('removePage moves block starts to the next page and shifts hidden structures', () => {
  const list = issueWithSupplement();
  list[0].starts[0].hidden.structures.push({ key: 'h1', type: 'TableOfContents', firstPage: 1, lastPage: 3 });
  list[0].starts[0].hidden.structures.push({ key: 'h2', type: 'TableOfContents', firstPage: 0, lastPage: 0 });
  const after = removePage(list, 0);
  assert.equal(shape(after), '1/1 2/1 2/0 1/0 1/1');
  assert.deepEqual(after[0].starts[0].hidden.structures.map(s => [s.firstPage, s.lastPage]), [[0, 2], [-1, -1]]);
});

test('toSaveRequest sends only the transfer fields', () => {
  const list = pages({ depth: 1, starts: [start('MorningIssue', { id: 'b1', date: '1890-03-01', dateInput: '01.03.1890', originalType: 'MorningIssue' })] });
  list[0].image = { thumbnailUrl: 'x' };
  const request = JSON.parse(toSaveRequest(list, [{ blockId: 'b1', kind: 'TYPE', action: 'KEEP_ALLOWED' }]));
  assert.deepEqual(request, {
    pages: [{ filename: '0001.tif', depth: 1, starts: [{ id: 'b1', type: 'MorningIssue', date: '1890-03-01', dateRaw: null, prefix: null, number: null, suffix: null }] }],
    operations: [{ blockId: 'b1', kind: 'TYPE', action: 'KEEP_ALLOWED' }],
  });
});
