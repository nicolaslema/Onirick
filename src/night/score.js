// The night's sound (PLAN-3.md 3.5, 4): builds the engine, the tape and the
// DR-1's machine, and ties them to the night — the stage (which section,
// which transition), the recording (a fragment kept) and the buttons.
// Loaded only when someone turns sound on (sound/bus.js).

import { createEngine } from '../sound/engine';
import { createDreamSounds } from './dreamSounds';
import { createMachine } from '../sound/machine';
import { createTape } from '../sound/tape';
import { NIGHT } from './config';
import { MUSIC } from './music';
import { getPlay } from './play';
import { recPeriodAt } from './recPace';
import { lucidity, subscribeRecording } from './recording';
import { getStage, subscribeStage } from './stage';
import { tapeCue } from './tapeRules';

const TAPE_START_SECONDS = 0.6;
const TAPE_STOP_SECONDS = 0.8;
const EJECT_AFTER = 0.4;

const stateOf = id => NIGHT.find(section => section.id === id)?.hud?.state;
const FALL_REC_TO = NIGHT.find(section => section.id === 'fall')?.hud?.recTo;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSound(ctx, env) {
  const engine = createEngine(ctx, env);
  const { layers } = engine.nodes;
  const machine = createMachine(ctx, layers);
  const tape = createTape(ctx, layers.music, { elements: env.media, ...MUSIC });
  const dreams = createDreamSounds(ctx, layers);

  let loud = false;
  let prev = getStage();
  let burnTimer = 0;
  let nextBubble = 0;
  let nextRing = 0;
  let transitionAt = 0; // when the transition in flight started (onStage)

  function runTape(action, seconds) {
    if (action === 'start') {
      tape.start();
      machine.run(true, TAPE_START_SECONDS);
    } else if (action === 'stop') {
      tape.stop(seconds);
      machine.run(false, seconds ?? TAPE_STOP_SECONDS);
    }
  }

  function onStage() {
    const next = getStage();
    const cue = tapeCue(prev, next, stateOf);
    if (next.transition && next.transition !== prev.transition) transitionAt = performance.now();
    prev = next;
    // Rewinding is silent on the tape itself, so it happens even while quiet.
    if (cue.rewind) tape.rewind();
    if (!loud) return; // the rest is sound; loud again, sync() catches up
    clearTimeout(burnTimer);
    if (cue.wow && !reducedMotion()) engine.melt(cue.wow.duration, cue.wow.intensity);
    if (cue.rewind) machine.rewind();
    if (cue.tape && cue.delay > 0) burnTimer = setTimeout(() => runTape(cue.tape, cue.seconds), cue.delay * 1000);
    else if (cue.tape) runTape(cue.tape, cue.seconds);
    machine.setStandby(cue.standby);
    if (cue.stopAndEject) {
      machine.stopClack();
      machine.eject(ctx.currentTime + EJECT_AFTER);
    }
  }

  // Loud again (sound on, tab back): the tape picks up where the night is.
  // Recording → it spins up (or simply carries on, if it was only paused);
  // not recording → it's stopped, silently, keeping its place.
  function sync() {
    const { currentId, transition } = getStage();
    const target = transition ? transition.toId : currentId;
    const recording = stateOf(target) === 'rec';
    if (recording) {
      tape.release();
      runTape('start');
    } else {
      tape.halt();
      tape.release();
      machine.run(false, 0.05);
    }
    machine.setStandby(stateOf(target) === 'standby');
  }

  // A dream's sounds only sound while that dream is on screen, or melting
  // in or out: its scene can run as a neighbour too (PLAN-3.md 5).
  const heard = id => {
    const { currentId, transition } = getStage();
    return currentId === id || transition?.fromId === id || transition?.toId === id;
  };

  // Continuous values the scenes write (bus.param), applied every frame
  // while sound is on: how far under water (the Ocean) and how far away the
  // kitchen is (the House, which takes the music with it). Outside their
  // dream they're 0 — and across a transition out of (or into) it they fade
  // with the transition itself, so the sound surfaces as the Ocean melts
  // into the Fall instead of snapping open when the Fall settles.
  let frame = 0;
  const applied = { under: 0, far: 0 };
  const transitionProgress = t => Math.min(Math.max((performance.now() - transitionAt) / (t.duration * 1000), 0), 1);
  function through(id, value) {
    const t = getStage().transition;
    if (!t || t.fromId === t.toId || (t.fromId !== id && t.toId !== id)) return value;
    const p = transitionProgress(t);
    const eased = p * p * (3 - 2 * p);
    return value * (t.fromId === id ? 1 - eased : eased);
  }

  // The Fall's alarm (PLAN-3.md 5.6, reshaped with the user in phase 4):
  // - silent at the top: it starts once you've scrolled down at all;
  // - from quiet (10%) to full at the bottom, fading in with the melt into
  //   the Fall (through());
  // - sparse at first, hurrying as you fall: a burst on every 3rd blink of
  //   the HUD's REC dot, then every 2nd, then every one (and the bursts
  //   themselves shorten, dreamSounds.alarm);
  // - once the fall has carried you to the bottom (the scene locked the
  //   scroll), the bursts stop and one long beep holds — faded out over the
  //   whole melt into Wake.
  const ALARM_FROM = 0.02; // progress: the first scroll down
  function alarmLevel() {
    if (!heard('fall')) return 0;
    const p = getPlay('fall').target;
    if (p < ALARM_FROM) return 0;
    const level = 0.1 + 0.9 * ((p - ALARM_FROM) / (1 - ALARM_FROM)) ** 1.3;
    const t = getStage().transition;
    if (t?.fromId === 'fall' && t.burn > 0) return level * Math.max(0, 1 - transitionProgress(t) / 0.45);
    return through('fall', level);
  }
  const everyNth = p => (p < 0.35 ? 3 : p < 0.6 ? 2 : 1);

  // Bursts come on the HUD's REC dot lighting (the start of its blink cycle,
  // steps(2)): read off the dot's own CSS animation, so they're in phase by
  // construction. Under reduced motion the dot doesn't blink: the same pace
  // on its own clock (recPace.js).
  let lastPhase = 1;
  let ownClock = 0;
  let lastFrameAt = performance.now();
  let lastCycleAt = 0;
  let cycles = 0;
  let hold = null; // the long beep, once the fall has taken over
  function alarmStep(now) {
    const dt = (now - lastFrameAt) / 1000;
    lastFrameAt = now;
    const { transition } = getStage();
    const fall = getPlay('fall');

    // The long beep: the fall took over and reached the bottom.
    if (hold) {
      if (!heard('fall')) {
        // Wake has settled (the fade is already done), or the night moved on.
        hold.voice.stop();
        hold = null;
      } else if (transition?.fromId === 'fall' && transition.toId === 'wake' && !hold.fading) {
        // The melt into Wake: fade out over what's left of it.
        hold.fading = true;
        hold.voice.fade(transition.duration * (1 - transitionProgress(transition)));
      }
      return;
    }
    if (fall.locked && fall.target >= 0.995 && heard('fall') && !transition) {
      hold = { voice: dreams.alarmHold({ level: alarmLevel() }), fading: false };
      return;
    }

    const level = alarmLevel();
    if (level <= 0.001) {
      lastPhase = 1;
      ownClock = 0;
      cycles = 0;
      return;
    }
    const nth = everyNth(fall.target);
    const beat = period => {
      cycles += 1;
      if (cycles % nth === 0) dreams.alarm({ level, period });
    };
    const blink = document.querySelector('.onk-hud .onk-rec')?.getAnimations?.()[0];
    if (blink && blink.playState === 'running') {
      const duration = blink.effect.getComputedTiming().duration;
      const phase = ((blink.currentTime ?? 0) % duration) / duration;
      // While the pace changes fast the phase can jump back more than once a
      // cycle: a new cycle counts only 60% of a period after the last one.
      if (phase < lastPhase && now - lastCycleAt > duration * 0.6) {
        lastCycleAt = now;
        beat(duration / 1000);
      }
      lastPhase = phase;
    } else {
      ownClock += dt;
      const period = recPeriodAt(fall.target, FALL_REC_TO);
      if (ownClock >= period) {
        ownClock -= period;
        beat(period);
      }
    }
  }

  function follow() {
    const under = heard('ocean') ? through('ocean', env.getParam('ocean.under', 0)) : 0;
    const far = heard('house') ? through('house', env.getParam('house.far', 0)) : 0;
    if (Math.abs(under - applied.under) > 0.001) engine.setUnder((applied.under = under));
    if (Math.abs(far - applied.far) > 0.001) tape.setDistance((applied.far = far));
    alarmStep(performance.now());
    frame = requestAnimationFrame(follow);
  }

  engine.onLoud(() => {
    loud = true;
    sync();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(follow);
  });
  engine.onQuiet(() => {
    loud = false;
    clearTimeout(burnTimer);
    cancelAnimationFrame(frame);
    tape.hold();
  });

  const unsubscribeStage = subscribeStage(onStage);

  // A fragment kept: the tape clicks (PLAN-3.md 4.4).
  let kept = lucidity();
  const unsubscribeRecording = subscribeRecording(() => {
    const now = lucidity();
    if (loud && now > kept) machine.tapeClick();
    kept = now;
  });

  // Every button of the night — not the sound toggle, which isn't one.
  const onClick = event => {
    if (loud && event.target.closest?.('.onk-btn, .onk-btn-secondary')) machine.key();
  };
  document.addEventListener('click', onClick, true);

  const inDream = (id, play) => options => (options?.debug || heard(id)) && play(options);

  const CUES = {
    test: engine.testTone,
    step: inDream('stair', dreams.step),
    // The music makes room while the whale sings (the call shares its register).
    'whale-call': inDream('whale', options => {
      const seconds = dreams.whaleCall(options);
      tape.duck(options?.full === false ? -4 : -6, { attack: 0.6, hold: Math.max(seconds - 1.2, 0), release: 1.8 });
    }),
    door: inDream('house', dreams.door),
    // Falling through a ring (the scene: its height crossing your eyes).
    ring: inDream('fall', options => {
      const now = ctx.currentTime;
      if (!options?.debug && now < nextRing) return;
      nextRing = now + 0.15;
      dreams.ring({ level: options?.debug ? 1 : alarmLevel() });
    }),
    alarm: inDream('fall', () => dreams.alarm({ level: 1, period: 1.2 })),
    'print-line': inDream('wake', dreams.printLine),
    'print-feed': inDream('wake', dreams.printFeed),
    water: inDream('ocean', dreams.water),
    // The scene lets out ~18 bubbles a second: one sound for some of them.
    bubble: inDream('ocean', options => {
      const now = ctx.currentTime;
      if (!options?.debug && (now < nextBubble || Math.random() < 0.4)) return;
      nextBubble = now + 0.15;
      dreams.bubble();
    }),
    'stop-clack': () => machine.stopClack(),
    eject: () => machine.eject(),
    key: () => machine.key(),
    'tape-click': () => machine.tapeClick(),
    rewind: () => machine.rewind()
  };

  return {
    ctx,
    nodes: engine.nodes,
    tape,
    cues: Object.keys(CUES),
    start: engine.start,
    stop: engine.stop,
    cue(name, options) {
      CUES[name]?.(options);
    },
    dispose() {
      cancelAnimationFrame(frame);
      unsubscribeStage();
      unsubscribeRecording();
      document.removeEventListener('click', onClick, true);
      tape.dispose();
      engine.dispose();
    }
  };
}
