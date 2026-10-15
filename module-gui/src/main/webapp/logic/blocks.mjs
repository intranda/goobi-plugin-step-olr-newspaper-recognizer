// Pure operations on the page list in the transfer format (NewspaperPage / BlockStart on the Java side).
// A page with k starts and depth d opens blocks on the levels d-k … d-1; rules mirror BlockTree.java and BlockValidator.java.
import { parseByPattern, formatByPattern, toIso, fromIso } from './dates.mjs';
import { fieldStates, userValuesLeftBehind } from './fields.mjs';

export const ANALYSIS_THRESHOLD = -0.8;

export function newStart(type = null) {
  return {
    id: null, type, date: null, dateRaw: null, dateInput: '', prefix: null, number: null, suffix: null,
    hidden: { structures: [], metadata: [] }, values: {}, originalType: null,
  };
}

function cloneHidden(hidden) {
  return { structures: (hidden?.structures || []).map(s => ({ ...s })), metadata: (hidden?.metadata || []).map(m => ({ ...m })) };
}

export function clonePages(pages) {
  return pages.map(page => ({
    ...page,
    depth: page.depth || 0,
    starts: (page.starts || []).map(s => ({ ...s, hidden: cloneHidden(s.hidden), values: { ...(s.values || {}) } })),
  }));
}

export function validatePages(pages) {
  let open = 0;
  for (let i = 0; i < pages.length; i++) {
    const depth = pages[i].depth || 0;
    const count = (pages[i].starts || []).length;
    if (depth < 0 || count > depth) {
      return { page: i, reason: 'TOO_MANY_STARTS' };
    }
    if (depth - count > open) {
      return { page: i, reason: 'DEPTH_EXCEEDS' };
    }
    open = depth;
  }
  return null;
}

export function buildTree(pages) {
  const invalid = validatePages(pages);
  if (invalid) {
    throw new Error(`Invalid page data at page ${invalid.page + 1}: ${invalid.reason}`);
  }
  const roots = [];
  const loose = [];
  const open = [];
  pages.forEach((page, i) => {
    const depth = page.depth || 0;
    const starts = page.starts || [];
    while (open.length > depth - starts.length) {
      open.pop().last = i - 1;
    }
    for (const start of starts) {
      const parent = open[open.length - 1] || null;
      const node = { start, level: open.length, first: i, last: i, parent, children: [] };
      (parent ? parent.children : roots).push(node);
      open.push(node);
    }
    if (depth === 0) {
      loose.push(i);
    }
  });
  while (open.length) {
    open.pop().last = pages.length - 1;
  }
  return { roots, loose };
}

export function flatten(roots) {
  const result = [];
  const walk = nodes => nodes.forEach(node => { result.push(node); walk(node.children); });
  walk(roots);
  return result;
}

export const refOf = node => ({ page: node.first, level: node.level });

export function nodeAt(tree, ref) {
  return flatten(tree.roots).find(n => n.first === ref.page && n.level === ref.level) || null;
}

export function siblingsFrom(tree, ref) {
  const node = nodeAt(tree, ref);
  if (!node) {
    return [];
  }
  const siblings = node.parent ? node.parent.children : tree.roots;
  return siblings.slice(siblings.indexOf(node));
}

const hasLevelZeroStart = page => page.starts.length > 0 && page.depth === page.starts.length;

/** Click: add or remove a level-0 block starting on the page. */
export function toggleBlock(pages, index) {
  const out = clonePages(pages);
  const page = out[index];
  if (hasLevelZeroStart(page)) {
    page.starts.shift();
    const previousDepth = index > 0 ? out[index - 1].depth : 0;
    if (previousDepth === 0) {
      // no block before: the pages of the removed block (with its child blocks) are without structure now
      for (let i = index; i < out.length; i++) {
        if (i > index && (hasLevelZeroStart(out[i]) || out[i].depth === 0)) {
          break;
        }
        out[i].starts = [];
        out[i].depth = 0;
      }
    }
    return out;
  }
  if (page.depth === 0) {
    page.starts = [newStart()];
    page.depth = 1;
    for (let i = index + 1; i < out.length && out[i].depth === 0 && out[i].starts.length === 0; i++) {
      out[i].depth = 1;
    }
    return out;
  }
  if (page.starts.length === 0 && page.depth >= 2) {
    // inside a child block: the child ends before this page
    page.depth = 1;
    for (let i = index + 1; i < out.length && out[i].starts.length === 0 && out[i].depth >= 2; i++) {
      out[i].depth = 1;
    }
  }
  page.starts.unshift(newStart());
  return out;
}

/** Ctrl/Alt-click: add or remove a level-1 block (child block) starting on the page. */
export function toggleChild(pages, index) {
  const out = clonePages(pages);
  const page = out[index];
  const count = page.starts.length;
  const depth = page.depth;
  if (depth === 0) {
    return out;
  }
  const childStart = 1 - (depth - count); // index of a level-1 start in page.starts
  if (depth >= 2 && childStart >= 0 && childStart < count) {
    page.starts.splice(childStart, 1);
    page.depth = 1;
    for (let i = index + 1; i < out.length && out[i].starts.length === 0 && out[i].depth >= 2; i++) {
      out[i].depth = 1;
    }
    return out;
  }
  if (depth >= 2) {
    page.starts.push(newStart());
    return out;
  }
  if (count === 0 && index > 0 && out[index - 1].depth >= 2) {
    page.depth = 2;
    return out;
  }
  page.starts.push(newStart());
  page.depth = 2;
  return out;
}

