// The dreams' one-offs (PLAN-3.md 5), synthesized: each tied to something the
// scene does, in the same frame it does it. Phase 2: the Staircase's steps and
// the whale's call. Everything goes into the scene layer, so a melt bends it
// with the tape (PLAN-3.md 4.3).
//
// The music (≈ −46 dB RMS) masked the first cut of these (user, phase 2):
// they share its low register, and a laptop's or phone's speakers barely
// play below ~120 Hz. So each carries its weight in the mids too, and the
// whale's call ducks the music (score.js).

import { dbToGain, envelope, filter, gain, noise, oscillator, reverb } from '../sound/synth';

export const LEVELS = {
  step: dbToGain(-32), // a step's peak, before its echo
  stepEcho: 0.35, // send into the stairwell
  whale: dbToGain(-28),
  whaleSpace: 0.55 // send into the open night
};

const vary = amount => 1 + (Math.random() * 2 - 1) * amount;

export function createDreamSounds(ctx, scene) {
  // Two spaces: a stone stairwell, and the sky over the city.
  const stairwell = reverb(ctx, { seconds: 2.4, decay: 3.2, darken: 0.7 });
  const stairwellLevel = gain(ctx, LEVELS.stepEcho);
  stairwell.connect(stairwellLevel).connect(scene);
  const sky = reverb(ctx, { seconds: 4.5, decay: 2.2, darken: 0.5 });
  const skyLevel = gain(ctx, LEVELS.whaleSpace);
  sky.connect(skyLevel).connect(scene);

  // One voice: `source` → `shape` (a node, or [first, last] of a chain) → a
  // level with an envelope → dry out and a send into `space`. Disconnects
  // itself when it's done.
  function voice(source, shape, { at, peak, attack, decay, release, sustain = 0, hold = 0, pan = 0, space }) {
    const [shapeIn, shapeOut] = Array.isArray(shape) ? shape : [shape, shape];
    const level = gain(ctx, 0);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    source.connect(shapeIn);
    shapeOut.connect(level).connect(panner);
    panner.connect(scene);
    if (space) panner.connect(space);
    const end = envelope(level.gain, { attack, decay, sustain, hold, release, peak }, at);
    if (source.start) {
      source.start(at);
      source.stop(end);
      source.onended = () => panner.disconnect();
    } else {
      // A mix of sources the caller starts itself: just let go when it's over.
      setTimeout(() => panner.disconnect(), (end - ctx.currentTime) * 1000 + 200);
    }
    return end;
  }

  // A heavy, slow step on stone: a low thump and a scuff, then the heel
  // settling. The figure climbs right of the column: panned a little right.
  // `foot` 0/1 alternates the voice slightly, like two different feet.
  function step({ foot = 0, cadence = 1 } = {}) {
    const at = ctx.currentTime + 0.005;
    const tone = (foot ? 0.94 : 1) * vary(0.08);
    const level = LEVELS.step * vary(0.12) * (cadence > 1 ? 0.8 : 1); // lighter, catching up
    const pan = 0.2 + (foot ? 0.04 : -0.04);

    const thump = oscillator(ctx, { frequency: 85 * tone });
    thump.frequency.setValueAtTime(85 * tone, at);
    thump.frequency.exponentialRampToValueAtTime(48 * tone, at + 0.12);
    voice(thump, gain(ctx, 1), { at, peak: level, attack: 0.004, decay: 0.12, release: 0.1, pan, space: stairwell });

    voice(noise(ctx, 'white'), filter(ctx, { type: 'bandpass', frequency: 320 * tone, Q: 1.3 }), {
      at: at + 0.008,
      peak: level,
      attack: 0.003,
      decay: 0.06,
      release: 0.05,
      pan,
      space: stairwell
    });
    voice(noise(ctx, 'white'), filter(ctx, { type: 'bandpass', frequency: 560 * tone, Q: 1.8 }), {
      at: at + 0.07 * vary(0.2),
      peak: level * 0.5,
      attack: 0.004,
      decay: 0.05,
      release: 0.04,
      pan,
      space: stairwell
    });
    // The sole's tap: what reaches any speaker.
    voice(noise(ctx, 'white'), filter(ctx, { type: 'bandpass', frequency: 1100 * tone, Q: 2 }), {
      at: at + 0.004,
      peak: level * 0.35,
      attack: 0.002,
      decay: 0.03,
      release: 0.03,
      pan,
      space: stairwell
    });
  }

  // One phrase of the whale's call: a low tone gliding through `path` (Hz)
  // over `seconds`, a slow vibrato growing into it, shaped by a formant.
  function phrase(at, path, seconds, peak) {
    const tone = oscillator(ctx, { type: 'triangle', frequency: path[0] });
    const upper = oscillator(ctx, { frequency: path[0] * 2.5 });
    const upperLevel = gain(ctx, 0.3); // the partial small speakers do play
    const mix = gain(ctx, 1);
    tone.connect(mix);
    upper.connect(upperLevel).connect(mix);
    path.forEach((hz, i) => {
      const t = at + (seconds * i) / (path.length - 1);
      if (i === 0) {
        tone.frequency.setValueAtTime(hz, t);
        upper.frequency.setValueAtTime(hz * 2.5, t);
      } else {
        tone.frequency.exponentialRampToValueAtTime(hz, t);
        upper.frequency.exponentialRampToValueAtTime(hz * 2.5, t);
      }
    });
    const vibrato = oscillator(ctx, { frequency: 4.5 });
    const vibratoDepth = gain(ctx, 0);
    vibrato.connect(vibratoDepth);
    vibratoDepth.connect(tone.detune);
    vibratoDepth.connect(upper.detune);
    vibratoDepth.gain.setValueAtTime(0, at);
    vibratoDepth.gain.linearRampToValueAtTime(18, at + seconds * 0.7); // cents

    // A formant (the body's resonance), then a lowpass to keep it soft.
    const formant = filter(ctx, { type: 'bandpass', frequency: 520, Q: 1.4 });
    const body = filter(ctx, { type: 'lowpass', frequency: 1600 });
    formant.connect(body);
    const attack = Math.min(0.5, seconds * 0.3);
    const end = voice(mix, [formant, body], { at, peak, attack, decay: seconds - attack, sustain: 0.8, release: 0.7, space: sky });
    [tone, upper, vibrato].forEach(osc => {
      osc.start(at);
      osc.stop(end);
    });
    return end;
  }

  // The whale's call (PLAN-3.md 5.2): the first wave gets the whole song —
  // three phrases over its whole reaction — later waves one short phrase.
  // `slow`: the reaction's own slowdown under reduced motion. Returns how
  // long it sounds, in seconds, so the music can make room for it.
  function whaleCall({ full = true, slow = 1 } = {}) {
    const at = ctx.currentTime + 0.02;
    const peak = LEVELS.whale;
    if (!full) return phrase(at, [150, 175, 118], 1.4 * slow, peak * 0.7) - ctx.currentTime;
    phrase(at, [88, 120, 176], 1.7 * slow, peak);
    phrase(at + 2.0 * slow, [214, 190, 132, 108], 2.4 * slow, peak * 0.9);
    return phrase(at + 4.8 * slow, [126, 168, 202, 140], 2.0 * slow, peak * 0.75) - ctx.currentTime;
  }

  return { step, whaleCall };
}
