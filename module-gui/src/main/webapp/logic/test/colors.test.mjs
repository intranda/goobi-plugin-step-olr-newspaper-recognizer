import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHILD_COLORS, positionColor } from '../colors.mjs';

test('positionColor uses the colours of nested types and repeats them', () => {
  assert.equal(positionColor(0), CHILD_COLORS[0]);
  assert.equal(positionColor(1), CHILD_COLORS[1]);
  assert.equal(positionColor(CHILD_COLORS.length), CHILD_COLORS[0]);
});
