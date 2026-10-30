// Pagination strategies of the blocks (per-block pagination design, decisions 6–9): an id per node says how its pages are numbered.
// Ids: rule:<beginsWith values joined by one blank> (rule:1, rule:– 1), continue:previous, continue:parent, continue:sibling, hand.
import { buildTree, flatten, clonePages } from './blocks.mjs';
import { normalizeLabel, isCounting } from './labels.mjs';
import { streams, valueIn, paginateParts } from './pagination.mjs';

const RULE = 'rule:';

/** The beginsWith values of a rule id (rule:– 1 → ['–', '1']), null for every other strategy. */
export const ruleOf = id => (id?.startsWith(RULE) && id.length > RULE.length ? id.slice(RULE.length).split(' ') : null);

/** The id of the rule beginning with these values; - and the other spellings of uncounted become –. */
export const ruleId = beginsWith => RULE + beginsWith.map(normalizeLabel).join(' ');

/** The key of a node in resolvers and strategy maps: first page and level. */
export const nodeKey = node => `${node.first}:${node.level}`;

/** The beginsWith values configured for the type, null without a rule. */
export const typeRule = (settings, type) => {
  const values = (type && settings.rules?.[type]?.beginsWith) || null;
  return values?.length ? values : null;
};

/** earlier: for a top-level node whether a top-level block comes before it, for a nested one whether an earlier sibling has its type. */
function strategyFor(node, settings, earlier) {
  const type = node.start.type;
  if (!type) {
    return 'hand';
  }
  const rule = typeRule(settings, type);
  if (node.level === 0) {
    if (settings.countThroughVolume && earlier && rule?.some(value => isCounting(normalizeLabel(value)))) {
      return 'continue:previous';
    }
    return rule ? ruleId(rule) : ruleId(['–']);
  }
  if (rule && settings.rules[type].continueInParent && earlier) {
    return 'continue:sibling';
  }
  return rule ? ruleId(rule) : 'continue:parent';
}

const siblingsOf = (tree, node) => (node.parent ? node.parent.children : tree.roots);

/**
 * The default strategies of the given top-level nodes and their subtrees by node key, the strategy a node gets from the settings: untyped
 * hand; top-level the rule of its type, else rule:–, and when counting through the volume continue:previous after the first node in roots
 * if the rule counts; nested the rule of its type (continue:sibling after an earlier sibling of its type with continueInParent), else
 * continue:parent.
 */
export function defaultsIn(roots, settings) {
  const byKey = new Map();
  const walk = siblings => {
    const types = new Set();
    siblings.forEach((node, index) => {
      byKey.set(nodeKey(node), strategyFor(node, settings, node.level === 0 ? index > 0 : types.has(node.start.type)));
      types.add(node.start.type);
      walk(node.children);
    });
  };
  walk(roots);
  return byKey;
}

/** The default strategy (defaultsIn) of every node of the tree by node key; an unknown key is hand. */
export function defaultResolver(tree, settings) {
  const byKey = defaultsIn(tree.roots, settings);
  return key => byKey.get(key) ?? 'hand';
}

const PRESETS = [['1'], ['i'], ['I'], ['[1]'], ['–', '1'], ['–']];

/** The rule entries of the dropdown: the presets, then the configured beginsWith values that are no preset, in configuration order. */
function ruleEntries(settings) {
  const seen = new Set();
  const entries = [];
  for (const values of [...PRESETS, ...Object.values(settings.rules ?? {}).map(rule => rule.beginsWith ?? [])]) {
    const id = values.length ? ruleId(values) : null;
    if (ruleOf(id) && !seen.has(id)) {
      seen.add(id);
      entries.push({ id, kind: 'rule', beginsWith: ruleOf(id) });
    }
  }
  return entries;
}

