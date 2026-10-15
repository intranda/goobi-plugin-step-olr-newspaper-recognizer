import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTree, flatten, setType, toSaveRequest, validateBlocks } from '../blocks.mjs';
import { applyResolution, findConflicts } from '../hidden.mjs';
import { fieldStates, formatJavaDate, generateValue, initFieldStates } from '../fields.mjs';
import { catalog as base, pages, start, VOLUME } from './fixtures.mjs';

const field = (key, pattern = null, extra = {}) => ({ key, label: key, display: 'input', required: false, pattern, skipIfEmpty: false, items: [], ...extra });

// the fixture catalog with fields and the labels the {label} placeholder uses (RulesetTypes.GENERATOR_LANGUAGE)
const catalog = Object.fromEntries(Object.entries(base).map(([name, info]) => [name, { ...info, generatorLabel: info.label, fields: [] }]));
catalog.EveningIssue.label = 'Evening issue';
catalog.MorningIssue.fields = [field('TitleDocMain', 'Morgenausgabe {partNo} vom {date:dd.MM.yyyy}'), field('Note')];
catalog.Article.fields = [field('TitleDocMain', null, { required: true })];

/** The innermost node of a level-0 block with an optional child block (as in ValueGeneratorTest). */
function block(parent, child = null) {
  const list = child ? pages({ depth: 1, starts: [parent] }, { depth: 2, starts: [child] }) : pages({ depth: 1, starts: [parent] });
  const roots = buildTree(list).roots;
  return child ? roots[0].children[0] : roots[0];
}

const issue = (type, date, prefix, number, suffix) => start(type, { date, prefix, number, suffix });
const generate = (node, pattern, skipIfEmpty = false) => generateValue({ pattern, skipIfEmpty }, node, catalog);

test('generateValue mirrors ValueGenerator: constants, own values, part numbers', () => {
  assert.equal(generate(block(start('TableOfContents')), 'Inhaltsverzeichnis'), 'Inhaltsverzeichnis');
  assert.equal(generate(block(issue('MorningIssue', '1890-03-01', null, '12', null)), 'Morgenausgabe {no} vom {date:dd.MM.yyyy}'), 'Morgenausgabe 12 vom 01.03.1890');
  assert.equal(generate(block(issue('MorningIssue', null, 'Nr. ', '12', 'a')), '{partNo}'), 'Nr. 12a');
});

test('generateValue takes values from enclosing blocks, parent placeholders only from the direct parent', () => {
  const morning = () => issue('MorningIssue', '1890-03-01', null, '12', null);
  assert.equal(generate(block(morning(), start('NewspaperSupplement')), 'Beilage zur {no}. Ausgabe vom {date:dd.MM.yyyy}'), 'Beilage zur 12. Ausgabe vom 01.03.1890');
  assert.equal(generate(block(morning(), start('TableOfContents')), '{parent.no} {parent.label}'), '12 Morgenausgabe');
  assert.equal(generate(block(morning()), '{parent.no}'), '[MISSING]');
});

test('generateValue uses the generator label, marks or skips missing values, ignores values of types without the field', () => {
  assert.equal(generate(block(start('EveningIssue')), '{label}'), 'Abendausgabe');
  assert.equal(generate(block(start('MorningIssue')), 'Nr. {no}'), 'Nr. [MISSING]');
  assert.equal(generate(block(start('MorningIssue')), '{no}', true), null);
  assert.equal(generate(block(start('TableOfContents', { number: '5', date: '1890-03-01' })), '{no} {date:yyyy}'), '[MISSING] [MISSING]');
  assert.equal(generate(block(issue('MorningIssue', '1890-03-01', null, null, null)), '{date:ppp}'), '[MISSING]');
});

test('formatJavaDate supports d, dd, M, MM, yy, yyyy and quoted literals', () => {
  const date = { y: 1890, m: 3, d: 1 };
  assert.equal(formatJavaDate(date, 'd.M.yy'), '1.3.90');
  assert.equal(formatJavaDate(date, "d. 'Tag' MM yyyy"), '1. Tag 03 1890');
  assert.equal(formatJavaDate(date, "dd''MM"), "01'03");
  assert.equal(formatJavaDate(date, 'MMMM'), null);
});

