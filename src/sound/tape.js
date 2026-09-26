// The music as a tape (PLAN-3.md 4.1): it starts like a motor (speed and
// pitch rise), stops like one (they fall), keeps its place, loops without a
// seam and rewinds. Two <audio> elements streamed through MediaElementSource
// — a whole piece decoded into an AudioBuffer would take tens of MB on a
// phone — taking turns at the loop point with a crossfade (PLAN-3.md 2.3),
// because `loop` leaves an audible gap in some browsers.
//
// playbackRate isn't an AudioParam: the start/stop curves are stepped every
// frame, under a gain fade that hides the steps.

import { dbToGain, gain, rampTo } from './synth';

const START = { from: 0.6, seconds: 0.6 };
const STOP = { to: 0.25, seconds: 0.8 };
const LOOP_CHECK_MS = 100;

const setRate = (el, rate) => {
  el.playbackRate = rate;
};

// The pitch falls with the speed: that's the tape stop.
function tapeLike(el) {
  el.preservesPitch = false;
  el.webkitPreservesPitch = false;
  el.mozPreservesPitch = false;
}

export function createTape(ctx, destination, { elements, loopStart = 0, loopEnd, crossfade = 3, gainDb = 0, compress, trimDb = 0 }) {
  // Music level, then (optionally) a slow, gentle compressor so the piece's
  // crests never climb out of the background, and a trim after it — Web
  // Audio's compressor applies its own makeup gain (PLAN-3.md 6).
  const level = gain(ctx, dbToGain(gainDb));
  let out = level;
  if (compress) {
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = compress.threshold;
    comp.ratio.value = compress.ratio;
    comp.knee.value = compress.knee;
    comp.attack.value = compress.attack;
    comp.release.value = compress.release;
    level.connect(comp);
    out = comp;
  }
  out.connect(gain(ctx, dbToGain(trimDb))).connect(destination);

  const decks = elements.map(el => {
    tapeLike(el);
    el.loop = false;
    // Unlocked muted in the click (sound/bus.js), maybe still "playing" if
    // that play() hasn't settled: stopped here, and heard through the graph.
    el.pause();
    el.muted = false;
    const fader = gain(ctx, 0);
    ctx.createMediaElementSource(el).connect(fader).connect(level);
    return { el, fader };
  });

  let active = 0; // the deck the night is listening to
  let state = 'stopped'; // 'stopped' | 'starting' | 'playing' | 'stopping'
  let held = false; // paused because the engine went quiet
  let frame = 0;
  let crossing = null; // { timer } while a loop crossfade runs

  const deck = () => decks[active];
  const end = () => loopEnd ?? deck().el.duration;

  function stepRate(el, from, to, seconds, ease, done) {
    cancelAnimationFrame(frame);
    const t0 = performance.now();
    const step = now => {
      const k = Math.min((now - t0) / (seconds * 1000), 1);
      setRate(el, from + (to - from) * ease(k));
      if (k < 1) frame = requestAnimationFrame(step);
      else done?.();
    };
    frame = requestAnimationFrame(step);
  }

  function play(el) {
    const promise = el.play();
    promise?.catch(() => {}); // interrupted by a pause: nothing to do
  }

  function start() {
    if (state === 'playing' || state === 'starting') return;
    const { el, fader } = deck();
    state = 'starting';
    if (!held) {
      setRate(el, START.from);
      play(el);
    }
    rampTo(fader.gain, 1, START.seconds, ctx);
    stepRate(el, el.playbackRate, 1, START.seconds, k => 1 - (1 - k) * (1 - k), () => {
      if (state === 'starting') state = 'playing';
    });
  }

  // `seconds`: how long the tape takes to stop — 0.8 normally, shorter for
  // the burn into Wake (PLAN-3.md 4.3).
  function stop(seconds = STOP.seconds) {
    if (state === 'stopped' || state === 'stopping') return;
    cancelCrossing();
    const { el, fader } = deck();
    state = 'stopping';
    rampTo(fader.gain, 0, seconds, ctx);
    stepRate(el, el.playbackRate, STOP.to, seconds, k => k * k, () => {
      if (state !== 'stopping') return;
      el.pause();
      setRate(el, 1);
      state = 'stopped';
    });
  }

  function cancelCrossing() {
    if (!crossing) return;
    clearTimeout(crossing.timer);
    const other = decks[1 - active];
    other.el.pause();
    rampTo(other.fader.gain, 0, 0.05, ctx);
    crossing = null;
  }

  // The loop: near the end, the other deck starts at loopStart and the two
  // cross over `crossfade` seconds; then they swap.
  const loopTimer = setInterval(() => {
    if (state !== 'playing' || held || crossing || decks.length < 2) return;
    const { el } = deck();
    if (!(el.currentTime >= end() - crossfade)) return;
    const next = decks[1 - active];
    next.el.currentTime = loopStart;
    setRate(next.el, 1);
    play(next.el);
    rampTo(next.fader.gain, 1, crossfade, ctx);
    rampTo(deck().fader.gain, 0, crossfade, ctx);
    const previous = active;
    active = 1 - active;
    crossing = {
      timer: setTimeout(() => {
        decks[previous].el.pause();
        crossing = null;
      }, crossfade * 1000 + 100)
    };
  }, LOOP_CHECK_MS);

  // Back to the beginning (REPLAY THE NIGHT): stopped, at loopStart.
  function rewind() {
    cancelCrossing();
    cancelAnimationFrame(frame);
    decks.forEach(({ el, fader }) => {
      el.pause();
      setRate(el, 1);
      rampTo(fader.gain, 0, 0.05, ctx);
    });
    active = 0;
    deck().el.currentTime = loopStart;
    state = 'stopped';
  }

  // Stopped at once and without a sound, keeping its place — for when sound
  // comes back somewhere the tape shouldn't be running.
  function halt() {
    cancelCrossing();
    cancelAnimationFrame(frame);
    decks.forEach(({ el, fader }) => {
      el.pause();
      setRate(el, 1);
      rampTo(fader.gain, 0, 0.02, ctx);
    });
    state = 'stopped';
  }

  // The engine went quiet (sound off, tab hidden): pause where it is.
  function hold() {
    held = true;
    cancelCrossing();
    decks.forEach(({ el }) => el.pause());
  }

  // Loud again: carry on from the same place, if the tape was running.
  function release() {
    if (!held) return;
    held = false;
    if (state === 'playing' || state === 'starting') play(deck().el);
  }

  deck().el.currentTime = loopStart;

  // For the dev panel: jump the running deck (e.g. just before the loop).
  function seek(seconds) {
    cancelCrossing();
    rampTo(decks[1 - active].fader.gain, 0, 0.02, ctx);
    deck().el.currentTime = Math.min(Math.max(seconds, 0), end());
  }

  return {
    seek,
    get loopEnd() {
      return end();
    },
    start,
    stop,
    halt,
    rewind,
    hold,
    release,
    get state() {
      return held && state !== 'stopped' ? `${state} (held)` : state;
    },
    get position() {
      return deck().el.currentTime;
    },
    get duration() {
      return end();
    },
    dispose() {
      clearInterval(loopTimer);
      cancelAnimationFrame(frame);
      decks.forEach(({ el }) => el.pause());
    }
  };
}
