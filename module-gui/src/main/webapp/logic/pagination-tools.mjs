// Volume-wide pagination tools, pure functions on the page list; behaviour as in the pagination v2 design (Missing pagination, Changed since opening, Rules dialog).
import { clonePages } from './blocks.mjs';
import { isCounting, nextLabel } from './labels.mjs';
import { streams, valueIn, paginateParts, applyOffers } from './pagination.mjs';

const isMissing = page => (page.label ?? '') === '';

/** Runs of pages without label as [first, last]. */
export function missingRuns(pages) {
  const runs = [];
  pages.forEach((page, i) => {
    if (!isMissing(page)) {
      return;
    }
    const last = runs[runs.length - 1];
    if (last && last[1] === i - 1) {
      last[1] = i;
    } else {
      runs.push([i, i]);
    }
  });
  return runs;
}

/** Every page without label gets its rule value; in streams without a rule the next value after the last counting label before it, else –. */
export function fillMissing(pages, settings) {
  const out = clonePages(pages);
  for (const stream of streams(out, settings).list) {
    for (const i of stream.pages.filter(j => isMissing(out[j]))) {
      let value = valueIn(out, stream, i);
      if (value === null) {
        const previous = stream.pages.filter(j => j < i).reverse().map(j => out[j].label).find(isCounting);
        value = previous === undefined ? '–' : nextLabel(previous);
      }
      out[i].label = value;
    }
  }
  return out;
}

/** Indices of the pages whose label differs from the METS as last loaded. */
export function changedSinceOpening(pages) {
  return pages.map((page, i) => i).filter(i => pages[i].label !== pages[i].metsLabel);
}

export function restoreFromMets(pages) {
  return clonePages(pages).map(page => ({ ...page, label: page.metsLabel }));
}

/**
 * Whether a part of a stream is covered by the scope: none, block (the block starting on page scope.first), fromBlock (that block and all
 * after it), volume, offers (the blocks of scope.offers). simulateRules applies scope offers with applyOffers; offers here is for the
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
 * New page list with the rules applied in the scope: none, block (the block starting on page first), fromBlock (that block and all after it),
 * volume (everything including pages without block), offers (only the offered pages, as applyOffers). Streams without a rule (untyped blocks)
 * keep their labels.
 */
export function simulateRules(pages, settings, scope) {
  if (scope.kind === 'offers') {
    return applyOffers(pages, settings, scope.offers, scope.from ?? null);
  }
  return paginateParts(pages, settings, inScope(scope));
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
