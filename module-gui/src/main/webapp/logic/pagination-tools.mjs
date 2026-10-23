// Volume-wide pagination tools, pure functions on the page list; behaviour as in the pagination v2 design (Missing pagination, Changed since opening, Rules dialog).
import { clonePages } from './blocks.mjs';
import { isCounting, nextLabel } from './labels.mjs';
import { streams, valueIn } from './pagination.mjs';

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

/** Whether a part of a stream is covered by the scope: none, block (the block starting on page scope.first), fromBlock (that block and all after it), volume. */
export function inScope(scope) {
  return {
    none: () => false,
    block: (stream, part) => part.block === scope.first,
    fromBlock: (stream, part) => part.block >= scope.first,
    volume: () => true,
  }[scope.kind];
}

/**
 * New page list with the rules applied in the scope: none, block (the block starting on page first), fromBlock (that block and all after it),
 * volume (everything including pages without block). Streams without a rule (untyped blocks) keep their labels.
 */
export function simulateRules(pages, settings, scope) {
  const out = clonePages(pages);
  const covered = inScope(scope);
  for (const stream of streams(out, settings).list) {
    for (const part of stream.parts) {
      if (!part.rule || !covered(stream, part)) {
        continue;
      }
      for (const i of part.pages) {
        out[i].label = valueIn(out, stream, i);
      }
    }
  }
  return out;
}
