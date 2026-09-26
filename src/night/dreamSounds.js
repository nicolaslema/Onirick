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
  whaleSpace: 0.55, // send into the open night
  door: dbToGain(-26), // a door you open, near (≈ −38 dB peak); far ones fall off with distance
  hallEcho: 0.3,
  water: dbToGain(-32), // a beat's surge
  bubble: dbToGain(-46),
  alarm: dbToGain(-34), // a beep at the Fall's bottom; it starts far quieter (alarm())
  ring: dbToGain(-40), // falling through a ring
  print: dbToGain(-44), // Wake's printer, one character
  feed: dbToGain(-42) // and its paper advancing a row
};

const vary = amount => 1 + (Math.random() * 2 - 1) * amount;

// `scene`: the scene layer (bent by melts, muffled under water); `ui`: the
// layer that skips both — for the bubbles, which are heard *under* water.
export function createDreamSounds(ctx, { scene, ui }) {
  // Three spaces: a stone stairwell, the sky over the city, a long hallway.
  const hallway = reverb(ctx, { seconds: 1.8, decay: 2.6, darken: 0.6 });
  const hallwayLevel = gain(ctx, LEVELS.hallEcho);
  hallway.connect(hallwayLevel).connect(scene);
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

  // A door opening (PLAN-3.md 5.3), plainly: the handle turning and the
  // latch letting go — two short dry clicks and a little knock of wood —
  // then the air the leaf moves, barely there. (A synthesized hinge creak
  // read as an effect, not a door: user, phase 3.)
  // `z`: how far down the hallway (negative); `side`: -1 left, 1 right.
  function door({ z = -4, side = 1, owned = true } = {}) {
    const at = ctx.currentTime + 0.01;
    const distance = Math.max(-z - 2, 0);
    const near = 1 / (1 + distance * 0.25);
    const level = LEVELS.door * near * (owned ? 1 : 0.8) * vary(0.1);
    const pan = side * 0.55 * (1 / (1 + -z * 0.1));
    const far = filter(ctx, { type: 'lowpass', frequency: 9000 / (1 + distance * 0.35) });
    const out = gain(ctx, 1);
    const panner = ctx.createStereoPanner();
    panner.pan.value = pan;
    out.connect(far).connect(panner);
    panner.connect(scene);
    panner.connect(hallway);

    const click = (t, frequency, peak) => {
      const source = noise(ctx, 'white');
      const level = gain(ctx, 0);
      source.connect(filter(ctx, { type: 'bandpass', frequency, Q: 2.2 })).connect(level).connect(out);
      envelope(level.gain, { attack: 0.001, decay: 0.012, release: 0.015, peak }, t);
      source.start(t, Math.random() * 3);
      source.stop(t + 0.06);
    };
    // The handle turns, then the latch lets go, with a knock of wood.
    const latchAt = at + 0.09 * vary(0.25);
    click(at, 1700 * vary(0.1), level * 0.55);
    click(latchAt, 1150 * vary(0.1), level * 0.8);
    const knock = oscillator(ctx, { frequency: 150 * vary(0.1) });
    const knockLevel = gain(ctx, 0);
    knock.connect(knockLevel).connect(out);
    knock.frequency.setValueAtTime(knock.frequency.value, latchAt);
    knock.frequency.exponentialRampToValueAtTime(95, latchAt + 0.06);
    envelope(knockLevel.gain, { attack: 0.002, decay: 0.05, release: 0.05, peak: level * 0.5 }, latchAt);
    knock.start(latchAt);
    knock.stop(latchAt + 0.2);

    // The leaf swinging: a soft swell of low air.
    const air = noise(ctx, 'pink');
    const airTone = filter(ctx, { type: 'lowpass', frequency: 500 });
    const airLevel = gain(ctx, 0);
    air.connect(airTone).connect(airLevel).connect(out);
    const swingAt = latchAt + 0.05;
    const end = envelope(airLevel.gain, { attack: 0.25, decay: 0.35, release: 0.3, peak: level * 0.25 }, swingAt);
    air.start(swingAt, Math.random() * 3);
    air.stop(end);
    air.onended = () => panner.disconnect();
  }

  // The water rising one level (PLAN-3.md 5.5): a low surge and a glug.
  // Its mids carry it; the low end is for speakers that have one.
  function water({ up = true } = {}) {
    const at = ctx.currentTime + 0.01;
    const level = LEVELS.water * (up ? 1 : 0.7);
    const surge = noise(ctx, 'pink');
    const body = filter(ctx, { type: 'lowpass', frequency: 380 });
    body.frequency.setValueAtTime(380, at);
    body.frequency.linearRampToValueAtTime(up ? 900 : 500, at + 0.6);
    body.frequency.linearRampToValueAtTime(420, at + 1.6);
    voice(surge, body, { at, peak: level, attack: 0.35, decay: 0.9, release: 0.6 });
    const wash = noise(ctx, 'white');
    voice(wash, filter(ctx, { type: 'bandpass', frequency: 700, Q: 0.9 }), { at: at + 0.1, peak: level * 0.35, attack: 0.3, decay: 0.8, release: 0.5 });
    const glug = oscillator(ctx, { frequency: 190 });
    glug.frequency.setValueAtTime(190 * vary(0.1), at + 0.25);
    glug.frequency.exponentialRampToValueAtTime(95, at + 0.4);
    voice(glug, gain(ctx, 1), { at: at + 0.25, peak: level * 0.5, attack: 0.01, decay: 0.12, release: 0.08 });
  }

  // A bubble (PLAN-3.md 5.5): a short tone rising fast, as a real one does.
  // Into `ui`, so the under-water lowpass doesn't bury it.
  function bubble() {
    const at = ctx.currentTime + 0.005;
    const from = 420 * vary(0.35);
    const osc = oscillator(ctx, { frequency: from });
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(from * 2.2, at + 0.05);
    const level = gain(ctx, 0);
    const panner = ctx.createStereoPanner();
    panner.pan.value = (Math.random() * 2 - 1) * 0.4;
    osc.connect(level).connect(panner).connect(ui);
    const end = envelope(level.gain, { attack: 0.004, decay: 0.05, release: 0.03, peak: LEVELS.bubble * vary(0.3) }, at);
    osc.start(at);
    osc.stop(end);
    osc.onended = () => panner.disconnect();
  }

  // The Fall's alarm (PLAN-3.md 5.6): one short beep — a sine and its
  // octave, clear but not piercing. `level` 0–1: it grows as you fall.
  function alarm({ level = 1 } = {}) {
    const at = ctx.currentTime + 0.005;
    const peak = LEVELS.alarm * level;
    const tone = oscillator(ctx, { frequency: 1400 });
    const octave = oscillator(ctx, { frequency: 2800 });
    const octaveLevel = gain(ctx, 0.2);
    const mix = gain(ctx, 1);
    tone.connect(mix);
    octave.connect(octaveLevel).connect(mix);
    const end = voice(mix, gain(ctx, 1), { at, peak, attack: 0.006, decay: 0.07, sustain: 0.7, release: 0.05 });
    [tone, octave].forEach(osc => {
      osc.start(at);
      osc.stop(end);
    });
  }

  // Falling through one of the alarm's rings: air rushing past, a quick
  // sweep up and back down. `level` 0–1, with the alarm's growth.
  function ring({ level = 1 } = {}) {
    const at = ctx.currentTime + 0.005;
    const sweep = filter(ctx, { type: 'bandpass', frequency: 400, Q: 1.4 });
    sweep.frequency.setValueAtTime(400, at);
    sweep.frequency.exponentialRampToValueAtTime(1600, at + 0.16);
    sweep.frequency.exponentialRampToValueAtTime(500, at + 0.4);
    voice(noise(ctx, 'pink'), sweep, { at, peak: LEVELS.ring * level * vary(0.15), attack: 0.12, decay: 0.12, release: 0.2, pan: (Math.random() * 2 - 1) * 0.3 });
  }

  // Wake's printer (PLAN-3.md 5.7): one dry tick per character — a little
  // higher on a tape's head line — and the paper advancing after each row.
  function printTick({ head = false } = {}) {
    const at = ctx.currentTime + 0.003;
    const tick = filter(ctx, { type: 'bandpass', frequency: (head ? 3200 : 2500) * vary(0.06), Q: 3 });
    voice(noise(ctx, 'white'), tick, { at, peak: LEVELS.print * vary(0.2), attack: 0.001, decay: 0.006, release: 0.008 });
  }

  function printFeed() {
    const at = ctx.currentTime + 0.005;
    const whirr = oscillator(ctx, { type: 'sawtooth', frequency: 170 });
    whirr.frequency.setValueAtTime(150, at);
    whirr.frequency.linearRampToValueAtTime(190, at + 0.12);
    voice(whirr, filter(ctx, { type: 'lowpass', frequency: 1200 }), { at, peak: LEVELS.feed, attack: 0.015, decay: 0.12, sustain: 0.5, release: 0.05 });
  }

  return { step, whaleCall, door, water, bubble, alarm, ring, printTick, printFeed };
}
