// Pagination streams and rule values, pure functions on the page list; rules mirror the pagination v2 design (Streams, Rule value of a page)
// and the per-block pagination design (a strategy per node decides its stream and rule).
import { buildTree, clonePages } from './blocks.mjs';
import { normalizeLabel, isCounting, nextLabel } from './labels.mjs';
import { defaultResolver, detectStrategies, nodeKey, ownersOf, ruleOf, typeRule } from './strategies.mjs';

/** Per streams result: the stream, the part and the positions in part and stream of every page, so valueIn does not scan. */
const positions = new WeakMap();

/**
 * Which pages count together, by the strategy strategyOf(nodeKey) of every node (default: defaultResolver). rule:X and hand open a
 * stream (hand without rule, its labels stay); continue:parent joins the stream of the parent, continue:sibling that of the nearest
 * earlier sibling of its type, continue:previous that of the nearest earlier top-level block that counts (a rule with a counting value,
 * continue:previous, or hand with a counting label); without one they open their own stream. A continuing node takes the rule of its
 * type, else 1: the stream gives the count, the rule only its leading uncounted values. Loose runs form one stream each. Every stream
 * lists its parts in the order of their first page, one per node (node key, block = first page of its top-level block) or loose run
 * (node null, block -1); block and rule of the stream are those of its first part. byPage[i] is the key of the stream of page i; list
 * is ordered by the first page of the streams.
 */
export function streams(pages, settings, strategyOf) {
  const tree = buildTree(pages);
  const resolve = strategyOf ?? defaultResolver(tree, settings);
  const streamOf = new Map(); // node → stream id
  const ruleAt = new Map(); // node → rule of its part
  const blockOf = new Map(); // node → first page of its top-level block
  const owner = new Array(pages.length).fill(null); // the deepest node of every page
  let next = 0;
  let previous = null; // stream of the last top-level block that continue:previous follows
  const walk = (siblings, root) => {
    const lastOfType = new Map();
    for (const node of siblings) {
      const id = resolve(nodeKey(node)) ?? 'hand'; // a node the resolver does not know keeps its labels
      let stream = null;
      let rule = null;
      if (ruleOf(id)) {
        rule = ruleOf(id);
      } else if (id.startsWith('continue:')) {
        rule = typeRule(settings, node.start.type) ?? ['1'];
        stream = {
          'continue:parent': node.parent && streamOf.get(node.parent),
          'continue:sibling': lastOfType.has(node.start.type) ? streamOf.get(lastOfType.get(node.start.type)) : null,
          'continue:previous': node.level === 0 ? previous : null,
        }[id] ?? null;
      }
      streamOf.set(node, stream ?? next++);
      ruleAt.set(node, rule);
      blockOf.set(node, (root ?? node).first);
      lastOfType.set(node.start.type, node);
      for (let i = node.first; i <= node.last; i++) {
        owner[i] = node; // parents before children: the deepest block wins
      }
      walk(node.children, root ?? node);
      if (node.level === 0 && counts(node, id)) {
        previous = streamOf.get(node);
      }
    }
  };
  const counts = (node, id) => id === 'continue:previous' || (ruleOf(id) ?? []).some(value => isCounting(normalizeLabel(value)))
    || (id === 'hand' && pages.slice(node.first, node.last + 1)
      .some((page, k) => streamOf.get(owner[node.first + k]) === streamOf.get(node) && isCounting(page.label)));
  walk(tree.roots, null);

  const loose = settings.withoutBlock?.length ? settings.withoutBlock : null;
  const groups = new Map();
  const partAt = new Array(pages.length);
  const inPart = new Array(pages.length);
  const inStream = new Array(pages.length);
  let run = null;
  pages.forEach((page, i) => {
    const node = owner[i];
    let id;
    let info;
    if (node) {
      id = streamOf.get(node);
      info = { block: blockOf.get(node), node: nodeKey(node), rule: ruleAt.get(node) };
      run = null;
    } else {
      run = run ?? i;
      id = `loose:${run}`;
      info = { block: -1, node: null, rule: loose };
    }
    if (!groups.has(id)) {
      groups.set(id, { pages: [], parts: [], byNode: new Map() });
    }
    const group = groups.get(id);
    let part = group.byNode.get(info.node);
    if (!part) {
      part = { ...info, pages: [] };
      group.parts.push(part);
      group.byNode.set(info.node, part);
    }
    partAt[i] = part;
    inPart[i] = part.pages.push(i) - 1;
    inStream[i] = group.pages.push(i) - 1;
  });
  const list = [...groups.values()].map(g => {
    const { block, rule } = g.parts[0];
    return { key: `${block}:${g.pages[0]}`, pages: g.pages, rule, block, parts: g.parts };
  });
  list.sort((a, b) => a.pages[0] - b.pages[0]);
  const byPage = new Array(pages.length);
  const streamAt = new Array(pages.length);
  list.forEach(s => s.pages.forEach(i => {
    byPage[i] = s.key;
    streamAt[i] = s;
  }));
  const index = { streamAt, partAt, inPart, inStream };
  list.forEach(s => positions.set(s, index));
  return { byPage, list };
}

