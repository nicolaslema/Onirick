// Synthesis primitives (PLAN-3.md 2.1): everything the night will sound like
// is built from these — noise generated in code, oscillators, envelopes, a
// reverb whose impulse response is itself generated noise. No audio files.
//
// Rule for anything that's already sounding (PLAN-3.md 3.3): change it with a
// ramp, never by assigning .value — a jump in gain or frequency is a click.

import { seeded } from '../three/random.js';

// Starting a ramp from where a param actually is right now, whatever was
// scheduled on it before: read its current value, cancel, pin it there.
// Not cancelAndHoldAtTime — in Chrome, once the previous ramp has finished,
// a ramp after it jumps (measured offline: gain 1 → 0.33 in one sample, a
// click); it isn't in Firefox either.
function hold(param, t) {
  const current = param.value;
  param.cancelScheduledValues(t);
  param.setValueAtTime(current, t);
}

// Linear ramp to `value` over `seconds`, from wherever the param is now.
export function rampTo(param, value, seconds, ctx) {
  const t = ctx.currentTime;
  hold(param, t);
  param.linearRampToValueAtTime(value, t + Math.max(seconds, 0.005));
}

// Exponential-style approach (setTargetAtTime): reaches ~95% in 3 × timeConstant.
// For continuous values that keep changing (a filter following a param).
export function glideTo(param, value, timeConstant, ctx) {
  const t = ctx.currentTime;
  hold(param, t);
  param.setTargetAtTime(value, t, Math.max(timeConstant, 0.001));
}

export const dbToGain = db => 10 ** (db / 20);
export const gainToDb = gain => (gain > 0 ? 20 * Math.log10(gain) : -Infinity);

// Seeded, so the noise is the same on every load (like three/random.js for
// the city): a sound that changes between visits is a bug to chase.
const buffers = new WeakMap();

function cached(ctx, key, make) {
  let byKey = buffers.get(ctx);
  if (!byKey) buffers.set(ctx, (byKey = new Map()));
  if (!byKey.has(key)) byKey.set(key, make());
  return byKey.get(key);
}

// A few seconds of noise, looped. Pink (-3 dB/octave, Paul Kellet's filter)
// sounds like tape hiss and wind; white is harsher, for short transients.
export function noiseBuffer(ctx, color = 'white', seconds = 4) {
  return cached(ctx, `${color}:${seconds}`, () => {
    const length = Math.round(ctx.sampleRate * seconds);
    // 10 ms more than the loop, to hide its seam (below).
    const seam = Math.round(ctx.sampleRate * 0.01);
    const raw = new Float32Array(length + seam);
    const random = seeded(color === 'pink' ? 0x5eed : 0xacc01);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < raw.length; i++) {
      const white = random() * 2 - 1;
      if (color !== 'pink') {
        raw[i] = white;
        continue;
      }
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      raw[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    data.set(raw.subarray(0, length));
    // The loop's seam: the first 10 ms fade in from what would have come right
    // after the last sample, so sample 0 continues sample length-1 exactly.
    for (let i = 0; i < seam; i++) {
      const k = i / seam;
      data[i] = raw[i] * k + raw[length + i] * (1 - k);
    }
    return buffer;
  });
}

export function noise(ctx, color = 'white') {
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx, color);
  source.loop = true;
  return source;
}

export function oscillator(ctx, { type = 'sine', frequency = 440, detune = 0 } = {}) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.detune.value = detune;
  return osc;
}

export function filter(ctx, { type = 'lowpass', frequency = 1000, Q = 0.7071, gain = 0 } = {}) {
  const node = ctx.createBiquadFilter();
  node.type = type;
  node.frequency.value = frequency;
  node.Q.value = Q;
  node.gain.value = gain;
  return node;
}

export function gain(ctx, value = 1) {
  const node = ctx.createGain();
  node.gain.value = value;
  return node;
}

// A one-shot envelope on a gain param, starting at `t`: attack to `peak`,
// exponential-ish decay to `sustain`, held, then release to silence.
// Returns when it's silent (to stop the source after it).
export function envelope(param, { attack = 0.01, decay = 0.1, sustain = 0, hold: holdFor = 0, release = 0.2, peak = 1 }, t) {
  param.cancelScheduledValues(t);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(peak, t + attack);
  param.setTargetAtTime(sustain * peak, t + attack, Math.max(decay / 3, 0.001));
  const releaseAt = t + attack + decay + holdFor;
  param.setTargetAtTime(0, releaseAt, Math.max(release / 3, 0.001));
  return releaseAt + release * 1.5;
}

// A synthetic room: a stereo impulse response of noise with an exponential
// decay, darkened over time (high frequencies die first, as in a real space).
export function reverbImpulse(ctx, { seconds = 2.5, decay = 3, darken = 0.6 } = {}) {
  return cached(ctx, `ir:${seconds}:${decay}:${darken}`, () => {
    const length = Math.round(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      const random = seeded(0x7e7e + channel);
      let last = 0;
      for (let i = 0; i < length; i++) {
        const k = i / length;
        // One-pole lowpass whose smoothing grows with time: the tail darkens.
        const smooth = darken * k;
        last = last * smooth + (random() * 2 - 1) * (1 - smooth);
        data[i] = last * (1 - k) ** decay;
      }
    }
    return buffer;
  });
}

export function reverb(ctx, options) {
  const node = ctx.createConvolver();
  node.buffer = reverbImpulse(ctx, options);
  return node;
}
