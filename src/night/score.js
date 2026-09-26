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
import { lucidity, subscribeRecording } from './recording';
import { getStage, subscribeStage } from './stage';
import { tapeCue } from './tapeRules';

const TAPE_START_SECONDS = 0.6;
const TAPE_STOP_SECONDS = 0.8;
const EJECT_AFTER = 0.4;

const stateOf = id => NIGHT.find(section => section.id === id)?.hud?.state;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createSound(ctx, env) {
  const engine = createEngine(ctx, env);
  const { layers } = engine.nodes;
  const machine = createMachine(ctx, layers);
  const tape = createTape(ctx, layers.music, { elements: env.media, ...MUSIC });
  const dreams = createDreamSounds(ctx, layers.scene);

  let loud = false;
  let prev = getStage();
  let burnTimer = 0;

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

  engine.onLoud(() => {
    loud = true;
    sync();
  });
  engine.onQuiet(() => {
    loud = false;
    clearTimeout(burnTimer);
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

  // A dream's one-offs only sound while that dream is on screen, or melting
  // in or out: its scene can run as a neighbour too (PLAN-3.md 5).
  const heard = id => {
    const { currentId, transition } = getStage();
    return currentId === id || transition?.fromId === id || transition?.toId === id;
  };
  const inDream = (id, play) => options => (options?.debug || heard(id)) && play(options);

  const CUES = {
    test: engine.testTone,
    step: inDream('stair', dreams.step),
    'whale-call': inDream('whale', dreams.whaleCall),
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
      unsubscribeStage();
      unsubscribeRecording();
      document.removeEventListener('click', onClick, true);
      tape.dispose();
      engine.dispose();
    }
  };
}