/** The part of page index in stream; stream must come from streams(), which indexes its pages. */
export const partOf = (stream, index) => {
  const { streamAt, partAt } = positions.get(stream);
  return streamAt[index] === stream ? partAt[index] : undefined;
};

/**
 * The value for page index by the rule of its part: the n-th beginsWith value (n counted in the stream for the first part of the stream,
 * else in the part, where only uncounted values apply), else the next value after the last counting label before it in the stream, else
 * the first counting rule value, else –. stream must come from streams(), which indexes its pages.
 */
export function valueIn(pages, stream, index) {
  const part = partOf(stream, index);
  if (!part?.rule) {
    return null;
  }
  const { inPart, inStream } = positions.get(stream);
  const first = part === stream.parts[0];
  const position = first ? inStream[index] : inPart[index];
  if (position < part.rule.length && (first || !isCounting(normalizeLabel(part.rule[position])))) {
    return normalizeLabel(part.rule[position]);
  }
  for (let k = inStream[index] - 1; k >= 0; k--) {
    const label = pages[stream.pages[k]].label;
    if (isCounting(label)) {
      return nextLabel(label);
    }
  }
  const counting = part.rule.map(normalizeLabel).find(isCounting);
  return counting ?? '–';
}

export function ruleValue(pages, settings, index, strategyOf) {
  const result = streams(pages, settings, strategyOf);
  return valueIn(pages, result.list.find(s => s.key === result.byPage[index]), index);
}

/** New page list, every page of the parts covered(stream, part) accepts gets the rule value of its stream; parts without a rule keep their labels. */
export function paginateParts(pages, settings, covered, strategyOf) {
  const out = clonePages(pages);
  for (const stream of streams(out, settings, strategyOf).list) {
    const paginated = new Set(stream.parts.filter(part => part.rule && covered(stream, part)));
    for (const i of stream.pages) { // in page order: a page counts on from the pages of other parts before it
      if (paginated.has(partOf(stream, i))) {
        out[i].label = valueIn(out, stream, i);
      }
    }
  }
  return out;
}

/** New page list, every page of the top-level block starting on page first gets the rule value of its stream; parts without a rule keep their labels. */
export const paginateBlock = (pages, settings, first, strategyOf) => paginateParts(pages, settings, (stream, part) => part.block === first, strategyOf);

/**
 * The strategies under which offers are accepted, by node key: the nodes of the offered pages get their default strategy, every other node
 * keeps its strategy in strategies (default: detected from the labels).
 */
export function offeredStrategies(pages, settings, offers, strategies) {
  const tree = buildTree(pages);
  const defaults = defaultResolver(tree, settings);
  const owner = ownersOf(tree, pages.length);
  const next = new Map(strategies ?? detectStrategies(pages, settings, new Map()));
  offers.forEach(offer => offer.pages.forEach(i => owner[i] && next.set(nodeKey(owner[i]), defaults(nodeKey(owner[i])))));
  return next;
}

/**
 * New page list with the offered pages relabelled: the offered top-level blocks are relabelled by offeredStrategies; only the offered pages
 * take the new labels.
 */
export const applyOffers = (pages, settings, offers, strategies) => relabelOffers(pages, settings, offers, offeredStrategies(pages, settings, offers, strategies));

/** applyOffers with the strategies offeredStrategies gave (next, by node key). */
export function relabelOffers(pages, settings, offers, next) {
  const blocks = new Set(offers.map(offer => offer.first));
  const fresh = paginateParts(pages, settings, (stream, part) => blocks.has(part.block), key => next.get(key) ?? 'hand');
  const out = clonePages(pages);
  offers.forEach(offer => offer.pages.forEach(i => { out[i].label = fresh[i].label; }));
  return out;
}

export function initLabels(pages) {
  for (const page of pages) {
    page.label = normalizeLabel(page.label ?? '') || '–'; // an empty label is uncounted, there is no third state
    page.metsLabel = page.label;
  }
}
