// Pagination streams and rule values, pure functions on the page list; rules mirror the pagination v2 design (Streams, Rule value of a page)
// and the per-block pagination design (a strategy per node decides its stream and rule).
import { buildTree, clonePages } from './blocks.mjs';
import { normalizeLabel, isCounting, nextLabel, follows } from './labels.mjs';
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

/** Indices of the pages that paginateBlock would change in the block starting on page first. */
export function blockOffer(pages, settings, first) {
  const paginated = paginateBlock(pages, settings, first);
  return pages.map((page, i) => i).filter(i => paginated[i].label !== pages[i].label);
}

const sameRule = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Per page: whether it changed stream (block, rule, or its predecessor in the stream is not in its stream any more), whether only the rule changed,
 * and whether it really joined another block or rule. Pages are matched by file name, so a page added in between leaves the others in place.
 */
function movedPages(before, after, settings) {
  const partsOf = list => {
    const byPage = new Array(list.length);
    streams(list, settings).list.forEach(stream => stream.parts.forEach(part => part.pages.forEach(i => { byPage[i] = { stream, part }; })));
    return byPage;
  };
  const was = partsOf(before);
  const now = partsOf(after);
  const id = (page, i) => page.filename ?? i;
  const oldIndex = new Map(before.map((page, i) => [id(page, i), i]));
  const newIndex = new Map(after.map((page, i) => [id(page, i), i]));
  // file names are unique within a process, so they identify a page across the change
  const toNew = i => (i < 0 ? i : newIndex.get(id(before[i], i)));
  return after.map((page, i) => {
    const j = oldIndex.get(id(page, i));
    if (j === undefined) {
      return { moved: true, onlyRule: false, strong: true };
    }
    const old = was[j];
    const { stream, part } = now[i];
    const predecessor = old.stream.pages[old.stream.pages.indexOf(j) - 1];
    const newPredecessor = stream.pages[stream.pages.indexOf(i) - 1];
    const ruleChanged = !sameRule(old.part.rule, part.rule);
    const blockChanged = toNew(old.part.block) !== part.block;
    const otherChanged = blockChanged
      || (predecessor === undefined ? newPredecessor !== undefined : !stream.pages.includes(toNew(predecessor)));
    // strong: the page really joined another block or rule; weak: only its predecessor in the stream left
    return { moved: ruleChanged || otherChanged, onlyRule: ruleChanged && !otherChanged, strong: ruleChanged || blockChanged };
  });
}

/**
 * Paginates only what a structure change needs. In every part of a stream with moved pages the first page of a run of moved pages gets its
 * rule value and the pages after it count on as long as their old labels formed a sequence; the first page after a run gets the continuation
 * of its stream. Pages without counting rule value (–) all get that value. Parts without moved pages stay as they are, so when counting
 * through the volume the count stops at the end of the changed blocks. Offers: typed blocks of the moved pages and, unless only types
 * changed, the block before the first moved page, where the rules would change a labelled page. When counting through the volume
 * offerFrom is the first of these blocks, else the first block with a rule after the first moved page, and the offers are the
 * volumeOffers from there, so every block from the first that no longer fits is offered against one consistent count.
 */
export function structureChanged(before, after, settings) {
  if (settings.automatic === false) {
    return { pages: after, changed: [], offers: [], offerFrom: null };
  }
  const out = clonePages(after);
  const old = out.map(page => page.label);
  const flags = movedPages(before, after, settings);
  const result = streams(out, settings);
  for (const stream of result.list) {
    // by top-level block, as before parts per node: a child that continues its parent counts with it
    const touched = new Set(stream.parts.filter(part => part.rule && part.pages.some(i => flags[i].moved)).map(part => part.block));
    const inBlock = new Map();
    const seen = new Map();
    stream.pages.forEach(i => {
      const block = partOf(stream, i).block;
      inBlock.set(i, seen.get(block) ?? 0);
      seen.set(block, inBlock.get(i) + 1);
    });
    let flowing = false;
    let previousOld = null;
    stream.pages.forEach((i, k) => {
      const part = partOf(stream, i);
      if (!part.rule || !touched.has(part.block)) {
        flowing = false;
        return;
      }
      const moved = flags[i].moved;
      const previousMoved = k > 0 && flags[stream.pages[k - 1]].moved;
      const previousStrong = k > 0 && flags[stream.pages[k - 1]].strong;
      const set = () => {
        out[i].label = valueIn(out, stream, i);
        flowing = isCounting(out[i].label);
        previousOld = old[i];
      };
      if (moved ? !previousMoved : previousStrong) {
        set();
      } else if (moved && (inBlock.get(i) < part.rule.length || !isCounting(valueIn(out, stream, i)))) {
        set();
      } else if (flowing && follows(previousOld, old[i])) {
        out[i].label = valueIn(out, stream, i);
        previousOld = old[i];
      } else {
        flowing = false;
      }
    });
  }
  const changed = out.map((page, i) => i).filter(i => out[i].label !== old[i]);
  const movedIndexes = flags.map((flag, i) => i).filter(i => flags[i].moved);
  const blocks = new Set();
  if (movedIndexes.length) {
    const owner = new Array(out.length);
    result.list.forEach(s => s.parts.forEach(part => part.pages.forEach(i => { owner[i] = part.block; })));
    movedIndexes.forEach(i => owner[i] >= 0 && blocks.add(owner[i]));
    const first = movedIndexes[0];
    if (first > 0 && owner[first - 1] >= 0 && !movedIndexes.every(i => flags[i].onlyRule)) {
      blocks.add(owner[first - 1]);
    }
  }
  const offers = [...blocks].sort((a, b) => a - b)
    .map(first => ({ first, pages: blockOffer(out, settings, first) }))
    .filter(offer => offer.pages.length);
  if (!settings.countThroughVolume) {
    return { pages: out, changed, offers, offerFrom: null };
  }
  // the blocks counted through the volume: the top-level parts of the streams that run over more than one top-level block
  const later = movedIndexes.length ? result.list.filter(stream => stream.parts.some(part => part.block !== stream.block))
    .flatMap(stream => stream.parts).filter(part => part.block > movedIndexes[0]).sort((a, b) => a.block - b.block)[0] : undefined;
  const offerFrom = offers.length ? offers[0].first : later?.block ?? null;
  return { pages: out, changed, offers: offerFrom === null ? [] : volumeOffers(out, settings, offerFrom), offerFrom };
}

