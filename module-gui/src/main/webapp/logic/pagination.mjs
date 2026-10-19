// Pagination streams and rule values, pure functions on the page list; rules mirror the pagination v2 design (Streams, Rule value of a page).
import { buildTree, flatten, clonePages } from './blocks.mjs';
import { normalizeLabel, isCounting, nextLabel, follows } from './labels.mjs';

const ruleOfType = (settings, type) => (type && settings.rules?.[type]?.beginsWith) || null;

/**
 * Which pages count together. Level-0 blocks open their own stream, a child only with a rule of its type (otherwise it stays in
 * the stream of its parent); with continueInParent the children of one type in one parent share a stream; loose runs form one each.
 * byPage[i] is the key of the stream of page i; list is ordered by the first page of the streams.
 */
export function streams(pages, settings) {
  const tree = buildTree(pages);
  const nodes = flatten(tree.roots);
  const streamOf = new Map(); // node → { id, rule, block }
  for (const node of nodes) {
    const rule = ruleOfType(settings, node.start.type);
    const block = node.level === 0 ? node.first : streamOf.get(node.parent).block;
    if (node.level === 0 || rule) {
      const joined = node.level > 0 && settings.rules[node.start.type].continueInParent;
      const id = joined ? `${streamOf.get(node.parent).id}/${node.parent.first}.${node.start.type}` : `${block}:${node.first}:${node.level}`;
      streamOf.set(node, { id, rule, block });
    } else {
      streamOf.set(node, streamOf.get(node.parent));
    }
  }
  const owner = new Array(pages.length).fill(null);
  for (const node of nodes) { // parents before children: the deepest block wins
    for (let i = node.first; i <= node.last; i++) {
      owner[i] = streamOf.get(node);
    }
  }
  const loose = settings.withoutBlock?.length ? settings.withoutBlock : null;
  const groups = new Map();
  let run = null;
  pages.forEach((page, i) => {
    let id;
    let info;
    if (owner[i]) {
      id = owner[i].id;
      info = owner[i];
      run = null;
    } else {
      run = run ?? i;
      id = `loose:${run}`;
      info = { rule: loose, block: -1 };
    }
    if (!groups.has(id)) {
      groups.set(id, { id, pages: [], rule: info.rule, block: info.block });
    }
    groups.get(id).pages.push(i);
  });
  const list = [...groups.values()].map(g => ({ key: `${g.block}:${g.pages[0]}`, pages: g.pages, rule: g.rule, block: g.block }));
  list.sort((a, b) => a.pages[0] - b.pages[0]);
  const byPage = new Array(pages.length);
  list.forEach(s => s.pages.forEach(i => { byPage[i] = s.key; }));
  return { byPage, list };
}

/** The value for page index by the rule of its stream: the n-th beginsWith value, else the next value after the last counting label before it, else the first counting rule value, else –. */
function valueIn(pages, stream, index) {
  if (!stream.rule) {
    return null;
  }
  const before = stream.pages.filter(i => i < index);
  if (before.length < stream.rule.length) {
    return normalizeLabel(stream.rule[before.length]);
  }
  for (let k = before.length - 1; k >= 0; k--) {
    const label = pages[before[k]].label;
    if (isCounting(label)) {
      return nextLabel(label);
    }
  }
  const first = stream.rule.map(normalizeLabel).find(isCounting);
  return first ?? '–';
}

export function ruleValue(pages, settings, index) {
  const result = streams(pages, settings);
  return valueIn(pages, result.list.find(s => s.pages.includes(index)), index);
}

/** New page list, every page of the block starting on page first gets the rule value of its stream; streams without a rule keep their labels. */
export function paginateBlock(pages, settings, first) {
  const out = clonePages(pages);
  for (const stream of streams(out, settings).list) {
    if (stream.block !== first || !stream.rule) {
      continue;
    }
    for (const i of stream.pages) {
      out[i].label = valueIn(out, stream, i);
    }
  }
  return out;
}

/** Indices of the labelled pages that paginateBlock would change in the block starting on page first. */
export function blockOffer(pages, settings, first) {
  const paginated = paginateBlock(pages, settings, first);
  return pages.map((page, i) => i).filter(i => pages[i].label !== '' && paginated[i].label !== pages[i].label);
}

const sameRule = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Per page: whether it changed stream (block, rule, or its predecessor in the stream is not in its stream any more), whether only the rule changed, and whether it really joined another block or rule. */
function movedPages(before, after, settings) {
  const streamsOf = list => {
    const byPage = new Array(list.length);
    streams(list, settings).list.forEach(s => s.pages.forEach(i => { byPage[i] = s; }));
    return byPage;
  };
  const was = streamsOf(before);
  const now = streamsOf(after);
  return after.map((page, i) => {
    const old = was[i];
    if (!old) {
      return { moved: true, onlyRule: false, strong: true };
    }
    const predecessor = old.pages[old.pages.indexOf(i) - 1];
    const newPredecessor = now[i].pages[now[i].pages.indexOf(i) - 1];
    const ruleChanged = !sameRule(old.rule, now[i].rule);
    const blockChanged = old.block !== now[i].block;
    const otherChanged = blockChanged
      || (predecessor === undefined ? newPredecessor !== undefined : !now[i].pages.includes(predecessor));
    // strong: the page really joined another block or rule; weak: only its predecessor in the stream left
    return { moved: ruleChanged || otherChanged, onlyRule: ruleChanged && !otherChanged, strong: ruleChanged || blockChanged };
  });
}

/**
 * Paginates only what a structure change needs. In every stream the first page of a run of moved pages gets its rule value and
 * the pages after it count on as long as their old labels formed a sequence; the first page after a run gets the continuation
 * of its stream. Pages of a stream without counting rule value (–) all get that value. Offers: typed blocks of the moved pages
 * and, unless only types changed, the block before the first moved page, where the rules would change a labelled page.
 */
export function structureChanged(before, after, settings) {
  if (settings.automatic === false) {
    return { pages: after, changed: [], offers: [] };
  }
  const out = clonePages(after);
  const old = out.map(page => page.label);
  const flags = movedPages(before, after, settings);
  const result = streams(out, settings);
  for (const stream of result.list) {
    if (!stream.rule) {
      continue;
    }
    let flowing = false;
    let previousOld = null;
    stream.pages.forEach((i, k) => {
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
      } else if (moved && (k < stream.rule.length || !isCounting(valueIn(out, stream, i)))) {
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
    result.list.forEach(s => s.pages.forEach(i => { owner[i] = s.block; }));
    movedIndexes.forEach(i => owner[i] >= 0 && blocks.add(owner[i]));
    const first = movedIndexes[0];
    if (first > 0 && owner[first - 1] >= 0 && !movedIndexes.every(i => flags[i].onlyRule)) {
      blocks.add(owner[first - 1]);
    }
  }
  const offers = [...blocks].sort((a, b) => a - b)
    .map(first => ({ first, pages: blockOffer(out, settings, first) }))
    .filter(offer => offer.pages.length);
  return { pages: out, changed, offers };
}

export function initLabels(pages) {
  for (const page of pages) {
    page.label = normalizeLabel(page.label ?? '');
    page.metsLabel = page.label;
  }
}
