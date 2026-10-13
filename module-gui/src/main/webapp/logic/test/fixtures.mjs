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

/** Depth and number of starts per page, for compact assertions. */
export const shape = list => list.map(p => `${p.depth}/${p.starts.length}`).join(' ');
