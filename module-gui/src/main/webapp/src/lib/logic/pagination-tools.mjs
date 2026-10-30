// Volume-wide pagination tools, pure functions on the page list; behaviour as in the pagination v2 design (Changed since opening, Rules dialog).
import { buildTree, clonePages, flatten } from './blocks.mjs';
import { follows } from './labels.mjs';
import { paginateParts, relabelOffers, offeredStrategies } from './pagination.mjs';
import { defaultsIn, detectStrategies, relabelChain } from './strategies.mjs';

/** Indices of the pages whose label differs from the METS as last loaded. */
export function changedSinceOpening(pages) {
  return pages.map((page, i) => i).filter(i => pages[i].label !== pages[i].metsLabel);
}

export function restoreFromMets(pages) {
  return clonePages(pages).map(page => ({ ...page, label: page.metsLabel }));
}

/**
 * Whether a part of a stream is covered by the scope: none, block (the block starting on page scope.first), fromBlock (that block and all
 * after it), volume, offers (the blocks of scope.offers). simulateRules applies scope offers with acceptOffers; offers here is for the
 * callers that list the pages a scope covers, such as the preview of the rules dialog.
 */
export function inScope(scope) {
  return {
    none: () => false,
    block: (stream, part) => part.block === scope.first,
    fromBlock: (stream, part) => part.block >= scope.first,
    volume: () => true,
    offers: (stream, part) => scope.offers.some(offer => offer.first === part.block),
  }[scope.kind];
}

/**
 * The rules applied in the scope: none, block (the block starting on page first), fromBlock (that block and all after it), volume
 * (everything including pages without block), offers (the offered pages and the chains after them, as acceptOffers). The nodes of the
 * top-level blocks in scope get their default strategy under settings, where counting through the volume continues every block in scope
 * after the first; every other node keeps its strategy in strategies (by node key; default: detected from the labels). The blocks after the
 * scope that continue it follow it (relabelChain). Returns the new page list, the strategies applied, by node key, and the offers of the
 * chains (the hand blocks they stop at).
 */
export function simulateRules(pages, settings, scope, strategies) {
  if (scope.kind === 'none') {
    return { pages: clonePages(pages), strategies: new Map(), offers: [] };
  }
  const current = strategies ?? detectStrategies(pages, settings, new Map());
  if (scope.kind === 'offers') {
    return { ...acceptOffers(pages, settings, scope.offers, current), strategies: new Map() };
  }
  const roots = buildTree(pages).roots.filter(root => scope.kind === 'volume' || (scope.kind === 'block' ? root.first === scope.first : root.first >= scope.first));
  const applied = defaultsIn(roots, settings);
  const next = new Map([...current, ...applied]);
  const out = paginateParts(pages, settings, inScope(scope), key => next.get(key) ?? 'hand');
  const chained = roots.length ? relabelChain(out, settings, next, roots.at(-1).first) : { pages: out, offers: [] };
  return { ...chained, strategies: applied };
}

/**
 * New page list with the offers accepted (applyOffers), then the blocks after the offered ones that continue them relabelled (relabelChain)
 * with offeredStrategies; offers are the offers of these chains.
 */
export function acceptOffers(pages, settings, offers, strategies) {
  const next = offeredStrategies(pages, settings, offers, strategies);
  let out = relabelOffers(pages, settings, offers, next);
  const fresh = new Map();
  for (const first of [...new Set(offers.map(offer => offer.first))].sort((a, b) => a - b)) {
    const result = relabelChain(out, settings, next, first);
    out = result.pages;
    result.offers.forEach(offer => fresh.set(offer.first, offer));
  }
  return { pages: out, offers: [...fresh.values()].sort((a, b) => a.first - b.first) };
}

/**
 * Whether two pagination settings say the same: per type the values its pages begin with and whether a child continues in its parent (a
 * rule without values is no rule), the values of the pages without block, automatic and counting through the volume. The order of keys
 * does not matter.
 */
export function sameSettings(a, b) {
  const rules = settings => Object.fromEntries(Object.entries(settings.rules || {})
    .filter(([, rule]) => rule && (rule.beginsWith || []).length > 0)
    .map(([type, rule]) => [type, [JSON.stringify(rule.beginsWith), !!rule.continueInParent]]));
  const ra = rules(a);
  const rb = rules(b);
  const sameRules = Object.keys(ra).length === Object.keys(rb).length
    && Object.keys(ra).every(type => type in rb && ra[type][0] === rb[type][0] && ra[type][1] === rb[type][1]);
  return sameRules && JSON.stringify(a.withoutBlock || []) === JSON.stringify(b.withoutBlock || [])
    && (a.automatic !== false) === (b.automatic !== false) && !!a.countThroughVolume === !!b.countThroughVolume;
}

/**
 * The labels of a preview row: '' for none, one label as is, first–last when each label follows the one before, else up to four labels
 * one by one and more as first, second, …, last. It never shows a range that is not one.
 */
export function labelRange(labels) {
  if (labels.length <= 1) {
    return labels[0] ?? '';
  }
  if (labels.every((label, i) => i === 0 || follows(labels[i - 1], label))) {
    return `${labels[0]}–${labels[labels.length - 1]}`;
  }
  return labels.length <= 4 ? labels.join(', ') : `${labels[0]}, ${labels[1]}, …, ${labels[labels.length - 1]}`;
}

/**
 * The rows of the pagination preview: one group per block over the pages in indexes it owns itself (its deepest block), a block before its
 * child blocks (child is the position in the parent, 0 on level 0) and the blocks of a level-0 block before the next one; root is the first
 * page of that level-0 block. Pages without block form runs of level -1, which a page outside indexes ends (root is the run's first page).
 * before and after are the labels in pages and in simulated, changed the number of pages they differ on.
 */
export function previewGroups(pages, simulated, indexes) {
  const owners = new Array(pages.length).fill(null);
  const order = new Map();
  for (const root of buildTree(pages).roots) {
    for (const node of flatten([root])) {
      order.set(node, { root: root.first, rank: order.size });
      for (let i = node.first; i <= node.last; i++) {
        owners[i] = node;
      }
    }
  }
  const groups = [];
  const byNode = new Map();
  let run = null;
  for (const i of indexes) {
    const node = owners[i];
    let group = node ? byNode.get(node) : run && run.pages[run.pages.length - 1] === i - 1 ? run : null;
    if (!group) {
      group = { first: i, level: node ? node.level : -1, child: node && node.parent ? node.parent.children.indexOf(node) + 1 : 0,
        type: node ? node.start.type ?? null : null, root: node ? order.get(node).root : i, rank: node ? order.get(node).rank : -1,
        pages: [], before: [], after: [], changed: 0 };
      groups.push(group);
      if (node) {
        byNode.set(node, group);
      } else {
        run = group;
      }
    }
    const before = pages[i].label ?? '';
    const after = simulated[i].label ?? '';
    group.pages.push(i);
    group.before.push(before);
    group.after.push(after);
    group.changed += before === after ? 0 : 1;
  }
  return groups.sort((a, b) => a.root - b.root || a.rank - b.rank).map(({ rank, ...group }) => group);
}
