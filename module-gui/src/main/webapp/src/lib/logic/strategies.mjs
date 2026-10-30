// Pagination strategies of the blocks (per-block pagination design, decisions 6–9): an id per node says how its pages are numbered.
// Ids: rule:<beginsWith values joined by one blank> (rule:1, rule:– 1), continue:previous, continue:parent, continue:sibling, hand.
import { buildTree } from './blocks.mjs';
import { normalizeLabel, isCounting } from './labels.mjs';
import { streams, valueIn } from './pagination.mjs';

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
 * The strategy a node gets from the settings: untyped hand; top-level the rule of its type, else rule:–, and when counting through the
 * volume continue:previous after the first top-level block if the rule counts; nested the rule of its type (continue:sibling after an
 * earlier sibling of its type with continueInParent), else continue:parent.
 */
export function defaultStrategy(tree, node, settings) {
  const siblings = siblingsOf(tree, node);
  const before = siblings.slice(0, siblings.indexOf(node));
  return strategyFor(node, settings, node.level === 0 ? before.length > 0 : before.some(other => other.start.type === node.start.type));
}

/** defaultStrategy of every node of the tree by node key; an unknown key is hand. */
export function defaultResolver(tree, settings) {
  const byKey = new Map();
  const walk = siblings => {
    const types = new Set();
    siblings.forEach((node, index) => {
      byKey.set(nodeKey(node), strategyFor(node, settings, node.level === 0 ? index > 0 : types.has(node.start.type)));
      types.add(node.start.type);
      walk(node.children);
    });
  };
  walk(tree.roots);
  return key => byKey.get(key) ?? 'hand';
}

const PRESETS = [['1'], ['i'], ['I'], ['[1]'], ['–', '1'], ['–']];

/** The rule entries of the dropdown: the presets, then the configured beginsWith values that are no preset, in configuration order. */
function ruleEntries(settings) {
  const seen = new Set();
  const entries = [];
  for (const values of [...PRESETS, ...Object.values(settings.rules ?? {}).map(rule => rule.beginsWith ?? [])]) {
    const id = values.length ? ruleId(values) : null;
    if (id && !seen.has(id)) {
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
 * The entries of the pagination dropdown of a node: the rule entries, hand only while it is the current strategy, the continue entries
 * (top-level continue:previous, disabled on the first top-level block; nested continue:parent and continue:sibling, disabled without an
 * earlier sibling of its type), and the pagination rules.
 */
export function strategyOptions(tree, node, settings, current) {
  const siblings = siblingsOf(tree, node);
  const before = siblings.slice(0, siblings.indexOf(node));
  const earlier = node.level === 0 ? before.length > 0 : before.some(other => other.start.type === node.start.type);
  return [
    ...ruleEntries(settings),
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
 * entries; hand and disabled entries are none. Nothing matches: hand. Children are read first without continue:parent, then their
 * parent with the children still open continuing it, then those children with continue:parent; one of them hand: its parent once more.
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
      const ids = [own, defaults(nodeKey(node)), ...rules,
        ...continueEntries(node, earlier).filter(entry => !entry.disabled).map(entry => entry.id)];
      return [...new Set(ids)].filter(id => id && id !== 'hand' && (withParent || id !== 'continue:parent')
        && (ruleOf(id) || ids.slice(2).includes(id)));
    };
    const find = (node, siblings, index, withParent) => {
      for (const id of candidates(node, siblings, index, withParent)) {
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
      let id = find(node, siblings, index, withParent);
      let again = false;
      open.forEach(([child, k]) => {
        if (find(child, node.children, k, true) === null) {
          again = true;
        }
      });
      if (again) {
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
