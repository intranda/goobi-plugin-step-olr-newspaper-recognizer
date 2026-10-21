// Conflicts between a change and hidden data, following "Shared rules: hidden data" in the implementation plan.
// Mirrors HiddenDataResolver.java; the backend re-checks everything and refuses a save it cannot resolve.
import { buildTree, flatten } from './blocks.mjs';
import { userValuesLeftBehind } from './fields.mjs';

const structuresOf = start => start?.hidden?.structures || [];
const metadataOf = start => start?.hidden?.metadata || [];

export const hasHidden = start => structuresOf(start).length > 0 || metadataOf(start).length > 0;

function byId(tree) {
  const map = new Map();
  flatten(tree.roots).forEach(node => { if (node.start.id) map.set(node.start.id, node); });
  return map;
}

export function homeFor(structure, tree, catalog, volumeType) {
  if (structure.firstPage < 0) {
    return null;
  }
  let best = null;
  for (const node of flatten(tree.roots)) {
    if (node.start.type && node.first <= structure.firstPage && structure.lastPage <= node.last
      && (catalog[node.start.type]?.children || []).includes(structure.type) && (!best || node.level > best.level)) {
      best = node;
    }
  }
  if (best) {
    return { kind: 'block', node: best };
  }
  return (catalog[volumeType]?.children || []).includes(structure.type) ? { kind: 'volume' } : null;
}

/** @returns {import('../src/types').Conflict[]} */
export function findConflicts(oldPages, newPages, catalog, volumeType) {
  const newTree = buildTree(newPages);
  const newById = byId(newTree);
  const conflicts = [];
  for (const old of flatten(buildTree(oldPages).roots)) {
    const start = old.start;
    const node = start.id ? newById.get(start.id) : null;
    // values the user entered that the new type does not allow are decided together with the hidden data
    const userValues = node ? userValuesLeftBehind(node.start, catalog)
      .filter(({ field }) => !(catalog[node.start.type]?.allowedMetadata || []).includes(field.key))
      .map(({ field, value }) => ({ key: `field:${field.key}`, type: field.key, label: field.label, value })) : [];
    if (!start.id || (!hasHidden(start) && !userValues.length)) {
      continue;
    }
    if (!node) {
      const structures = structuresOf(start);
      const canRehome = structures.length > 0 && structures.every(s => homeFor(s, newTree, catalog, volumeType));
      conflicts.push({ blockId: start.id, kind: 'DELETED', type: start.type, page: old.first, structures, metadata: metadataOf(start),
        options: canRehome ? ['REHOME', 'REMOVE_ALL'] : ['REMOVE_ALL'] });
      continue;
    }
    const type = node.start.type;
    let remaining = structuresOf(start);
    if (type && type !== start.type) {
      const info = catalog[type] || {};
      const badStructures = remaining.filter(s => !(info.children || []).includes(s.type));
      const badMetadata = [...metadataOf(start).filter(m => !(info.allowedMetadata || []).includes(m.type)), ...userValues];
      // hidden metadata the new type manages would be overwritten by the backend (first instance of each such type)
      const loaded = catalog[start.originalType || start.type] || {};
      for (const type of (info.managedMetadata || []).filter(t => !(loaded.managedMetadata || []).includes(t))) {
        const first = metadataOf(start).find(m => m.type === type);
        if (first && !badMetadata.includes(first)) {
          badMetadata.push(first);
        }
      }
      if (badStructures.length || badMetadata.length) {
        conflicts.push({ blockId: start.id, kind: 'TYPE', type, page: node.first, structures: badStructures, metadata: badMetadata,
          options: ['KEEP_ALLOWED', 'REMOVE_ALL'] });
        remaining = remaining.filter(s => !badStructures.includes(s));
      }
    }
    // only structures that were inside the block before; structures already outside stay as they are
    const outside = remaining.filter(s => s.firstPage >= old.first && s.lastPage <= old.last
      && (s.firstPage < node.first || s.lastPage > node.last));
    if (outside.length) {
      const canRehome = outside.every(s => homeFor(s, newTree, catalog, volumeType));
      conflicts.push({ blockId: start.id, kind: 'BOUNDARY', type, page: node.first, structures: outside, metadata: [],
        options: canRehome ? ['SHORTEN', 'REHOME'] : ['SHORTEN'] });
    }
  }
  return conflicts;
}

export function explicitConflict(start, page) {
  return { blockId: start.id, kind: 'EXPLICIT', type: start.type, page, structures: structuresOf(start), metadata: metadataOf(start), options: ['REMOVE_ALL'] };
}

export function applyResolution(pages, conflict, action, catalog, volumeType) {
  const tree = buildTree(pages);
  const node = byId(tree).get(conflict.blockId);
  const keys = new Set([...conflict.structures.map(s => s.key), ...conflict.metadata.map(m => m.key)]);
  const volumeAdditions = [];
  const moveToHome = structures => structures.forEach(structure => {
    const home = homeFor(structure, tree, catalog, volumeType);
    if (home?.kind === 'block') {
      home.node.start.hidden.structures.push({ ...structure });
    } else if (home?.kind === 'volume') {
      volumeAdditions.push({ ...structure });
    }
  });
  // a value the user entered that the new type does not allow goes in either case
  if (node && conflict.kind === 'TYPE') {
    conflict.metadata.filter(m => m.key.startsWith('field:')).forEach(m => delete node.start.values[m.type]);
  }
  if (conflict.kind === 'EXPLICIT' || action === 'REMOVE_ALL') {
    if (node) {
      node.start.hidden = { structures: [], metadata: [] };
    }
  } else if (action === 'KEEP_ALLOWED') {
    node.start.hidden.structures = node.start.hidden.structures.filter(s => !keys.has(s.key));
    node.start.hidden.metadata = node.start.hidden.metadata.filter(m => !keys.has(m.key));
  } else if (action === 'SHORTEN') {
    node.start.hidden.structures = node.start.hidden.structures.flatMap(s => {
      if (!keys.has(s.key)) {
        return [s];
      }
      if (s.lastPage < node.first || s.firstPage > node.last) {
        return [];
      }
      return [{ ...s, firstPage: Math.max(s.firstPage, node.first), lastPage: Math.min(s.lastPage, node.last) }];
    });
  } else if (action === 'REHOME') {
    if (node) {
      const moving = node.start.hidden.structures.filter(s => keys.has(s.key));
      node.start.hidden.structures = node.start.hidden.structures.filter(s => !keys.has(s.key));
      moveToHome(moving);
    } else {
      moveToHome(conflict.structures);
    }
  }
  return { volumeAdditions };
}

export function upsertOperation(operations, blockId, kind, action) {
  return [...operations.filter(o => !(o.blockId === blockId && o.kind === kind)), { blockId, kind, action }];
}

export function commonOptions(conflicts) {
  if (!conflicts.length) {
    return [];
  }
  return conflicts[0].options.filter(option => conflicts.every(c => c.options.includes(option)));
}
