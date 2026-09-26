// The sound engine (PLAN-3.md 3.2, 3.3), loaded only when someone turns sound
// on. It owns the graph and its lifecycle; what each section sounds like
// arrives in later phases (night/score.js).
//
//   global ──┐
//   ambience ┼─→ mix ─→ master ─→ limiter ─→ out
//   scene ───┘           ↑
//   ui ──────────────────┘
//
// `mix` is where the melt's wow goes in phase 1 (PLAN-3.md 4.3); ui sounds
// skip it on purpose — a button's click doesn't bend with the tape.

import { dbToGain, envelope, filter, gain, noise, oscillator, rampTo } from './synth';

const FADE_IN = 1; // turning sound on is never a hit (PLAN-3.md 3.2)
const FADE_BACK = 0.3; // coming back to the tab
const FADE_OUT = 0.3;

export const LAYERS = ['global', 'ambience', 'scene', 'ui'];

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
  const mix = gain(ctx, 1);
  mix.connect(master);

  const layers = Object.fromEntries(LAYERS.map(name => [name, gain(ctx, 1)]));
  layers.global.connect(mix);
  layers.ambience.connect(mix);
  layers.scene.connect(mix);
  layers.ui.connect(master);

  let stopTimer = 0;

  function fadeIn(seconds) {
    clearTimeout(stopTimer);
    ctx.resume();
    rampTo(master.gain, 1, seconds, ctx);
  }

  // Fade, then suspend: a suspended context costs no CPU. Only if sound is
  // still off (or the tab still hidden) when the fade ends.
  function fadeOutAndSuspend(stillQuiet) {
    clearTimeout(stopTimer);
    rampTo(master.gain, 0, FADE_OUT, ctx);
    stopTimer = setTimeout(() => {
      if (stillQuiet()) ctx.suspend();
    }, FADE_OUT * 1000 + 50);
  }

  // A hidden tab goes quiet; coming back resumes only if sound is on.
  const onVisibility = () => {
    if (document.hidden) fadeOutAndSuspend(() => document.hidden || !bus.isOn());
    else if (bus.isOn()) fadeIn(FADE_BACK);
  };
  document.addEventListener('visibilitychange', onVisibility);

  // Phase 0's only sounds: a test tone (a one-off) and a test hum (held), so
  // the lifecycle can be checked for clicks before anything real exists.
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

  let hum = null;
  function testHum(enabled) {
    if (enabled && !hum) {
      const level = gain(ctx, 0);
      level.connect(layers.ambience);
      const hiss = noise(ctx, 'pink');
      const tone = oscillator(ctx, { frequency: 110 });
      const toneLevel = gain(ctx, dbToGain(-6));
      hiss.connect(filter(ctx, { frequency: 1200 })).connect(level);
      tone.connect(toneLevel).connect(level);
      hiss.start();
      tone.start();
      rampTo(level.gain, dbToGain(-30), 0.5, ctx);
      hum = { level, sources: [hiss, tone] };
    } else if (!enabled && hum) {
      const { level, sources } = hum;
      hum = null;
      rampTo(level.gain, 0, 0.5, ctx);
      sources.forEach(source => source.stop(ctx.currentTime + 0.6));
      sources[0].onended = () => level.disconnect();
    }
  }

  const CUES = { test: testTone };

  return {
    ctx,
    nodes: { layers, mix, master, limiter },
    start: () => fadeIn(FADE_IN),
    stop: () => fadeOutAndSuspend(() => !bus.isOn()),
    cue(name, options) {
      CUES[name]?.(options);
    },
    testHum,
    get humming() {
      return !!hum;
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      testHum(false);
      ctx.close();
    }
  };
}