/** The continue entries of a node; earlier: a top-level block before it (top-level), an earlier sibling of its type (nested). */
const continueEntries = (node, earlier) => (node.level === 0
  ? [{ id: 'continue:previous', kind: 'continue', disabled: !earlier }]
  : [{ id: 'continue:parent', kind: 'continue' }, { id: 'continue:sibling', kind: 'continue', type: node.start.type, disabled: !earlier }]);

/**
 * The entries of the pagination dropdown of a node: the rule entries (a current rule that is none of them after them), hand only while it
 * is the current strategy, the continue entries
 * (top-level continue:previous, disabled on the first top-level block; nested continue:parent and continue:sibling, disabled without an
 * earlier sibling of its type), and the pagination rules.
 * @returns {import('../../types').StrategyOption[]}
 */
export function strategyOptions(tree, node, settings, current) {
  const siblings = siblingsOf(tree, node);
  const before = siblings.slice(0, siblings.indexOf(node));
  const earlier = node.level === 0 ? before.length > 0 : before.some(other => other.start.type === node.start.type);
  const rules = ruleEntries(settings);
  if (ruleOf(current) && !rules.some(entry => entry.id === current)) {
    rules.push({ id: current, kind: 'rule', beginsWith: ruleOf(current) });
  }
  return [
    ...rules,
    ...(current === 'hand' ? [{ id: 'hand', kind: 'hand' }] : []),
    ...continueEntries(node, earlier),
    { id: 'rules', kind: 'rules' },
  ];
}

const sameLabel = (a, b) => (normalizeLabel(a) || '–') === (normalizeLabel(b) || '–');

/**
 * The strategy of every node read back from its labels (per-block pagination design, decisions 8 and 11), by node key. A candidate
 * matches a node when relabelling its own pages by it, everything else at its strategy so far and later nodes hand, leaves them as they
 * are. Candidates in this order: the chosen entry (chosen is keyed by file name of the first page and level), the default, the dropdown
 * entries; hand and disabled entries are none. Nothing matches: hand. Children are read first without continue:parent (a child whose first
 * candidate is continue:parent stays open right away), then their parent with the children still open continuing it, then those children
 * with all their candidates (continue:parent last when that parent matched nothing); one of them not continuing its parent: the parent once more.
 * Every top-level block is evaluated on its own pages, behind one page that stands for the stream continue:previous would join.
 */
