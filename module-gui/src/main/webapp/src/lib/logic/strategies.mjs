// Pagination strategies of the blocks (per-block pagination design, decisions 6–9): an id per node says how its pages are numbered.
// Ids: rule:<beginsWith values joined by one blank> (rule:1, rule:– 1), continue:previous, continue:parent, continue:sibling, hand.
import { normalizeLabel, isCounting } from './labels.mjs';

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
