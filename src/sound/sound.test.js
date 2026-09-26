import assert from 'node:assert/strict';
import { test } from 'node:test';

import { cue, getEngine, getParam, isOn, param, subscribe } from './bus.js';
import { dbToGain, gainToDb, noiseBuffer } from './synth.js';

test('with sound off, cue and param do nothing', () => {
  assert.equal(isOn(), false);
  assert.equal(getEngine(), null);
  cue('test');
  param('ocean.under', 1);
  assert.equal(getParam('ocean.under'), 0);
  assert.equal(getParam('ocean.under', 0.5), 0.5);
});

test('subscribe returns an unsubscribe', () => {
  const unsubscribe = subscribe(() => {});
  assert.equal(typeof unsubscribe, 'function');
  unsubscribe();
});

test('dB and gain convert both ways', () => {
  assert.equal(dbToGain(0), 1);
  assert.ok(Math.abs(dbToGain(-6) - 0.501) < 0.001);
  assert.ok(Math.abs(gainToDb(dbToGain(-24)) + 24) < 1e-9);
  assert.equal(gainToDb(0), -Infinity);
});

// Just enough of an AudioContext to build buffers.
const fakeContext = () => ({
  sampleRate: 8000,
  createBuffer(channels, length) {
    const data = Array.from({ length: channels }, () => new Float32Array(length));
    return { length, getChannelData: channel => data[channel] };
  }
});

for (const color of ['white', 'pink']) {
  test(`${color} noise is seeded and bounded`, () => {
    const a = noiseBuffer(fakeContext(), color, 1).getChannelData(0);
    const b = noiseBuffer(fakeContext(), color, 1).getChannelData(0);
    assert.deepEqual(a, b);
    let peak = 0;
    let sumSq = 0;
    for (const x of a) {
      peak = Math.max(peak, Math.abs(x));
      sumSq += x * x;
    }
    assert.ok(peak <= 1, `peak ${peak}`);
    assert.ok(Math.sqrt(sumSq / a.length) > 0.05, 'not silent');
  });
}
test('the same context reuses its noise buffer', () => {
  const ctx = fakeContext();
  assert.equal(noiseBuffer(ctx, 'pink', 1), noiseBuffer(ctx, 'pink', 1));
});
