// Page labels in the plugin's notation: arabic with optional prefix/suffix, roman (lower or upper case), fictitious values in
// square brackets, `–` for unnumbered, anything else is free text. Free text and `–` do not count.

const NONE = '–';
const ROMAN = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']];
const ROMAN_VALUES = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };

function toRoman(number) {
  let out = '';
  for (const [value, symbol] of ROMAN) {
    while (number >= value) {
      out += symbol;
      number -= value;
    }
  }
  return out;
}

// the value of a lowercase roman numeral, 0 if it is not a canonical one (`iiii`)
function fromRoman(text) {
  let number = 0;
  for (let i = 0; i < text.length; i++) {
    const current = ROMAN_VALUES[text[i]];
    const following = ROMAN_VALUES[text[i + 1]] || 0;
    number += current < following ? -current : current;
  }
  return toRoman(number) === text ? number : 0;
}

function isNone(text) {
  return text === '-' || text === NONE || text === 'uncounted';
}

export function parseLabel(text) {
  let value = String(text ?? '').trim();
  if (value === '') {
    return { kind: 'empty', fictitious: false };
  }
  if (isNone(value)) {
    return { kind: 'none', fictitious: false };
  }
  let fictitious = false;
  const bracketed = value.match(/^\[(.*)\]$/);
  if (bracketed) {
    fictitious = true;
    value = bracketed[1].trim();
  }
  if (/^[ivxlcdm]+$/.test(value) && fromRoman(value)) {
    return { kind: 'roman', number: fromRoman(value), upper: false, fictitious };
  }
  if (/^[IVXLCDM]+$/.test(value) && fromRoman(value.toLowerCase())) {
    return { kind: 'roman', number: fromRoman(value.toLowerCase()), upper: true, fictitious };
  }
  const arabic = value.match(/^(.*?)(\d+)(\D*)$/);
  if (arabic) {
    return { kind: 'arabic', number: Number(arabic[2]), digits: arabic[2].length, prefix: arabic[1], suffix: arabic[3], fictitious };
  }
  return { kind: 'text', fictitious };
}

export function normalizeLabel(text) {
  const value = String(text ?? '').trim();
  if (isNone(value)) {
    return NONE;
  }
  return value.replace(/^\[\s*(.*?)\s*\]$/, '[$1]');
}

export function isCounting(text) {
  const kind = parseLabel(text).kind;
  return kind === 'arabic' || kind === 'roman';
}

export function nextLabel(text) {
  const label = parseLabel(text);
  let next;
  if (label.kind === 'arabic') {
    next = label.prefix + String(label.number + 1).padStart(label.digits, '0') + label.suffix; // keeps a zero padding (0001)
  } else if (label.kind === 'roman') {
    next = toRoman(label.number + 1);
    if (label.upper) {
      next = next.toUpperCase();
    }
  } else {
    return null;
  }
  return label.fictitious ? '[' + next + ']' : next;
}

export function follows(previous, label) {
  const next = nextLabel(previous);
  return next !== null && normalizeLabel(label) === next;
}
