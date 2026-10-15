// "Apply type pattern" and "Continue from here" (spec section 5). Both work on the start block and its following siblings.
import { applyType, buildTree, clonePages, refOf, siblingsFrom } from './blocks.mjs';
import { fromIso, nextDate, toIso } from './dates.mjs';

export function applyTypePattern(pages, startRef, pattern, catalog) {
  if (!pattern.length) {
    return pages;
  }
  const out = clonePages(pages);
  siblingsFrom(buildTree(out), startRef).forEach((node, i) => applyType(node, pattern[i % pattern.length], catalog));
  return out;
}

export function continueFrom(pages, startRef, options, catalog) {
  const out = clonePages(pages);
  const [first, ...rest] = siblingsFrom(buildTree(out), startRef);
  const startInfo = catalog[first?.start.type] || {};
  const startDate = startInfo.dated ? fromIso(first.start.date) : null;
  const startNumber = startInfo.numbered && /^\d+$/.test((first.start.number || '').trim()) ? parseInt(first.start.number, 10) : null;
  if (!startDate && startNumber === null) {
    return { pages, preview: [], count: 0, error: 'NO_DATE_OR_NUMBER' };
  }
  const include = new Set(options.include);
  let date = startDate;
  let dayNumber = startNumber;
  let issueNumber = startNumber;
  let seen = new Set([first.start.type]);
  let count = 0;
  const row = (node, note) => ({ ref: refOf(node), type: node.start.type, date: node.start.date, number: node.start.number, note });
  const preview = [row(first, 'start')];
  for (const node of rest) {
    const start = node.start;
    const info = catalog[start.type] || {};
    if (!start.type || !include.has(start.type) || !(info.dated || info.numbered)) {
      preview.push(row(node, 'notIncluded'));
      continue;
    }
    let note = '';
    if (info.dated) {
      // a new day starts when an included type repeats, or with every block in dateMode 'perIssue'
      if (options.dateMode === 'perIssue' || seen.has(start.type)) {
        seen = new Set([start.type]);
        if (dayNumber !== null) {
          dayNumber++;
        }
        if (date) {
          date = nextDate(date, options);
        }
        note = 'newDay';
      } else {
        seen.add(start.type);
        note = 'sameDay';
      }
      if (date) {
        start.date = toIso(date);
        start.dateRaw = null;
      }
    }
    if (startNumber !== null && info.numbered) {
      start.number = String(options.mode === 'perDay' ? dayNumber : ++issueNumber);
      if (info.partNumbered) {
        start.prefix = first.start.prefix;
        start.suffix = first.start.suffix;
      }
    }
    count++;
    preview.push(row(node, note));
  }
  return { pages: out, preview, count };
}

/** A copy of the pattern with the entry at {@code from} moved to {@code to}; out of range moves change nothing. */
export function movePatternEntry(pattern, from, to) {
  if (from === to || from < 0 || to < 0 || from >= pattern.length || to >= pattern.length) {
    return [...pattern];
  }
  const out = [...pattern];
  const [entry] = out.splice(from, 1);
  out.splice(to, 0, entry);
  return out;
}
