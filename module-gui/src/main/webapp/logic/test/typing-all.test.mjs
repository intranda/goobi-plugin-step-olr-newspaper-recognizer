import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ownNumbering, ownNumberingAll, followValue } from '../typing.mjs';
import { pages, start, settings } from './fixtures.mjs';

const I = (type, label = '') => ({ label, depth: 1, starts: [start(type)] });
const p = (label = '', depth = 1) => ({ label, depth });

test('ownNumberingAll: agrees with ownNumbering per page and gives the follow value of pages with own numbering', () => {
  const list = pages(I('MorningIssue', '1'), p('2'), p('3'), p('9'), p('10'), I('MorningIssue', '1'), p('2'), p('7'), { label: '', depth: 0 }, p('Titelblatt', 0));
  const config = settings();
  const all = ownNumberingAll(list, config);
  assert.deepEqual(all.map(Boolean), list.map((page, i) => ownNumbering(list, config, i)));
  assert.equal(all[3], '4');
  assert.equal(all[3], followValue(list, config, 3));
  assert.equal(all[7], '3');
  assert.equal(all[0], null);
});
