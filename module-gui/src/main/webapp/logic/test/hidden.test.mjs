import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalog, VOLUME, start, pages } from './fixtures.mjs';
import { buildTree, setType, toggleBlock, toggleChild, clonePages } from '../blocks.mjs';
import { hasHidden, homeFor, findConflicts, explicitConflict, applyResolution, upsertOperation, commonOptions } from '../hidden.mjs';

const toc = { key: 'h1', type: 'TableOfContents', label: 'Inhaltsverzeichnis', firstPage: 1, lastPage: 3, title: null };
const article = { key: 'h2', type: 'Article', label: 'Artikel', firstPage: 3, lastPage: 3, title: 'Leitartikel' };
const note = { key: 'm1', type: 'Note', label: 'Notiz', value: 'n' };
const secondNumber = { key: 'm2', type: 'CurrentNo', label: 'Nummer', value: '9' };

/** Morning issue b1 on pages 0-3 with hidden TOC (1-3) and metadata; supplement b2 on 2-3 with a hidden article; evening issue b3 on 4. */
function loaded() {
  return pages(
    { depth: 1, starts: [start('MorningIssue', { id: 'b1', hidden: { structures: [{ ...toc }], metadata: [{ ...note }, { ...secondNumber }] } })] },
    { depth: 1 },
    { depth: 2, starts: [start('NewspaperSupplement', { id: 'b2', hidden: { structures: [{ ...article }], metadata: [] } })] },
    { depth: 2 },
    { depth: 1, starts: [start('EveningIssue', { id: 'b3' })] },
  );
}

test('hasHidden', () => {
  assert.equal(hasHidden(loaded()[0].starts[0]), true);
  assert.equal(hasHidden(loaded()[4].starts[0]), false);
});

test('homeFor picks the deepest covering block that allows the type, else the volume', () => {
  const tree = buildTree(loaded());
  assert.equal(homeFor(article, tree, catalog, VOLUME).node.start.id, 'b2');
  assert.equal(homeFor({ ...toc, firstPage: 4, lastPage: 4 }, tree, catalog, VOLUME).kind, 'volume');
  assert.equal(homeFor({ ...article, firstPage: 0, lastPage: 0 }, tree, catalog, VOLUME), null);
  assert.equal(homeFor({ ...toc, firstPage: -1, lastPage: -1 }, tree, catalog, VOLUME), null);
});

test('no conflict when nothing with hidden data changes', () => {
  const before = loaded();
  assert.deepEqual(findConflicts(before, setType(before, { page: 4, level: 0 }, 'MorningIssue', catalog), catalog, VOLUME), []);
});

test('DELETED: removing a block with hidden data; REHOME only when every structure has a home', () => {
  const before = loaded();
  const [conflict] = findConflicts(before, toggleChild(before, 2), catalog, VOLUME);
  assert.deepEqual([conflict.blockId, conflict.kind, conflict.options], ['b2', 'DELETED', ['REMOVE_ALL']]);
  assert.deepEqual(conflict.structures.map(s => s.key), ['h2']);
  // a new supplement over pages 2-3 (removed and started again; it runs to the end of the issue) can take the article
  const resplit = toggleChild(toggleChild(before, 2), 2);
  resplit[2].starts[0].type = 'NewspaperSupplement';
  assert.deepEqual(findConflicts(before, resplit, catalog, VOLUME)[0].options, ['REHOME', 'REMOVE_ALL']);
});

test('TYPE: a new type that does not allow hidden items offers KEEP_ALLOWED and REMOVE_ALL', () => {
  const before = loaded();
  const [conflict] = findConflicts(before, setType(before, { page: 0, level: 0 }, 'EveningIssue', catalog), catalog, VOLUME);
  assert.deepEqual([conflict.kind, conflict.options], ['TYPE', ['KEEP_ALLOWED', 'REMOVE_ALL']]);
  assert.deepEqual(conflict.structures.map(s => s.key), ['h1']);
  assert.deepEqual(conflict.metadata.map(m => m.key), ['m1']);
});

