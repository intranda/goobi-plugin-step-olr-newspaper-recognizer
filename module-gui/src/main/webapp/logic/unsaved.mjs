// What differs from the last saved state: the blocks are compared by start.id, their pages by the label loaded from the METS.
import { buildTree, flatten } from './blocks.mjs';
import { fieldStates } from './fields.mjs';
import { changedSinceOpening } from './pagination-tools.mjs';

const text = value => value ?? '';

function snapshot(node, catalog) {
  const { start } = node;
  return {
    type: start.type, date: start.date, prefix: start.prefix, number: start.number, suffix: start.suffix,
    values: Object.fromEntries(fieldStates(node, catalog).map(f => [f.key, f.value])),
    first: node.first, last: node.last, level: node.level, parentId: node.parent?.start.id ?? null,
  };
}

/** The state as last loaded or saved: the blocks that have an id by id, and the number of structures hidden at the volume. */
export function savedState(pages, catalog, volumeHidden) {
  const blocks = new Map();
  for (const node of flatten(buildTree(pages).roots)) {
    if (node.start.id) {
      blocks.set(node.start.id, snapshot(node, catalog));
    }
  }
  return { blocks, volumeStructures: (volumeHidden?.structures || []).length };
}

function changeOf(node, before, catalog, operations) {
  const { start } = node;
  const hidden = start.id != null && operations.some(op => op.blockId === start.id);
  if (!before) {
    return { isNew: true, fields: [], boundary: false, nesting: false, hidden };
  }
  const now = snapshot(node, catalog);
  const fields = [];
  if (now.type !== before.type) {
    fields.push('type');
  }
  if (text(now.date) !== text(before.date)) {
    fields.push('date');
  }
  if (['prefix', 'number', 'suffix'].some(key => text(now[key]) !== text(before[key]))) {
    fields.push('number');
  }
  for (const key of new Set([...Object.keys(before.values), ...Object.keys(now.values)])) {
    if (text(now.values[key]) !== text(before.values[key])) {
      fields.push(key);
    }
  }
  return {
    isNew: false, fields, hidden,
    boundary: now.first !== before.first || now.last !== before.last,
    nesting: now.level !== before.level || now.parentId !== before.parentId,
  };
}

const isChange = change => change.isNew || change.fields.length > 0 || change.boundary || change.nesting || change.hidden;

/** What is unsaved compared with the baseline; operations are the open additional-data decisions ({ blockId, kind, action }). */
export function unsavedChanges(baseline, pages, catalog, operations, volumeHidden) {
  const nodes = flatten(buildTree(pages).roots);
  const blocks = new Map();
  for (const node of nodes) {
    const change = changeOf(node, node.start.id ? baseline.blocks.get(node.start.id) : null, catalog, operations || []);
    if (isChange(change)) {
      blocks.set(`${node.first}:${node.level}`, change);
    }
  }
  const present = new Set(nodes.map(node => node.start.id).filter(Boolean));
  const removed = [...baseline.blocks.keys()].filter(id => !present.has(id)).length;
  const labels = changedSinceOpening(pages);
  const volume = (volumeHidden?.structures || []).length !== baseline.volumeStructures;
  return { blocks, labels, removed, volume, count: blocks.size, any: blocks.size > 0 || labels.length > 0 || removed > 0 || volume };
}
