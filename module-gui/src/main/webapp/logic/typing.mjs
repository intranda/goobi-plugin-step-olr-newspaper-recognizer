// Typing a page label: preview how the following pages of the stream count on, and detect own numbering (pagination v2 design, Typing).
import { clonePages } from './blocks.mjs';
import { parseLabel, normalizeLabel, isCounting, nextLabel, follows } from './labels.mjs';
import { streams, valueIn } from './pagination.mjs';

const streamOf = (result, index) => result.list.find(s => s.pages.includes(index));

/** What a page gets by following: the rule value, else the next value after the last counting label before it in its stream, else –. */
function followIn(pages, stream, index) {
  const byRule = valueIn(pages, stream, index);
  if (byRule !== null) {
    return byRule;
  }
  for (const i of stream.pages.filter(j => j < index).reverse()) {
    if (isCounting(pages[i].label)) {
      return nextLabel(pages[i].label);
    }
  }
  return '–';
}

export function followValue(pages, settings, index) {
  return followIn(pages, streamOf(streams(pages, settings), index), index);
}

/** A counting label that does not follow the page before it: an earlier page of the stream counts and the label differs from the follow value. */
export function ownNumbering(pages, settings, index) {
  const label = pages[index].label;
  if (!isCounting(label)) {
    return false;
  }
  const stream = streamOf(streams(pages, settings), index);
  if (!stream.pages.some(i => i < index && isCounting(pages[i].label))) {
    return false;
  }
  return normalizeLabel(label) !== followIn(pages, stream, index);
}

/**
 * The page list as it would look if text was typed on page index. mode: 'follow' counts on until a page with own numbering,
 * 'toEnd' to the end of the stream regardless, 'single' changes only this page. run = following pages that change, stop = the
 * page with own numbering that ended the run, end = last page of the stream, value = what the page itself gets.
 */
export function previewLabel(pages, settings, index, text, mode) {
  const stream = streamOf(streams(pages, settings), index);
  const kind = parseLabel(text).kind;
  const value = kind === 'empty' ? followIn(pages, stream, index) : normalizeLabel(text);
  const out = clonePages(pages);
  out[index].label = value;
  const run = [];
  let stop = null;
  if (mode !== 'single' && isCounting(value)) {
    let previous = pages[index].label;
    let current = value;
    for (const j of stream.pages.filter(i => i > index)) {
      if (mode !== 'toEnd' && !(isCounting(previous) && follows(previous, pages[j].label))) {
        stop = j;
        break;
      }
      previous = pages[j].label;
      current = nextLabel(current);
      out[j].label = current;
      run.push(j);
    }
  }
  return { pages: out, run, stop, kind, value, end: stream.pages[stream.pages.length - 1] };
}
