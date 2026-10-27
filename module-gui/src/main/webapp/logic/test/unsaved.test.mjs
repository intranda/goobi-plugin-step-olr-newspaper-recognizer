import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clonePages, removePage } from '../blocks.mjs';
import { initLabels } from '../pagination.mjs';
import { savedState, unsavedChanges } from '../unsaved.mjs';
import { catalog, fieldCatalog, pages, start } from './fixtures.mjs';

const VH = { structures: [], metadata: [] };
const issue = (id, values = {}) => start('MorningIssue', { id, date: '2026-01-01', number: '1', ...values });

// two issues of two pages each, then a loose page
const saved = () => pages(
  { depth: 1, starts: [issue('b1')], label: '1', metsLabel: '1' },
  { depth: 1, label: '2', metsLabel: '2' },
  { depth: 1, starts: [issue('b2', { number: '2' })], label: '3', metsLabel: '3' },
  { depth: 1, label: '4', metsLabel: '4' },
  { depth: 0, label: '–', metsLabel: '–' },
);

/** Unsaved changes of the saved pages after mutate has changed a copy of them. */
function after(mutate, cat = catalog, operations = []) {
  const list = saved();
  const baseline = savedState(list, cat, VH);
  const current = clonePages(list);
  mutate(current);
  return unsavedChanges(baseline, current, cat, operations, VH);
}

test('a block without id is new', () => {
  const unsaved = after(list => { list[0].starts[0].id = null; });
  assert.equal(unsaved.blocks.get('0:0').isNew, true);
  assert.equal(unsaved.count, 1);
  assert.equal(unsaved.any, true);
});

test('the same pages are not unsaved', () => {
  const unsaved = after(() => {});
  assert.equal(unsaved.any, false);
  assert.equal(unsaved.blocks.size, 0);
  assert.deepEqual(unsaved.labels, []);
  assert.equal(unsaved.removed, 0);
  assert.equal(unsaved.volume, false);
});

test('type, date and number changes name their field', () => {
  assert.deepEqual(after(list => { list[0].starts[0].type = 'EveningIssue'; }).blocks.get('0:0').fields, ['type']);
  assert.deepEqual(after(list => { list[0].starts[0].date = '2026-01-02'; }).blocks.get('0:0').fields, ['date']);
  assert.deepEqual(after(list => { list[0].starts[0].number = '9'; }).blocks.get('0:0').fields, ['number']);
  assert.deepEqual(after(list => { list[0].starts[0].prefix = 'Nr. '; }).blocks.get('0:0').fields, ['number']);
  assert.deepEqual(after(list => { list[0].starts[0].suffix = 'a'; }).blocks.get('0:0').fields, ['number']);
});

test('a field value changes, also a generated one', () => {
  const note = after(list => { list[0].starts[0].values = { Note: 'x' }; }, fieldCatalog);
  assert.deepEqual(note.blocks.get('0:0').fields, ['Note']);
  const generated = after(list => { list[0].starts[0].number = '7'; }, fieldCatalog);
  assert.deepEqual(generated.blocks.get('0:0').fields, ['number', 'TitleDocMain']);
});

test('a value changed back is no change', () => {
  const list = saved();
  const baseline = savedState(list, catalog, VH);
  const current = clonePages(list);
  current[0].starts[0].number = '7';
  assert.equal(unsavedChanges(baseline, current, catalog, [], VH).any, true);
  current[0].starts[0].number = '1';
  assert.equal(unsavedChanges(baseline, current, catalog, [], VH).any, false);
});

test('a split shortens the block and adds a new one', () => {
  const list = saved();
  const baseline = savedState(list, catalog, VH);
  const current = clonePages(list);
  current[3].starts = [start('MorningIssue')];
  const split = unsavedChanges(baseline, current, catalog, [], VH);
  assert.equal(split.blocks.get('2:0').boundary, true);
  assert.equal(split.blocks.get('3:0').isNew, true);
  assert.equal(split.count, 2);
  current[3].starts = [];
  assert.equal(unsavedChanges(baseline, current, catalog, [], VH).any, false);
});

