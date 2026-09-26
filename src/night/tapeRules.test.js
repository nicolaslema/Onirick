import assert from 'node:assert/strict';
import { test } from 'node:test';

import { BURN_STOP_SECONDS, tapeCue } from './tapeRules.js';

// The night's DR-1 states, as in config.js.
const STATES = { hero: 'standby', stair: 'rec', whale: 'rec', house: 'rec', manual: 'standby', ocean: 'rec', fall: 'rec', wake: 'stop' };
const stateOf = id => STATES[id];

const settled = id => ({ currentId: id, settled: true, transition: null });
const moving = (fromId, toId, extra = {}) => ({
  currentId: fromId,
  settled: false,
  transition: { fromId, toId, kind: 'melt', duration: 1.5, intensity: 0.65, burn: 0, ...extra }
});

test('falling asleep: the tape starts under the first melt, with its wow', () => {
  const next = moving('hero', 'stair', { duration: 1.6, intensity: 0.45 });
  const cue = tapeCue(settled('hero'), next, stateOf);
  assert.equal(cue.tape, 'start');
  assert.deepEqual(cue.wow, { duration: 1.6, intensity: 0.45 });
  assert.equal(cue.rewind, false);
  assert.equal(cue.standby, false);
});

test('into the manual: a crossfade, the tape stops, no wow, standby hum', () => {
  const next = moving('house', 'manual', { kind: 'plain', duration: 0.45, intensity: 0 });
  const cue = tapeCue(settled('house'), next, stateOf);
  assert.equal(cue.tape, 'stop');
  assert.equal(cue.wow, null);
  assert.equal(cue.delay, 0);
  assert.equal(cue.standby, true);
});

test('out of the manual into a dream: the tape starts again', () => {
  const cue = tapeCue(settled('manual'), moving('manual', 'ocean', { kind: 'plain', duration: 1.2 }), stateOf);
  assert.equal(cue.tape, 'start');
});

test('the burn into Wake stops the tape abruptly, silent by the white', () => {
  const next = moving('fall', 'wake', { duration: 2.2, intensity: 1.25, burn: 1 });
  const cue = tapeCue(settled('fall'), next, stateOf);
  assert.equal(cue.tape, 'stop');
  assert.equal(cue.seconds, BURN_STOP_SECONDS);
  // it has stopped exactly at the melt's middle (the white)
  assert.ok(Math.abs(cue.delay + cue.seconds - 2.2 / 2) < 1e-9);
  assert.deepEqual(cue.wow, { duration: 2.2, intensity: 1.25 });
});

test('arriving at Wake: STOP and eject', () => {
  const cue = tapeCue(moving('fall', 'wake', { burn: 1 }), settled('wake'), stateOf);
  assert.equal(cue.stopAndEject, true);
  assert.equal(cue.tape, 'stop');
});

test('Wake back to the hero rewinds the tape', () => {
  const cue = tapeCue(settled('wake'), moving('wake', 'hero', { kind: 'plain', duration: 1.2 }), stateOf);
  assert.equal(cue.rewind, true);
  assert.equal(cue.tape, 'stop');
  assert.equal(cue.standby, true);
});

test('arriving at a dream settles the tape running; arriving at the hero, stopped', () => {
  assert.equal(tapeCue(moving('hero', 'stair'), settled('stair'), stateOf).tape, 'start');
  assert.equal(tapeCue({ currentId: null, settled: true, transition: null }, settled('hero'), stateOf).tape, 'stop');
});

test('the same transition seen twice cues nothing the second time', () => {
  const next = moving('stair', 'whale');
  const again = { ...next };
  const cue = tapeCue(next, again, stateOf);
  assert.equal(cue.tape, null);
  assert.equal(cue.wow, null);
});

test('stepping between two dreams keeps the tape running', () => {
  const cue = tapeCue(settled('stair'), moving('stair', 'whale'), stateOf);
  assert.equal(cue.tape, 'start'); // start() is a no-op on a running tape
  assert.equal(cue.stopAndEject, false);
});
