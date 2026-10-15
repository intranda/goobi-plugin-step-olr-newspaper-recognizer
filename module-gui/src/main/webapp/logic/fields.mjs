// The visible metadata fields of a block (spec A14). generateValue mirrors ValueGenerator.java: visible generated values are
// computed here, live, and saved with the value shown.
import { buildTree, flatten } from './blocks.mjs';
import { fromIso } from './dates.mjs';

export const MISSING = '[MISSING]';
const PLACEHOLDER = /\{(parent\.)?(date:([^}]*)|no|partNo|label)\}/g;

const pad = (value, width) => String(value).padStart(width, '0');
// the tokens PluginConfiguration accepts in visible fields
const DATE_TOKENS = {
  d: date => String(date.d),
  dd: date => pad(date.d, 2),
  M: date => String(date.m),
  MM: date => pad(date.m, 2),
  yy: date => pad(date.y % 100, 2),
  yyyy: date => pad(date.y, 4),
};

/** A DateTimeFormatter pattern with the tokens above and quoted literals; null for anything else. */
export function formatJavaDate(date, pattern) {
  let out = '';
  let i = 0;
  while (i < pattern.length) {
    const c = pattern[i];
    if (c === "'") {
      const end = pattern.indexOf("'", i + 1);
      if (end < 0) {
        return null;
      }
      out += end === i + 1 ? "'" : pattern.slice(i + 1, end);
      i = end + 1;
    } else if (/[A-Za-z]/.test(c)) {
      let end = i;
      while (end < pattern.length && pattern[end] === c) {
        end++;
      }
      const token = DATE_TOKENS[pattern.slice(i, end)];
      if (!token) {
        return null;
      }
      out += token(date);
      i = end;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** Prefix + number + suffix, or null without a number (ValueGenerator.partNumber). */
export function partNumber(start) {
  const number = (start.number || '').trim();
  return number ? (start.prefix || '') + number + (start.suffix || '') : null;
}

function valueOf(name, datePattern, node, catalog) {
  const type = node.start.type;
  const info = catalog[type] || {};
  if (name.startsWith('date:')) {
    const date = info.dated ? fromIso(node.start.date) : null;
    return date ? formatJavaDate(date, datePattern) : null;
  }
  if (name === 'no') {
    return info.numbered ? (node.start.number || '').trim() || null : null;
  }
  if (name === 'partNo') {
    return info.numbered ? partNumber(node.start) : null;
  }
  return type ? info.generatorLabel ?? null : null;
}

const isBlank = value => !value || !value.trim();

function resolve(name, datePattern, node, parentOnly, catalog) {
  if (parentOnly) {
    return node.parent ? valueOf(name, datePattern, node.parent, catalog) : null;
  }
  if (name === 'label') {
    return valueOf(name, datePattern, node, catalog);
  }
  for (let current = node; current; current = current.parent) {
    const value = valueOf(name, datePattern, current, catalog);
    if (!isBlank(value)) {
      return value;
    }
  }
  return null;
}

/** The generated value of a field ({pattern, skipIfEmpty}) for a tree node; null if a placeholder is empty and skipIfEmpty is set. */
export function generateValue(field, node, catalog) {
  let missing = false;
  const result = String(field.pattern || '').replace(PLACEHOLDER, (match, parent, name, datePattern) => {
    const value = resolve(name, datePattern, node, Boolean(parent), catalog);
    if (isBlank(value)) {
      missing = true;
      return MISSING;
    }
    return value;
  });
  return missing && field.skipIfEmpty ? null : result;
}

/**
 * The visible fields of a node with the value shown: a value in start.values (stored or typed) wins, otherwise the generated
 * value. A field with a pattern is overwritten when its value differs from the generated one, and stale when the generated
 * value changed since it was overwritten (start.generatedBase, only known in this session).
 */
export function fieldStates(node, catalog) {
  const info = catalog[node.start.type];
  if (!info) {
    return [];
  }
  const values = node.start.values || {};
  const bases = node.start.generatedBase || {};
  return (info.fields || []).map(field => {
    const generated = field.pattern != null ? generateValue(field, node, catalog) : null;
    const set = Object.prototype.hasOwnProperty.call(values, field.key);
    const value = set ? values[field.key] ?? '' : generated ?? '';
    const overwritten = field.pattern != null && set && value !== (generated ?? '');
    const stale = overwritten && Object.prototype.hasOwnProperty.call(bases, field.key) && bases[field.key] !== (generated ?? '');
    return { ...field, generated, value, overwritten, stale };
  });
}

const generatedOf = (node, key, catalog) => fieldStates(node, catalog).find(f => f.key === key)?.generated ?? '';

/** A typed value; one equal to the generated value is no overwrite, it keeps following the date and number. */
export function setFieldValue(node, key, value, catalog) {
  const start = node.start;
  start.values = start.values || {};
  start.generatedBase = start.generatedBase || {};
  const field = fieldStates(node, catalog).find(f => f.key === key);
  if (field && field.pattern != null && value === (field.generated ?? '')) {
    delete start.values[key];
    delete start.generatedBase[key];
  } else {
    start.values[key] = value;
    if (field && field.pattern != null) {
      start.generatedBase[key] = field.generated ?? '';
    }
  }
}

/** Keeps an overwritten value although the generated value changed: no hint until it changes again. */
export function keepFieldValue(node, key, catalog) {
  node.start.generatedBase = { ...(node.start.generatedBase || {}), [key]: generatedOf(node, key, catalog) };
}

/** Back to the generated value. */
export function resetFieldValue(start, key) {
  delete start.values[key];
  if (start.generatedBase) {
    delete start.generatedBase[key];
  }
}

/**
 * On a type change: the values the user entered in fields of the loaded type that the current type does not show. start.values
 * only holds entered values (generated ones that were not overwritten are dropped), blank ones are skipped. Mirrors
 * PluginConfiguration.userValuesLeftBehind.
 */
export function userValuesLeftBehind(start, catalog) {
  const loaded = catalog[start.originalType];
  if (!loaded || start.originalType === start.type) {
    return [];
  }
  const shown = new Set((catalog[start.type]?.fields || []).map(field => field.key));
  return (loaded.fields || [])
    .filter(field => !shown.has(field.key) && String(start.values?.[field.key] ?? '').trim())
    .map(field => ({ field, value: start.values[field.key] }));
}

/**
 * After loading: a stored value equal to the generated one is not an overwrite, it follows later changes of date or number. A loaded
 * overwrite is stale only after the generated value changes in this session.
 */
export function initFieldStates(pages, catalog) {
  for (const node of flatten(buildTree(pages).roots)) {
    const values = node.start.values = node.start.values || {};
    const bases = node.start.generatedBase = {};
    for (const field of fieldStates(node, catalog)) {
      if (field.pattern != null && !field.overwritten) {
        delete values[field.key];
      } else if (field.overwritten) {
        bases[field.key] = field.generated ?? '';
      }
    }
  }
}
