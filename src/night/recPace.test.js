import assert from 'node:assert/strict';
import { test } from 'node:test';

import { REC_PERIOD, recPeriodAt } from './recPace.js';

test("the alarm's pace: 1.2 s at the Fall's top, recTo at its bottom", () => {
  assert.equal(recPeriodAt(0, 0.3), REC_PERIOD);
  assert.ok(Math.abs(recPeriodAt(1, 0.3) - 0.3) < 1e-9);
  assert.ok(Math.abs(recPeriodAt(0.5, 0.3) - 0.75) < 1e-9);
});

test('out of range is clamped; without recTo the pace never changes', () => {
  assert.equal(recPeriodAt(-1, 0.3), REC_PERIOD);
  assert.ok(Math.abs(recPeriodAt(2, 0.3) - 0.3) < 1e-9);
  assert.equal(recPeriodAt(0.8, undefined), REC_PERIOD);
});