test('fieldStates: generated values follow the block, overwritten values are kept and flagged', () => {
  const morning = issue('MorningIssue', '1890-03-01', 'Nr. ', '12', null);
  const node = block(morning);
  assert.deepEqual(fieldStates(node, catalog).map(f => [f.key, f.value, f.generated, f.overwritten]), [
    ['TitleDocMain', 'Morgenausgabe Nr. 12 vom 01.03.1890', 'Morgenausgabe Nr. 12 vom 01.03.1890', false],
    ['Note', '', null, false],
  ]);
  morning.values = { TitleDocMain: 'Sonderausgabe', Note: 'Beschädigt' };
  assert.deepEqual(fieldStates(node, catalog).map(f => [f.key, f.value, f.overwritten]), [
    ['TitleDocMain', 'Sonderausgabe', true],
    ['Note', 'Beschädigt', false],
  ]);
  assert.deepEqual(fieldStates(block(start(null)), catalog), []);
});

test('initFieldStates forgets stored values equal to the generated value, so they follow later changes', () => {
  const list = pages(
    { depth: 1, starts: [issue('MorningIssue', '1890-03-01', null, '1', null)] },
    { depth: 1, starts: [issue('MorningIssue', '1890-03-02', null, '2', null)] });
  list[0].starts[0].values = { TitleDocMain: 'Morgenausgabe 1 vom 01.03.1890', Note: 'Notiz' };
  list[1].starts[0].values = { TitleDocMain: 'Sonderausgabe' };
  initFieldStates(list, catalog);
  assert.deepEqual(list.map(p => p.starts[0].values), [{ Note: 'Notiz' }, { TitleDocMain: 'Sonderausgabe' }]);
});

test('validateBlocks flags required visible fields without value, a generated value counts', () => {
  const article = start('Article');
  const list = pages({ depth: 3, starts: [issue('MorningIssue', '1890-03-01', null, '1', null), start('NewspaperSupplement'), article] });
  assert.deepEqual(validateBlocks(list, catalog, VOLUME, false).missingRequired, [{ page: 0, level: 2 }]);
  article.values = { TitleDocMain: ' Leitartikel ' };
  assert.equal(validateBlocks(list, catalog, VOLUME, false).valid, true);
  catalog.Article.fields = [field('TitleDocMain', 'Artikel', { required: true })];
  article.values = {};
  assert.equal(validateBlocks(list, catalog, VOLUME, false).valid, true);
  catalog.Article.fields = [field('TitleDocMain', null, { required: true })];
});

test('toSaveRequest with the catalog sends the value shown for every visible field of the type', () => {
  const morning = issue('MorningIssue', '1890-03-01', null, '1', null);
  morning.values = { Note: 'Notiz', CurrentNoSorting: 'not a visible field' };
  const list = pages({ depth: 1, starts: [morning] }, { depth: 1, starts: [start(null, { values: { Note: 'x' } })] });
  const request = JSON.parse(toSaveRequest(list, [], catalog));
  assert.deepEqual(request.pages.map(p => p.starts[0].values), [{ TitleDocMain: 'Morgenausgabe 1 vom 01.03.1890', Note: 'Notiz' }, {}]);
  assert.equal(flatten(buildTree(list).roots).length, 2);
});

/** A loaded MorningIssue (id b1) with the given field values, and the same pages after changing its type to EveningIssue. */
function morningToEvening(values) {
  const before = pages({ depth: 1, starts: [issue('MorningIssue', '1890-03-01', null, '1', null)] });
  Object.assign(before[0].starts[0], { id: 'b1', originalType: 'MorningIssue', values });
  return { before, after: setType(before, { page: 0, level: 0 }, 'EveningIssue', catalog) };
}

test('type change: values the user entered in fields the new type does not show are sent, generated and blank ones not', () => {
  const { after } = morningToEvening({ Note: 'Beschädigt', TitleDocMain: ' ' });
  assert.deepEqual(JSON.parse(toSaveRequest(after, [], catalog)).pages[0].starts[0].values, { Note: 'Beschädigt' });
});

test('type change: a value the user entered that the new type does not allow is part of the type conflict', () => {
  const { before, after } = morningToEvening({ Note: 'Beschädigt' });
  const [conflict] = findConflicts(before, after, catalog, VOLUME);
  assert.equal(conflict.kind, 'TYPE');
  assert.deepEqual(conflict.metadata, [{ key: 'field:Note', type: 'Note', label: 'Note', value: 'Beschädigt' }]);
  applyResolution(after, conflict, 'KEEP_ALLOWED', catalog, VOLUME);
  assert.deepEqual(after[0].starts[0].values, {});
  assert.deepEqual(findConflicts(before, morningToEvening({ Note: '' }).after, catalog, VOLUME), []);
});
