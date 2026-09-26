// The sound engine (PLAN-3.md 3.2, 3.3): the graph and its lifecycle, knowing
// nothing about the night. night/score.js builds on it.
//
//   global ─┐
//   music ──┼─→ mix ─→ wow ─→ under ─→ master ─→ limiter ─→ out
//   scene ──┘                            ↑
//   ui ──────────────────────────────────┘
//
// `wow` bends the pitch like stretched tape during a melt (PLAN-3.md 4.3);
// `under` is a lowpass left wide open except in the Ocean (PLAN-3.md 5.5).
// ui sounds skip both on purpose — a button's click doesn't bend with the
// tape or go under water.

import { dbToGain, envelope, filter, gain, glideTo, oscillator, rampTo } from './synth';

const FADE_IN = 1; // turning sound on is never a hit (PLAN-3.md 3.2)
const FADE_BACK = 0.3; // coming back to the tab
const FADE_OUT = 0.3;

export const LAYERS = ['global', 'music', 'scene', 'ui'];

// The wow: an LFO swinging a short delay's time bends the pitch. Pitch swing
// ≈ 2π · rate · depth — at intensity 1, ±3.5% (≈ 60 cents) at 1.6 Hz.
const WOW_BASE = 0.02; // s of delay the swing moves around
const WOW_DEPTH = 0.0035; // s of swing at intensity 1
const WOW_RATE = [1.2, 0.8]; // Hz: base + per unit of intensity

export function createEngine(ctx, bus) {
  // A safety net, not part of the sound (PLAN-3.md 3.3): in normal use it
  // shouldn't act at all — the dev panel shows its reduction.
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  limiter.connect(ctx.destination);

  const master = gain(ctx, 0);
  master.connect(limiter);

  const under = filter(ctx, { type: 'lowpass', frequency: 20000, Q: 0.5 });
  under.connect(master);

  const wow = ctx.createDelay(0.1);
  wow.delayTime.value = WOW_BASE;
  wow.connect(under);
  const lfo = oscillator(ctx, { frequency: WOW_RATE[0] });
  const wowDepth = gain(ctx, 0);
  lfo.connect(wowDepth).connect(wow.delayTime);
  lfo.start();

  const mix = gain(ctx, 1);
  mix.connect(wow);

  const layers = Object.fromEntries(LAYERS.map(name => [name, gain(ctx, 1)]));
  layers.global.connect(mix);
  layers.music.connect(mix);
  layers.scene.connect(mix);
  layers.ui.connect(master);

  // Who wants to know when the engine goes quiet (suspended) and loud again —
  // the tape pauses its <audio> then, or it would keep running in silence.
  const quietListeners = new Set();
  const loudListeners = new Set();
  let stopTimer = 0;

  function fadeIn(seconds) {
    clearTimeout(stopTimer);
    ctx.resume();
    rampTo(master.gain, 1, seconds, ctx);
    loudListeners.forEach(listener => listener());
  }

  // Fade, then suspend: a suspended context costs no CPU. Only if sound is
  // still off (or the tab still hidden) when the fade ends.
  function fadeOutAndSuspend(stillQuiet) {
    clearTimeout(stopTimer);
    rampTo(master.gain, 0, FADE_OUT, ctx);
    stopTimer = setTimeout(() => {
      if (!stillQuiet()) return;
      quietListeners.forEach(listener => listener());
      ctx.suspend();
    }, FADE_OUT * 1000 + 50);
  }

  // A hidden tab goes quiet; coming back resumes only if sound is on.
  const onVisibility = () => {
    if (document.hidden) fadeOutAndSuspend(() => document.hidden || !bus.isOn());
    else if (bus.isOn()) fadeIn(FADE_BACK);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // One melt's wow: depth rises to its middle and falls back, faster and
  // deeper the later in the night (intensity 0.45 → 1.25).
  function melt(duration, intensity) {
    const t = ctx.currentTime;
    lfo.frequency.setValueAtTime(WOW_RATE[0] + WOW_RATE[1] * intensity, t);
    const depth = wowDepth.gain;
    const current = depth.value;
    depth.cancelScheduledValues(t);
    depth.setValueAtTime(current, t);
    depth.linearRampToValueAtTime(WOW_DEPTH * intensity, t + duration / 2);
    depth.linearRampToValueAtTime(0, t + duration);
  }

  // Under water, 0 (the surface is below your ears) to 1 (well under): the
  // lowpass on everything but the ui closes down to ~500 Hz, as ears do.
  function setUnder(u) {
    glideTo(under.frequency, 20000 * (500 / 20000) ** u, 0.05, ctx);
  }

  // The dev panel's test tone (phase 0), still handy to check the chain.
  function testTone() {
    const t = ctx.currentTime + 0.01;
    const voice = gain(ctx, 0);
    voice.connect(layers.scene);
    const low = oscillator(ctx, { frequency: 220 });
    const high = oscillator(ctx, { type: 'triangle', frequency: 440 });
    const highLevel = gain(ctx, 0.25);
    low.connect(voice);
    high.connect(highLevel).connect(voice);
    const end = envelope(voice.gain, { attack: 0.02, decay: 0.4, sustain: 0.35, hold: 0.3, release: 0.8, peak: dbToGain(-22) }, t);
    [low, high].forEach(osc => {
      osc.start(t);
      osc.stop(end);
    });
    low.onended = () => voice.disconnect();
  }

  return {
    ctx,
    nodes: { layers, mix, wow, wowDepth, under, master, limiter },
    start: () => fadeIn(FADE_IN),
    stop: () => fadeOutAndSuspend(() => !bus.isOn()),
    melt,
    setUnder,
    testTone,
    onQuiet(listener) {
      quietListeners.add(listener);
      return () => quietListeners.delete(listener);
    },
    onLoud(listener) {
      loudListeners.add(listener);
      return () => loudListeners.delete(listener);
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      ctx.close();
    }
  };
}