/** The volume count from the block starting on page from to the end: every block from there on with the rules applied. */
const countFrom = (pages, settings, from) => paginateParts(pages, settings, (stream, part) => part.block >= from);

/**
 * Offers when counting through the volume: one per block starting on or after page from whose labelled pages differ from the volume count
 * from there, as if all earlier offers were accepted; pages are the labelled pages that would change.
 */
export const volumeOffers = (pages, settings, from) => offersAgainst(pages, settings, from, countFrom(pages, settings, from));

/** The volumeOffers of pages against target, the volume count from page from. */
function offersAgainst(pages, settings, from, target) {
  const byBlock = new Map();
  for (const stream of streams(pages, settings).list) {
    for (const part of stream.parts.filter(p => p.block >= from)) {
      const differ = part.pages.filter(i => target[i].label !== pages[i].label);
      byBlock.set(part.block, [...(byBlock.get(part.block) ?? []), ...differ]);
    }
  }
  return [...byBlock.entries()].sort((a, b) => a[0] - b[0])
    .map(([first, list]) => ({ first, pages: list.sort((a, b) => a - b) }))
    .filter(offer => offer.pages.length);
}

/**
 * New page list with the offered pages relabelled: the nodes of the offered pages get their default strategy, every other node keeps its
 * strategy in strategies (by node key; default: detected from the labels), and the offered top-level blocks are relabelled; only the
 * offered pages take the new labels. A number instead of strategies is the page an offer counted through the volume starts from
 * (structureChanged, until the app passes strategies).
 */
export function applyOffers(pages, settings, offers, strategies) {
  if (typeof strategies === 'number') {
    return applyVolumeOffers(pages, settings, offers, strategies);
  }
  const tree = buildTree(pages);
  const defaults = defaultResolver(tree, settings);
  const owner = ownersOf(tree, pages.length);
  const next = new Map(strategies ?? detectStrategies(pages, settings, new Map()));
  offers.forEach(offer => offer.pages.forEach(i => owner[i] && next.set(nodeKey(owner[i]), defaults(nodeKey(owner[i])))));
  const blocks = new Set(offers.map(offer => offer.first));
  const fresh = paginateParts(pages, settings, (stream, part) => blocks.has(part.block), key => next.get(key) ?? 'hand');
  const out = clonePages(pages);
  offers.forEach(offer => offer.pages.forEach(i => { out[i].label = fresh[i].label; }));
  return out;
}

/**
 * New page list with offers counted through the volume accepted: the volume count from page from repaints every block from there on and
 * reads only labels before it, which no offer touches, so it is the same before and after each offer, and so are the pages every later
 * offer would change. So one offer can be accepted before earlier ones, and all at once equals one by one.
 */
function applyVolumeOffers(pages, settings, offers, from) {
  const out = clonePages(pages);
  const target = countFrom(out, settings, from);
  const blocks = new Set(offers.map(offer => offer.first));
  offersAgainst(out, settings, from, target).filter(offer => blocks.has(offer.first))
    .forEach(offer => offer.pages.forEach(i => { out[i].label = target[i].label; }));
  return out;
}

export function initLabels(pages) {
  for (const page of pages) {
    page.label = normalizeLabel(page.label ?? '') || '–'; // an empty label is uncounted, there is no third state
    page.metsLabel = page.label;
  }
}