export function detectStrategies(pages, settings, chosen) {
  const tree = buildTree(pages);
  const defaults = defaultResolver(tree, settings);
  const rules = ruleEntries(settings).map(entry => entry.id);
  const result = new Map();
  let previous = null; // the stream continue:previous joins: { label } with its last counting label, null when nothing counts before
  tree.roots.forEach((root, rootIndex) => {
    // the block on its own; the page before it stands for the previous stream: it counts, carrying the last counting label of that stream
    const offset = previous ? 1 : 0;
    const local = [...(previous ? [{ label: previous.label ?? '–', depth: 1, starts: [{ type: null }] }] : []),
      ...pages.slice(root.first, root.last + 1)];
    const shift = offset - root.first;
    const state = new Map(previous ? [['0:0', 'rule:1']] : []);
    const localKey = node => `${node.first + shift}:${node.level}`;
    const resolve = key => state.get(key) ?? 'hand';
    const matches = (node, id) => {
      state.set(localKey(node), id);
      const { list } = streams(local, settings, resolve);
      const key = localKey(node);
      for (const stream of list) {
        const part = stream.parts.find(other => other.node === key);
        if (part) {
          return part.rule !== null && part.pages.every(i => sameLabel(valueIn(local, stream, i), local[i].label));
        }
      }
      return true; // no page of its own
    };
    const candidates = (node, siblings, index, withParent) => {
      const earlier = node.level === 0 ? rootIndex > 0
        : siblings.slice(0, index).some(other => other.start.type === node.start.type);
      const own = chosen?.get(`${pages[node.first].filename}:${node.level}`);
      const continues = continueEntries(node, earlier).filter(entry => !entry.disabled).map(entry => entry.id);
      return [...new Set([own, defaults(nodeKey(node)), ...rules, ...continues])]
        .filter(id => (ruleOf(id) || continues.includes(id)) && (withParent || id !== 'continue:parent'));
    };
    // parentLast: continue:parent only after every other candidate
    const find = (node, siblings, index, withParent, parentLast = false) => {
      const ids = candidates(node, siblings, index, withParent);
      const ordered = parentLast ? [...ids.filter(id => id !== 'continue:parent'), ...ids.filter(id => id === 'continue:parent')] : ids;
      for (const id of ordered) {
        if (matches(node, id)) {
          return id;
        }
      }
      state.set(localKey(node), 'hand');
      return null;
    };
    // a node and its subtree; null when nothing matches without continue:parent (its children are settled against it as hand)
    const detect = (node, siblings, index, withParent) => {
      const open = [];
      node.children.forEach((child, k) => {
        if (detect(child, node.children, k, false) === null) {
          open.push([child, k]);
        }
      });
      open.forEach(([child]) => state.set(localKey(child), 'continue:parent'));
      // a child that would try continue:parent first waits for its parent
      const waits = !withParent && node.level > 0 && candidates(node, siblings, index, true)[0] === 'continue:parent';
      if (waits) {
        state.set(localKey(node), 'hand');
      }
      let id = waits ? null : find(node, siblings, index, withParent);
      let again = false;
      // a parent that cannot be read with them continuing it: their own rules first, it would only start a fresh count
      const parentLast = id === null && !waits;
      open.forEach(([child, k]) => {
        if (find(child, node.children, k, true, parentLast) !== 'continue:parent') {
          again = true; // the parent was read with it continuing
        }
      });
      if (again && !waits) {
        id = find(node, siblings, index, withParent);
      }
      return id;
    };
    detect(root, tree.roots, rootIndex, false);
    const id = resolve(localKey(root));
    for (const [key, value] of state) {
      const [first, level] = key.split(':').map(Number);
      if (first >= offset) {
        result.set(`${first - shift}:${level}`, value);
      }
    }
    // the stream of this block becomes the previous one when it counts (as streams decides)
    const { list } = streams(local, settings, resolve);
    const stream = list.find(s => s.parts.some(part => part.node === localKey(root)));
    const counting = stream?.pages.map(i => local[i].label).filter(isCounting) ?? [];
    if (id === 'continue:previous' || (ruleOf(id) ?? []).some(value => isCounting(value)) || (id === 'hand' && counting.length)) {
      previous = { label: counting.at(-1) ?? null };
    }
  });
  return result;
}

const resolverOf = strategies => key => strategies.get(key) ?? 'hand';

/** The deepest node of every page, null for a page without block. */
export function ownersOf(tree, length) {
  const owner = new Array(length).fill(null);
  for (const node of flatten(tree.roots)) { // parents before children: the deepest node wins
    for (let i = node.first; i <= node.last; i++) {
      owner[i] = node;
    }
  }
  return owner;
}

/** New page list: the top-level blocks starting on the pages in blocks and the loose runs starting on the pages in runs relabelled by the strategies; hand nodes keep their labels. */
const relabel = (pages, settings, strategies, blocks, runs = new Set()) => paginateParts(pages, settings,
  (stream, part) => (part.node === null ? runs.has(part.pages[0]) : blocks.has(part.block)), resolverOf(strategies));

/**
 * The chains after the top-level blocks starting on the pages in from and after the loose pages in loose: every later top-level block that
 * continues the previous one, up to the first that does not. Blocks that are no part of the stream continue:previous joins are passed over:
 * a rule that does not count, hand without a counting label in its stream (its own pages and those of children continuing it, as streams
 * decides). stops are the hand blocks a chain ended at.
 */
