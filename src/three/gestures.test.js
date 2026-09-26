import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createWaveDetector } from './gestures.js';

// Feeds a detector samples along straight legs between the given x stops,
// at 60 fps, `legMs` per leg. Returns the times (ms) it fired at.
function run(stops, legMs, options) {
  const detect = createWaveDetector(options);
  const fired = [];
  const step = 1000 / 60;
  let t = 0;
  detect(stops[0], t);
  for (let i = 1; i < stops.length; i++) {
    const frames = Math.max(1, Math.round(legMs / step));
    for (let f = 1; f <= frames; f++) {
      t += step;
      const x = stops[i - 1] + ((stops[i] - stops[i - 1]) * f) / frames;
      if (detect(x, t)) fired.push(t);
    }
  }
  return fired;
}

test('a quick side-to-side shake is a wave', () => {
  // right, left, right, left: three changes of direction in ~1 s
  assert.equal(run([0, 0.2, -0.2, 0.2, -0.2], 250).length, 1);
});

test('moving across the screen and back once is not a wave', () => {
  assert.equal(run([-0.8, 0.8, -0.8], 400).length, 0);
});

test('the same shake spread over too long is not a wave', () => {
  assert.equal(run([0, 0.2, -0.2, 0.2, -0.2], 900).length, 0);
});

test('jitter smaller than minAmp is not a wave', () => {
  assert.equal(run([0, 0.03, -0.02, 0.03, -0.02, 0.03, -0.02], 80).length, 0);
});

test('it starts over after a wave, so a long shake fires once per three turns', () => {
  const shake = [0];
  for (let i = 0; i < 8; i++) shake.push(i % 2 ? -0.2 : 0.2);
  // turns 1-3 fire; the restart's first leg only sets a direction, so turns 5-7 fire again
  assert.equal(run(shake, 200).length, 2);
});
