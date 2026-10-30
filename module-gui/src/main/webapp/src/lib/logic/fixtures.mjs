export const VOLUME = 'NewspaperVolume';

const type = (name, label, flags, children, allowedMetadata, managedMetadata = []) => ({
  name, label, dated: false, numbered: false, partNumbered: false, dateRequired: false, numberRequired: false,
  ...flags, children, allowedMetadata, managedMetadata,
});

export const catalog = {
  NewspaperVolume: type('NewspaperVolume', 'Zeitungsband', {}, ['MorningIssue', 'EveningIssue', 'ExtraEdition', 'TableOfContents'], ['TitleDocMain']),
  MorningIssue: type('MorningIssue', 'Morgenausgabe', { dated: true, numbered: true, partNumbered: true, dateRequired: true },
    ['NewspaperSupplement', 'TableOfContents'], ['DateIssued', 'CurrentNo', 'CurrentNoSorting', 'PartNumber', 'TitleDocMain', 'Note'],
    ['DateIssued', 'CurrentNo', 'PartNumber', 'TitleDocMain']),
  EveningIssue: type('EveningIssue', 'Abendausgabe', { dated: true, numbered: true, partNumbered: true },
    ['NewspaperSupplement'], ['DateIssued', 'CurrentNo', 'CurrentNoSorting', 'PartNumber', 'TitleDocMain'],
    ['DateIssued', 'CurrentNo', 'PartNumber']),
  ExtraEdition: type('ExtraEdition', 'Extrablatt', { numbered: true, numberRequired: true }, [], ['CurrentNo', 'TitleDocMain'], ['CurrentNo']),
  NewspaperSupplement: type('NewspaperSupplement', 'Beilage', {}, ['Article'], ['TitleDocMain', 'Note']),
  TableOfContents: type('TableOfContents', 'Inhaltsverzeichnis', {}, [], ['TitleDocMain']),
  Article: type('Article', 'Artikel', {}, [], ['TitleDocMain', 'Note']),
};

export function start(type, values = {}) {
  return {
    id: null, type, date: null, dateRaw: null, dateInput: '', prefix: null, number: null, suffix: null,
    hidden: { structures: [], metadata: [] }, originalType: null, ...values,
  };
}

/** pages({depth: 1, starts: [start('MorningIssue')]}, {depth: 1}) → page list with file names 0001.tif, 0002.tif, … */
export function pages(...specs) {
  return specs.map((spec, i) => ({ filename: `${String(i + 1).padStart(4, '0')}.tif`, result: 0, ...spec, depth: spec.depth || 0, starts: spec.starts || [] }));
}

/** A page that starts a top-level block of type (null: untyped). */
export const I = (type, label = '') => ({ label, depth: 1, starts: [start(type)] });
/** A page inside the open blocks, depth 1 by default. */
export const p = (label = '', depth = 1) => ({ label, depth });
/** A page that starts a block of type nested in a top-level block. */
export const C = (type, label = '') => ({ label, depth: 2, starts: [start(type)] });

/** Depth and number of starts per page, for compact assertions. */
export const shape = list => list.map(p => `${p.depth}/${p.starts.length}`).join(' ');

export const DEFAULT_RULES = {
  MorningIssue: { beginsWith: ['1'] },
  EveningIssue: { beginsWith: ['1'] },
  ExtraEdition: { beginsWith: ['1'] },
  NewspaperSupplement: { beginsWith: ['i'] },
};

/** Pagination settings as the server sends them; extra overrides single fields (e.g. {automatic: false}). */
export const settings = (rules = DEFAULT_RULES, extra = {}) => ({ enabled: true, automatic: true, withoutBlock: ['–'], rules, ...extra });

/** Page labels on one line, empty labels as '·'. */
export const labels = list => list.map(p => p.label || '·').join(' ');

/** New page list with an unlabelled page inserted at index, at the depth of the page before it and with the next free file name. */
export function insertPage(list, index) {
  const filename = `${String(list.length + 1).padStart(4, '0')}.tif`;
  const page = { filename, result: 0, label: '', depth: list[index - 1].depth, starts: [] };
  return [...list.slice(0, index), page, ...list.slice(index)];
}

const generated = (key, pattern) => ({ key, label: key, display: 'input', required: false, pattern, skipIfEmpty: false, items: [] });

/** The catalog with visible fields: MorningIssue has a generated TitleDocMain ('{label} {partNo}') and a plain Note. */
export const fieldCatalog = Object.fromEntries(Object.entries(catalog).map(([name, info]) => [name, { ...info, generatorLabel: info.label, fields: [] }]));
fieldCatalog.MorningIssue.fields = [generated('TitleDocMain', '{label} {partNo}'), generated('Note', null)];