function chainAfter(pages, tree, strategies, from, loose = []) {
  const strategyOf = node => strategies.get(nodeKey(node)) ?? 'hand';
  const owner = ownersOf(tree, pages.length);
  const joins = (node, root) => node === root || (strategyOf(node) === 'continue:parent' && joins(node.parent, root));
  const counts = root => pages.slice(root.first, root.last + 1).some((page, k) => isCounting(page.label) && joins(owner[root.first + k], root));
  const chain = [];
  const stops = [];
  let open = false;
  let end = -1;
  for (const root of tree.roots) {
    const id = strategyOf(root);
    open = open || loose.some(i => end < i && i < root.first);
    end = root.last;
    if (from.has(root.first)) {
      open = true;
    } else if (!open || (ruleOf(id) && !ruleOf(id).some(value => isCounting(normalizeLabel(value)))) || (id === 'hand' && !counts(root))) {
      continue;
    } else if (id === 'continue:previous') {
      chain.push(root.first);
    } else {
      if (id === 'hand') {
        stops.push(root);
      }
      open = false;
    }
  }
  return { chain, stops };
}

/**
 * Relabels the top-level blocks in blocks, the loose runs in runs and the chains after the blocks in from and after the runs. Offers, one
 * per top-level block (first = its first page): offer maps the first page of a top-level block to the nodes in it to offer; a hand block a
 * chain stopped at offers its hand nodes when it would belong to the chain (its default is continue:previous) and the relabelling changed a
 * label. Offered are the pages of these nodes that change when they get their default strategy.
 */
function settle(pages, settings, strategies, tree, { blocks = [], from = [], runs = new Set(), offer = new Map() }) {
  const { chain, stops } = chainAfter(pages, tree, strategies, new Set(from), [...runs]);
  const out = relabel(pages, settings, strategies, new Set([...blocks, ...chain]), runs);
  const nodes = new Map([...offer].map(([first, list]) => [first, new Set(list)]));
  const defaults = defaultResolver(tree, settings);
  if (out.some((page, i) => !sameLabel(page.label, pages[i].label))) {
    for (const root of stops.filter(other => defaults(nodeKey(other)) === 'continue:previous')) {
      const hand = flatten([root]).filter(node => (strategies.get(nodeKey(node)) ?? 'hand') === 'hand');
      nodes.set(root.first, new Set([...(nodes.get(root.first) ?? []), ...hand]));
    }
  }
  if (!nodes.size) {
    return { pages: out, offers: [] };
  }
  const owner = ownersOf(tree, out.length);
  const offers = tree.roots.filter(root => nodes.has(root.first)).map(root => {
    const offered = nodes.get(root.first);
    const trial = new Map(strategies);
    offered.forEach(node => trial.set(nodeKey(node), defaults(nodeKey(node))));
    const fresh = relabel(out, settings, trial, new Set([root.first]));
    const list = [];
    for (let i = root.first; i <= root.last; i++) {
      if (offered.has(owner[i]) && !sameLabel(fresh[i].label, out[i].label)) {
        list.push(i);
      }
    }
    return { first: root.first, pages: list };
  });
  return { pages: out, offers: offers.filter(offer => offer.pages.length) };
}

/**
 * New page list after a label of page from changed: the top-level blocks after the one containing it that continue it are relabelled by
 * the strategies (their nested nodes with them), up to the first top-level block that does not continue; that block is offered when it is
 * hand and its default would change a page. Without automatic pagination nothing is relabelled.
 */
export function relabelChain(pages, settings, strategies, from) {
  if (settings.automatic === false) {
    return { pages: clonePages(pages), offers: [] };
  }
  const tree = buildTree(pages);
  const root = tree.roots.find(other => other.first <= from && from <= other.last);
  return settle(pages, settings, strategies, tree, { from: root ? [root.first] : [] });
}