test('nesting changed with the same pages', () => {
  const nested = () => pages(
    { depth: 1, starts: [issue('b1')], label: '1', metsLabel: '1' },
    { depth: 2, starts: [start('NewspaperSupplement', { id: 'c1' })], label: '2', metsLabel: '2' },
  );
  const baseline = savedState(nested(), catalog, VH);
  const current = nested();
  current[1].depth = 1; // the supplement becomes a sibling of the issue
  const unsaved = unsavedChanges(baseline, current, catalog, [], VH);
  assert.equal(unsaved.blocks.get('1:0').nesting, true);
  assert.equal(unsaved.any, true);
});

test('an additional-data decision marks its block', () => {
  const unsaved = after(() => {}, catalog, [{ blockId: 'b2', kind: 'TYPE', action: 'KEEP' }]);
  assert.equal(unsaved.blocks.get('2:0').hidden, true);
  assert.equal(unsaved.blocks.has('0:0'), false);
  assert.equal(unsaved.any, true);
});

test('labels count, also on pages without block', () => {
  const unsaved = after(list => { list[1].label = 'x'; list[4].label = ''; });
  assert.deepEqual(unsaved.labels, [1, 4]);
  assert.equal(unsaved.blocks.size, 0);
  assert.equal(unsaved.any, true);
});

test('removing every block is unsaved', () => {
  const unsaved = after(list => list.forEach(page => { page.depth = 0; page.starts = []; }));
  assert.equal(unsaved.removed, 2);
  assert.equal(unsaved.blocks.size, 0);
  assert.equal(unsaved.any, true);
});

test('a new baseline clears everything', () => {
  const current = clonePages(saved());
  current[0].starts[0].number = '9';
  current[1].label = 'x';
  current[3].starts = [start('MorningIssue')];
  assert.equal(unsavedChanges(savedState(saved(), catalog, VH), current, catalog, [], VH).any, true);
  // the reload after a save assigns ids and resets metsLabel
  const reloaded = clonePages(current);
  reloaded[3].starts[0].id = 'b3';
  initLabels(reloaded);
  assert.equal(unsavedChanges(savedState(reloaded, catalog, VH), reloaded, catalog, [], VH).any, false);
});

test('additional data of the volume counts', () => {
  const list = saved();
  const baseline = savedState(list, catalog, VH);
  const unsaved = unsavedChanges(baseline, clonePages(list), catalog, [], { structures: [{ id: 's1' }], metadata: [] });
  assert.equal(unsaved.volume, true);
  assert.equal(unsaved.any, true);
  assert.equal(unsaved.blocks.size, 0);
});

test('deleting a page without block is unsaved', () => {
  const list = saved();
  const unsaved = unsavedChanges(savedState(list, catalog, VH), removePage(list, 4), catalog, [], VH);
  assert.equal(unsaved.any, true);
  assert.deepEqual(unsaved.pages, { removed: 1, added: 0 });
  assert.equal(unsaved.blocks.size, 0);
});

test('deleting a page inside a block marks only that block', () => {
  const list = saved();
  const unsaved = unsavedChanges(savedState(list, catalog, VH), removePage(list, 1), catalog, [], VH);
  assert.deepEqual([...unsaved.blocks.keys()], ['0:0']); // b2 keeps its pages 0003.tif..0004.tif, now at 1..2
  assert.equal(unsaved.blocks.get('0:0').boundary, true);
  assert.deepEqual(unsaved.pages, { removed: 1, added: 0 });
});

test('a new baseline after a deletion clears it', () => {
  const current = removePage(saved(), 1);
  const unsaved = unsavedChanges(savedState(current, catalog, VH), current, catalog, [], VH);
  assert.deepEqual(unsaved.pages, { removed: 0, added: 0 });
  assert.equal(unsaved.any, false);
});
