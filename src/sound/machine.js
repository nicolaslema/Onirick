// The DR-1 itself (PLAN-3.md 4.2, 4.4, 4.5), all synthesized: the motor and
// the tape hiss under the music, the standby hum, and its mechanical
// one-offs — STOP, eject, a key, a tape click, a rewind.
//
// Levels are gains tuned against the dev meters to PLAN-3.md 6's targets;
// see DECISIONS.md (Sound — Phase 1) for what each measured.

import { dbToGain, envelope, filter, gain, glideTo, noise, oscillator, rampTo } from './synth';

const MOTOR_HZ = 55;
export const LEVELS = {
  // Barely there, well under the music (user, after listening to phase 1:
  // the motor and hiss covered it). The hiss sits where the ear is most
  // sensitive, so it's cut hardest.
  motor: dbToGain(-62),
  hiss: dbToGain(-62),
  standby: dbToGain(-70),
  clack: dbToGain(-20), // STOP / eject peaks ≈ −24
  key: dbToGain(-24), // a button: peak ≈ −28
  tapeClick: dbToGain(-22),
  rewind: dbToGain(-30)
};

export function createMachine(ctx, { global, ui }) {
  // Motor: a low saw and its octave, lowpassed, with a slow flutter.
  const motorLevel = gain(ctx, 0);
  motorLevel.connect(global);
  const motorTone = filter(ctx, { type: 'lowpass', frequency: 220, Q: 0.9 });
  motorTone.connect(motorLevel);
  const motor = oscillator(ctx, { type: 'sawtooth', frequency: MOTOR_HZ });
  const motorOctave = oscillator(ctx, { type: 'triangle', frequency: MOTOR_HZ * 2 });
  const octaveLevel = gain(ctx, 0.35);
  motor.connect(motorTone);
  motorOctave.connect(octaveLevel).connect(motorTone);
  const flutter = oscillator(ctx, { frequency: 0.5 });
  const flutterDepth = gain(ctx, 0.003 * 1200); // ±0.3% ≈ ±5 cents, on detune
  flutter.connect(flutterDepth);
  flutterDepth.connect(motor.detune);
  flutterDepth.connect(motorOctave.detune);

  // Hiss: pink noise between 3 and 7 kHz (darker than tape hiss really is:
  // less piercing, under the music).
  const hissLevel = gain(ctx, 0);
  hissLevel.connect(global);
  const hiss = noise(ctx, 'pink');
  hiss.connect(filter(ctx, { type: 'highpass', frequency: 3000 })).connect(filter(ctx, { type: 'lowpass', frequency: 7000 })).connect(hissLevel);

  // Standby: a faint mains hum, while the DR-1 waits (hero, manual).
  const standbyLevel = gain(ctx, 0);
  standbyLevel.connect(global);
  const standby = oscillator(ctx, { frequency: 100 });
  const standbyHarmonic = oscillator(ctx, { frequency: 200 });
  const harmonicLevel = gain(ctx, 0.3);
  standby.connect(standbyLevel);
  standbyHarmonic.connect(harmonicLevel).connect(standbyLevel);

  [motor, motorOctave, flutter, hiss, standby, standbyHarmonic].forEach(source => source.start());

  // The motor spins up and down with the tape (same curves, PLAN-3.md 4.1):
  // its pitch follows the speed.
  function run(on, seconds) {
    const rate = on ? 1 : 0.25;
    [motor, motorOctave].forEach((osc, i) => rampTo(osc.frequency, MOTOR_HZ * (i + 1) * rate, seconds, ctx));
    rampTo(motorLevel.gain, on ? LEVELS.motor : 0, seconds, ctx);
    rampTo(hissLevel.gain, on ? LEVELS.hiss : 0, seconds, ctx);
  }

  function setStandby(on) {
    glideTo(standbyLevel.gain, on ? LEVELS.standby : 0, 0.3, ctx);
  }

  // A short burst of filtered noise: the body of every mechanical sound.
  function burst(destination, { at, frequency, Q = 1.5, peak, decay, type = 'bandpass' }) {
    const source = noise(ctx, 'white');
    const shape = filter(ctx, { type, frequency, Q });
    const level = gain(ctx, 0);
    source.connect(shape).connect(level).connect(destination);
    const end = envelope(level.gain, { attack: 0.002, decay, release: decay, peak }, at);
    source.start(at, Math.random() * 3);
    source.stop(end);
    source.onended = () => level.disconnect();
  }

  // A low thump: a sine dropping in pitch.
  function thump(destination, { at, from, to, peak, decay }) {
    const osc = oscillator(ctx, { frequency: from });
    const level = gain(ctx, 0);
    osc.connect(level).connect(destination);
    osc.frequency.setValueAtTime(from, at);
    osc.frequency.exponentialRampToValueAtTime(to, at + decay);
    const end = envelope(level.gain, { attack: 0.003, decay, release: decay, peak }, at);
    osc.start(at);
    osc.stop(end);
    osc.onended = () => level.disconnect();
  }

  // ■ STOP: a mechanical clack.
  function stopClack(at = ctx.currentTime + 0.01) {
    burst(global, { at, frequency: 1600, Q: 2, peak: LEVELS.clack, decay: 0.05 });
    thump(global, { at, from: 110, to: 60, peak: LEVELS.clack * 0.8, decay: 0.12 });
  }

  // Eject: a longer clack, then the spring — a short tone falling.
  function eject(at = ctx.currentTime + 0.01) {
    burst(global, { at, frequency: 1200, Q: 1.2, peak: LEVELS.clack, decay: 0.09 });
    thump(global, { at, from: 90, to: 50, peak: LEVELS.clack * 0.7, decay: 0.16 });
    thump(global, { at: at + 0.06, from: 620, to: 240, peak: LEVELS.clack * 0.25, decay: 0.18 });
    burst(global, { at: at + 0.18, frequency: 900, Q: 1, peak: LEVELS.clack * 0.4, decay: 0.12 });
  }

  // A button: a muffled key, press and release.
  function key(at = ctx.currentTime + 0.005) {
    burst(ui, { at, frequency: 2400, Q: 2.5, peak: LEVELS.key, decay: 0.02 });
    burst(ui, { at: at + 0.045, frequency: 3000, Q: 3, peak: LEVELS.key * 0.5, decay: 0.015 });
  }

  // A fragment kept: two mechanical transients and a small thud.
  function tapeClick(at = ctx.currentTime + 0.005) {
    burst(ui, { at, frequency: 1800, Q: 2, peak: LEVELS.tapeClick, decay: 0.025 });
    burst(ui, { at: at + 0.07, frequency: 2600, Q: 2.5, peak: LEVELS.tapeClick * 0.7, decay: 0.02 });
    thump(ui, { at, from: 140, to: 80, peak: LEVELS.tapeClick * 0.5, decay: 0.08 });
  }

  // Rewind: noise rising in pitch, fast (REPLAY THE NIGHT).
  function rewind(at = ctx.currentTime + 0.01, seconds = 0.8) {
    const source = noise(ctx, 'pink');
    const shape = filter(ctx, { type: 'bandpass', frequency: 700, Q: 3 });
    const level = gain(ctx, 0);
    source.connect(shape).connect(level).connect(global);
    shape.frequency.setValueAtTime(700, at);
    shape.frequency.exponentialRampToValueAtTime(5200, at + seconds);
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(LEVELS.rewind, at + 0.1);
    level.gain.setValueAtTime(LEVELS.rewind, at + seconds - 0.15);
    level.gain.linearRampToValueAtTime(0, at + seconds);
    source.start(at);
    source.stop(at + seconds + 0.05);
    source.onended = () => level.disconnect();
    stopClack(at + seconds);
  }

  return { run, setStandby, stopClack, eject, key, tapeClick, rewind };
}
