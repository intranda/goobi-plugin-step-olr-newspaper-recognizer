// Dates as {y, m, d} (month 1-based), independent of time zones. Patterns support the tokens dd, MM and yyyy.

const TOKENS = { dd: { re: '(\\d{2})', field: 'd' }, MM: { re: '(\\d{2})', field: 'm' }, yyyy: { re: '(\\d{4})', field: 'y' } };
const TOKEN = /(dd|MM|yyyy)/g;
const escape = text => text.replace(/[.*+?^=!:${}()|[\]\\/]/g, '\\$&');

function utc(y, m, d) {
  const date = new Date(0);
  date.setUTCFullYear(y, m - 1, d);
  return date;
}

function fromUtc(date) {
  return { y: date.getUTCFullYear(), m: date.getUTCMonth() + 1, d: date.getUTCDate() };
}

export function parseByPattern(text, pattern) {
  if (!text) {
    return null;
  }
  let regex = '';
  let last = 0;
  const fields = [];
  for (const match of pattern.matchAll(TOKEN)) {
    regex += escape(pattern.slice(last, match.index)) + TOKENS[match[0]].re;
    fields.push(TOKENS[match[0]].field);
    last = match.index + match[0].length;
  }
  regex += escape(pattern.slice(last));
  const found = String(text).trim().match(new RegExp(`^${regex}$`));
  if (!found) {
    return null;
  }
  const parts = {};
  fields.forEach((field, i) => { parts[field] = parseInt(found[i + 1], 10); });
  if (parts.y === undefined || parts.m === undefined || parts.d === undefined) {
    return null;
  }
  const check = fromUtc(utc(parts.y, parts.m, parts.d));
  return check.y === parts.y && check.m === parts.m && check.d === parts.d ? check : null;
}

const pad = (value, width) => String(value).padStart(width, '0');

export function formatByPattern(date, pattern) {
  return pattern.replace(TOKEN, token => (token === 'dd' ? pad(date.d, 2) : token === 'MM' ? pad(date.m, 2) : pad(date.y, 4)));
}

export const fromIso = text => parseByPattern(text, 'yyyy-MM-dd');
export const toIso = date => formatByPattern(date, 'yyyy-MM-dd');

export function addDays(date, days) {
  return fromUtc(utc(date.y, date.m, date.d + days));
}

export function weekday(date) {
  return utc(date.y, date.m, date.d).getUTCDay();
}

/** Quick choices for the publication days, indexed like weekday() (0 = Sunday). */
export const WEEKDAY_PRESETS = {
  daily: [true, true, true, true, true, true, true],
  monToSat: [false, true, true, true, true, true, true],
  monToFri: [false, true, true, true, true, true, false],
};

/** The next publication day: +1 day (+8 if biweekly), then forward to the next enabled weekday. */
export function nextDate(date, { weekdays, biweekly }) {
  let next = addDays(date, biweekly ? 8 : 1);
  if (!weekdays || !weekdays.some(Boolean)) {
    return next;
  }
  for (let guard = 0; guard < 7 && !weekdays[weekday(next)]; guard++) {
    next = addDays(next, 1);
  }
  return next;
}
