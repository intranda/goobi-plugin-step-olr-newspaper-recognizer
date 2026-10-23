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

/**
 * @typedef {{ ref: { page: number, level: number }, type: string | null, before: { date: string | null, number: string | null },
 *   after: { date: string | null, number: string | null }, newDay: boolean, changed: boolean, reason: 'untyped' | 'excluded' | 'noFields' | null }} ContinueRow
 */

/**
 * Continues date and number of the start block over its following siblings. The preview has one row per following block with its
 * values before and after, whether it begins a new day, whether its values change and why it is left out (reason
 * 'untyped' | 'excluded' | 'noFields', else null); `start` holds the values of the start block its type has, `count` the rows that change.
 */
export function continueFrom(pages, startRef, options, catalog) {
  const out = clonePages(pages);
  const [first, ...rest] = siblingsFrom(buildTree(out), startRef);
  const startInfo = catalog[first?.start.type] || {};
  const startDate = startInfo.dated ? fromIso(first.start.date) : null;
  const startNumber = startInfo.numbered && /^\d+$/.test((first.start.number || '').trim()) ? parseInt(first.start.number, 10) : null;
  if (!startDate && startNumber === null) {
    return { pages, preview: [], count: 0, error: 'NO_DATE_OR_NUMBER' };
  }
  const start = {
    type: first.start.type,
    date: startDate ? first.start.date : null,
    number: startInfo.numbered ? first.start.number : null,
    prefix: first.start.prefix,
    suffix: first.start.suffix,
  };
  const include = new Set(options.include);
  let date = startDate;
  let dayNumber = startNumber;
  let issueNumber = startNumber;
  let seen = new Set([first.start.type]);
  /** @type {ContinueRow[]} */
  const preview = [];
  for (const node of rest) {
    const s = node.start;
    const info = catalog[s.type] || {};
    const before = { date: s.date, number: s.number };
    const old = [s.date, s.number, s.prefix, s.suffix];
    const reason = !s.type ? 'untyped' : !include.has(s.type) ? 'excluded' : !(info.dated || info.numbered) ? 'noFields' : null;
    let newDay = false;
    if (!reason) {
      if (info.dated) {
        // a new day starts when an included type repeats, or with every block in dateMode 'perIssue'
        if (options.dateMode === 'perIssue' || seen.has(s.type)) {
          seen = new Set([s.type]);
          if (dayNumber !== null) {
            dayNumber++;
          }
          if (date) {
            date = nextDate(date, options);
          }
          newDay = true;
        } else {
          seen.add(s.type);
        }
        if (date) {
          s.date = toIso(date);
          s.dateRaw = null;
        }
      }
      if (startNumber !== null && info.numbered) {
        s.number = String(options.mode === 'perDay' ? dayNumber : ++issueNumber);
        if (info.partNumbered) {
          s.prefix = first.start.prefix;
          s.suffix = first.start.suffix;
        }
      }
    }
    const changed = [s.date, s.number, s.prefix, s.suffix].some((value, i) => value !== old[i]);
    preview.push({ ref: refOf(node), type: s.type, before, after: { date: s.date, number: s.number }, newDay, changed, reason });
  }
  return { pages: out, preview, count: preview.filter(row => row.changed).length, start };
}

/**
 * The preview rows of {@link continueFrom} by publication day: a new group at every row that begins a new day, the rows before the
 * first one in the group of the start day. `date` is the day's date (null without dates), `dayNumber` its number when the start has a
 * whole number (the number per day counts up with every new day).
 * @param {ContinueRow[]} preview
 * @returns {{ date: string | null, dayNumber: string | null, rows: ContinueRow[] }[]}
 */
export function groupByDay(preview, start) {
  const startNumber = /^\d+$/.test((start.number || '').trim()) ? parseInt(start.number, 10) : null;
  /** @type {{ date: string | null, dayNumber: string | null, rows: ContinueRow[] }[]} */
  const groups = [{ date: start.date, dayNumber: start.number, rows: [] }];
  for (const row of preview) {
    if (row.newDay) {
      groups.push({ date: row.after.date, dayNumber: startNumber === null ? null : String(startNumber + groups.length), rows: [] });
    }
    groups[groups.length - 1].rows.push(row);
  }
  return groups.filter(group => group.rows.length > 0);
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

/** How many of the blocks after the start block on its level have each type (untyped blocks are not counted). */
/** @returns {Record<string, number>} */
export function followingTypeCounts(pages, startRef) {
  const counts = {};
  for (const node of siblingsFrom(buildTree(pages), startRef).slice(1)) {
    if (node.start.type) {
      counts[node.start.type] = (counts[node.start.type] || 0) + 1;
    }
  }
  return counts;
}

/**
 * Whether "number per day" and "number per issue" can give different numbers: with a new date for every issue each dated block
 * starts a new day, so they only differ for included types with a number but no date.
 */
export function numberModeMatters(options, catalog) {
  if (options.dateMode !== 'perIssue') {
    return true;
  }
  return options.include.some(type => catalog[type]?.numbered && !catalog[type]?.dated);
}