/**
 * New page list after text was typed on page index in mode (pages: with the typing applied, as previewLabel gives it). When the top-level
 * block of the page still matches a strategy (detected with chosen, as detectStrategies) and mode is not single, the chain after it follows
 * as relabelChain. Else nothing after the block changes (a hand-typed label renumbers no other block): every later top-level block the
 * chain would change is offered with the pages it would change, by its strategy before the typing (offer.strategy).
 */
export function afterTyping(pages, settings, strategies, chosen, index, mode) {
  const chained = relabelChain(pages, settings, strategies, index);
  const root = buildTree(pages).roots.find(other => other.first <= index && index <= other.last);
  if (!root || (mode !== 'single' && detectStrategies(pages, settings, chosen).get(nodeKey(root)) !== 'hand')) {
    return chained;
  }
  const offers = buildTree(pages).roots.filter(other => other.first > root.last).map(other => {
    const list = [];
    for (let i = other.first; i <= other.last; i++) {
      if (!sameLabel(chained.pages[i].label, pages[i].label)) {
        list.push(i);
      }
    }
    return { first: other.first, pages: list, strategy: strategies.get(nodeKey(other)) ?? 'hand' };
  });
  return { pages: clonePages(pages), offers: offers.filter(offer => offer.pages.length) };
}

/**
 * New page list with the node ({first, level}) relabelled by strategy id: its whole top-level block is relabelled with every node's
 * strategy (hand nodes keep their labels), then the chain after it as relabelChain.
 */
export function applyStrategy(pages, settings, strategies, node, id) {
  const tree = buildTree(pages);
  const root = tree.roots.find(other => other.first <= node.first && node.first <= other.last);
  const next = new Map(strategies).set(nodeKey(node), id);
  return settle(pages, settings, next, tree, { blocks: [root.first], from: settings.automatic === false ? [] : [root.first] });
}

/**
 * New page list after a structure change from before to after (per-block pagination design, decisions 7, 9 and 11), with offers per
 * top-level block. Nodes are matched by file name of their first page and level; a node whose first page changed (boundary moved, first
 * page deleted) is the unmatched node of its level it shares pages with. The pages of a node are the file names of first..last; it also
 * changed when it owns a page itself (as deepest node) that another node owned before, as after a child was removed. Per node
 * after the change: changed (new, other type, other pages) with all pages uncounted → its default, relabelled; new → hand, offered;
 * other type → hand stays hand and is offered, the old type's default becomes the new type's default and is relabelled, any other
 * strategy stays and is relabelled when its pages changed; other pages → a hand node, or one that now owns pages a hand node owned, is hand
 * and offered, any other is relabelled by its strategy; else untouched. Loose runs that got pages get settings.withoutBlock. The chains
 * after every relabelled top-level block and every such run follow (a block that became loose leaves the stream). beforeStrategies: the strategies of before by node key (detected with chosen without).
 */