test('BOUNDARY: hidden structures outside the new range offer SHORTEN (and REHOME if possible)', () => {
  const before = loaded();
  const conflicts = findConflicts(before, toggleBlock(before, 2), catalog, VOLUME);
  const boundary = conflicts.find(c => c.blockId === 'b1');
  assert.deepEqual([boundary.kind, boundary.options], ['BOUNDARY', ['SHORTEN', 'REHOME']]);
  assert.deepEqual(boundary.structures.map(s => s.key), ['h1']);
});

test('applyResolution KEEP_ALLOWED removes only the incompatible items', () => {
  const before = loaded();
  const after = setType(before, { page: 0, level: 0 }, 'EveningIssue', catalog);
  const [conflict] = findConflicts(before, after, catalog, VOLUME);
  applyResolution(after, conflict, 'KEEP_ALLOWED', catalog, VOLUME);
  assert.deepEqual(after[0].starts[0].hidden.structures, []);
  assert.deepEqual(after[0].starts[0].hidden.metadata.map(m => m.key), ['m2']);
});

test('applyResolution SHORTEN clips the ranges; REHOME moves to the home', () => {
  const before = loaded();
  const shortened = toggleBlock(before, 2);
  const conflict = findConflicts(before, shortened, catalog, VOLUME).find(c => c.blockId === 'b1');
  applyResolution(shortened, conflict, 'SHORTEN', catalog, VOLUME);
  assert.deepEqual(shortened[0].starts[0].hidden.structures.map(s => [s.firstPage, s.lastPage]), [[1, 1]]);

  const moved = toggleBlock(before, 2);
  const result = applyResolution(moved, conflict, 'REHOME', catalog, VOLUME);
  assert.deepEqual(moved[0].starts[0].hidden.structures, []);
  assert.deepEqual(result.volumeAdditions.map(s => s.key), ['h1']);
});

test('applyResolution REMOVE_ALL and EXPLICIT clear the hidden data of the block', () => {
  const list = clonePages(loaded());
  applyResolution(list, explicitConflict(list[0].starts[0], 0), 'REMOVE_ALL', catalog, VOLUME);
  assert.equal(hasHidden(list[0].starts[0]), false);
});

test('upsertOperation keeps one operation per block and kind', () => {
  const ops = upsertOperation(upsertOperation([], 'b1', 'TYPE', 'KEEP_ALLOWED'), 'b1', 'TYPE', 'REMOVE_ALL');
  assert.deepEqual(upsertOperation(ops, 'b1', 'BOUNDARY', 'SHORTEN'), [
    { blockId: 'b1', kind: 'TYPE', action: 'REMOVE_ALL' },
    { blockId: 'b1', kind: 'BOUNDARY', action: 'SHORTEN' },
  ]);
});

test('commonOptions intersects the options of all conflicts', () => {
  assert.deepEqual(commonOptions([{ options: ['REHOME', 'REMOVE_ALL'] }, { options: ['REMOVE_ALL'] }]), ['REMOVE_ALL']);
  assert.deepEqual(commonOptions([]), []);
});

test('TYPE: a hidden metadata the new type manages (and would overwrite) is a conflict', () => {
  // review finding 1: an evening issue with a foreign title becomes a morning issue whose template writes the title
  const before = pages({ depth: 1, starts: [start('EveningIssue', { id: 'b1', hidden: { structures: [], metadata: [{ key: 'm1', type: 'TitleDocMain', label: 'Haupttitel', value: 'Sonderausgabe' }] } })] });
  const [conflict] = findConflicts(before, setType(before, { page: 0, level: 0 }, 'MorningIssue', catalog), catalog, VOLUME);
  assert.deepEqual([conflict.kind, conflict.metadata.map(m => m.key)], ['TYPE', ['m1']]);
});

test('BOUNDARY: a hidden structure that was already outside its block is left alone', () => {
  // review finding 3: no conflict for data loaded that way, also after unrelated changes
  const before = pages(
    { depth: 1, starts: [start('MorningIssue', { id: 'b1', hidden: { structures: [{ ...toc, firstPage: 1, lastPage: 2 }], metadata: [] } })] },
    { depth: 1 },
    { depth: 1, starts: [start('EveningIssue', { id: 'b2' })] },
    { depth: 1 },
  );
  assert.deepEqual(findConflicts(before, before, catalog, VOLUME), []);
  assert.deepEqual(findConflicts(before, toggleBlock(before, 3), catalog, VOLUME), []);
});