/** Changes the type of a tree node in place (the node's start belongs to the page list the tree was built from). */
export function applyType(node, type, catalog) {
  const start = node.start;
  start.type = type;
  if (!type) {
    return;
  }
  const info = catalog[type] || {};
  if (!info.dated) {
    Object.assign(start, { date: null, dateRaw: null, dateInput: '' });
  }
  if (!info.numbered) {
    start.number = null;
  }
  if (!info.partNumbered) {
    Object.assign(start, { prefix: null, suffix: null });
  }
  for (const child of node.children) {
    if (child.start.type && !(info.children || []).includes(child.start.type)) {
      child.start.type = null;
    }
  }
}

export function setType(pages, ref, type, catalog) {
  const out = clonePages(pages);
  applyType(nodeAt(buildTree(out), ref), type, catalog);
  return out;
}

export function setDateInput(start, input, pattern) {
  const parsed = parseByPattern(input, pattern);
  start.dateInput = input;
  start.date = parsed ? toIso(parsed) : null;
  start.dateRaw = input && !parsed ? input : null;
}

export function syncDateInputs(pages, pattern) {
  for (const page of pages) {
    for (const start of page.starts || []) {
      const date = fromIso(start.date);
      start.dateInput = date ? formatByPattern(date, pattern) : start.dateRaw || '';
    }
  }
}

export function initStarts(pages, pattern) {
  for (const page of pages) {
    page.depth = page.depth || 0;
    page.starts = page.starts || [];
    for (const start of page.starts) {
      start.hidden = start.hidden || { structures: [], metadata: [] };
      start.values = start.values || {};
      start.originalType = start.id ? start.type : null;
    }
  }
  syncDateInputs(pages, pattern);
}

export function validateBlocks(pages, catalog, volumeType, preventDuplicates) {
  const result = { missingType: [], notAllowed: [], invalidDate: [], missingRequired: [], duplicates: [] };
  const visit = (siblings, parentType) => {
    const groups = new Map();
    for (const node of siblings) {
      const start = node.start;
      const ref = refOf(node);
      const info = start.type ? catalog[start.type] || {} : null;
      if (!info) {
        result.missingType.push(ref);
      } else {
        if (parentType && !(catalog[parentType]?.children || []).includes(start.type)) {
          result.notAllowed.push(ref);
        }
        if (info.dated && start.dateRaw) {
          result.invalidDate.push(ref);
        } else if (info.dated && info.dateRequired && !start.date) {
          result.missingRequired.push(ref);
        }
        if (info.numbered && info.numberRequired && !(start.number || '').trim()) {
          result.missingRequired.push(ref);
        }
        if (fieldStates(node, catalog).some(field => field.required && !String(field.value).trim())) {
          result.missingRequired.push(ref);
        }
        const date = start.date || '';
        const number = (start.number || '').trim();
        if (preventDuplicates && (date || number)) {
          const key = `${start.type}|${date}|${number}`;
          groups.set(key, [...(groups.get(key) || []), ref]);
        }
      }
      visit(node.children, start.type);
    }
    for (const refs of groups.values()) {
      if (refs.length > 1) {
        result.duplicates.push(...refs);
      }
    }
  };
  visit(buildTree(pages).roots, volumeType);
  result.valid = Object.values(result).every(list => list.length === 0);
  return result;
}

export function removeAllBlocks(pages) {
  const out = clonePages(pages).map(page => ({ ...page, depth: 1, starts: [] }));
  if (out.length) {
    out[0].starts = [newStart()];
  }
  return out;
}

export function resetToAnalysis(pages) {
  return clonePages(pages).map((page, i) => ({
    ...page,
    depth: 1,
    starts: i === 0 || page.result < ANALYSIS_THRESHOLD ? [newStart()] : [],
  }));
}

/** Hidden structure ranges after the page at {@code index} was removed. Structures left without pages get -1. */
export function shiftStructures(structures, index) {
  for (const structure of structures) {
    if (structure.firstPage < 0) {
      continue;
    }
    if (structure.firstPage > index) {
      structure.firstPage--;
    }
    if (structure.lastPage >= index) {
      structure.lastPage--;
    }
    if (structure.lastPage < structure.firstPage) {
      structure.firstPage = -1;
      structure.lastPage = -1;
    }
  }
}

export function removePage(pages, index) {
  const out = clonePages(pages);
  const [removed] = out.splice(index, 1);
  const next = out[index];
  if (removed.starts.length && next && next.starts.length === 0 && next.depth === removed.depth) {
    next.starts = removed.starts;
  }
  // pages may now be deeper than their enclosing blocks: they continue in the blocks that are still open
  let open = 0;
  for (const page of out) {
    if (page.depth - page.starts.length > open) {
      page.depth = open + page.starts.length;
    }
    open = page.depth;
  }
  out.forEach(page => page.starts.forEach(start => shiftStructures(start.hidden.structures, index)));
  return out;
}

/** With the catalog, every start sends the value shown for each visible field of its type (BlockStart.values). */
export function toSaveRequest(pages, operations, catalog = null) {
  const nodes = catalog ? new Map(flatten(buildTree(pages).roots).map(node => [node.start, node])) : null;
  const values = start => Object.fromEntries([
    ...fieldStates(nodes.get(start), catalog).map(field => [field.key, field.value]),
    ...userValuesLeftBehind(start, catalog).map(({ field, value }) => [field.key, value]),
  ]);
  return JSON.stringify({
    pages: pages.map(page => ({
      filename: page.filename,
      depth: page.depth || 0,
      starts: (page.starts || []).map(s => ({
        id: s.id || null, type: s.type || null, date: s.date || null, dateRaw: s.dateRaw || null,
        prefix: s.prefix || null, number: s.number || null, suffix: s.suffix || null,
        ...(catalog ? { values: values(s) } : {}),
      })),
    })),
    operations,
  });
}