export function restructure(before, after, settings, chosen, beforeStrategies) {
  if (settings.automatic === false) {
    return { pages: clonePages(after), offers: [] };
  }
  const was = beforeStrategies ?? detectStrategies(before, settings, chosen);
  const oldTree = buildTree(before);
  const tree = buildTree(after);
  const oldDefaults = defaultResolver(oldTree, settings);
  const defaults = defaultResolver(tree, settings);
  const oldNodes = flatten(oldTree.roots);
  const nodes = flatten(tree.roots);
  const fileKey = (list, node) => `${list[node.first].filename}:${node.level}`;
  const filesOf = (list, node) => new Set(list.slice(node.first, node.last + 1).map(page => page.filename));
  const byFile = new Map(oldNodes.map(node => [fileKey(before, node), node]));
  const match = new Map();
  for (const node of nodes) {
    if (byFile.has(fileKey(after, node))) {
      match.set(node, byFile.get(fileKey(after, node)));
    }
  }
  const taken = new Set(match.values());
  nodes.filter(node => !match.has(node)).forEach(node => {
    const files = filesOf(after, node);
    const old = oldNodes.find(other => !taken.has(other) && other.level === node.level
      && before.slice(other.first, other.last + 1).some(page => files.has(page.filename)));
    if (old) {
      match.set(node, old);
      taken.add(old);
    }
  });
  const oldOwner = new Map(ownersOf(oldTree, before.length).map((node, i) => [before[i].filename, node]));
  // a nested node that only continues the count its parent's strategy generated (continue:parent, not picked, the parent not hand before):
  // a new one as detected after the change, any other as before
  let detectedAfter = null;
  const onlyContinues = (node, old) => {
    const parent = node.parent && match.get(node.parent);
    if (!parent || strategyOfOld(parent) === 'hand' || chosen?.get(fileKey(after, node)) === 'continue:parent'
      || (old && chosen?.get(fileKey(before, old)) === 'continue:parent')) {
      return false;
    }
    if (old) {
      return strategyOfOld(old) === 'continue:parent';
    }
    detectedAfter ??= detectStrategies(after, settings, chosen);
    return detectedAfter.get(nodeKey(node)) === 'continue:parent';
  };
  const strategyOfOld = node => was.get(nodeKey(node)) ?? 'hand';
  const owner = ownersOf(tree, after.length);
  const next = new Map();
  const blocks = new Set();
  const offer = new Map();
  for (const node of nodes) {
    let root = node;
    while (root.parent) {
      root = root.parent;
    }
    const key = nodeKey(node);
    const old = match.get(node);
    const files = filesOf(after, node);
    const oldFiles = old ? filesOf(before, old) : null;
    // pages the node owns itself now that another node (or none) owned before, e.g. those of a removed child
    const arriving = [];
    for (let i = node.first; old && i <= node.last; i++) {
      if (owner[i] === node && oldOwner.get(after[i].filename) !== old) {
        arriving.push(after[i].filename);
      }
    }
    const moved = old && (arriving.length > 0 || files.size !== oldFiles.size || [...files].some(file => !oldFiles.has(file)));
    const retyped = old && old.start.type !== node.start.type;
    const oldId = old ? strategyOfOld(old) : null;
    let id = oldId;
    let relabelled = false;
    if ((!old || retyped || moved) && after.slice(node.first, node.last + 1).every(page => sameLabel(page.label, '–'))) {
      id = defaults(key);
      relabelled = true;
    } else if ((!old || retyped) && node.start.type && onlyContinues(node, old)) {
      id = defaults(key); // numbers the parent's strategy generated are not worth keeping (decision 11)
      relabelled = true;
    } else if (!old) {
      id = 'hand';
    } else if (retyped) {
      if (oldId === oldDefaults(nodeKey(old)) && oldId !== 'hand') {
        id = defaults(key);
        relabelled = true;
      } else {
        relabelled = moved && oldId !== 'hand';
      }
    } else if (moved) {
      const fromHand = arriving.some(file => oldOwner.get(file) && strategyOfOld(oldOwner.get(file)) === 'hand');
      id = fromHand ? 'hand' : oldId;
      relabelled = id !== 'hand';
    }
    next.set(key, id);
    if (relabelled) {
      blocks.add(root.first);
    } else if (id === 'hand' && (!old || retyped || moved)) {
      offer.set(root.first, [...(offer.get(root.first) ?? []), node]);
    }
  }
  // loose runs with a page that was in a block or is new
  const wasLoose = new Set(before.filter(page => !oldOwner.get(page.filename)).map(page => page.filename));
  const runs = new Set();
  let run = null;
  tree.loose.forEach(i => {
    run = run !== null && i > 0 && !after[i - 1].depth ? run : i;
    if (!wasLoose.has(after[i].filename)) {
      runs.add(run);
    }
  });
  return settle(after, settings, next, tree, { blocks: [...blocks], from: [...blocks], runs, offer });
}
