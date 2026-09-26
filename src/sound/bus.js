// The sound's only piece in the first chunk (PLAN-3.md 3.1): whether sound
// is on, and the two calls the night makes to it — cue() for a one-off sound,
// param() for a continuous value. With sound off both return on their first
// line, so a scene can call them every frame for free. The engine (Web Audio
// graph, synthesis, the score) is imported only once someone turns sound on.
//
// No React here, so node --test can load it; SoundToggle has the hook.

let on = false;
let ctx = null;
let engine = null;
let loading = null;
const params = new Map();
const listeners = new Set();

const notify = () => listeners.forEach(listener => listener());

export const isOn = () => on;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function cue(name, options) {
  if (!on || !engine) return;
  engine.cue(name, options);
}

// Only the last value is kept; the engine reads it when it needs it.
export function param(name, value) {
  if (!on) return;
  params.set(name, value);
}

export const getParam = (name, fallback = 0) => (params.has(name) ? params.get(name) : fallback);

// For the dev panel: the engine once it exists, or null.
export const getEngine = () => engine;

function createContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return AudioContext ? new AudioContext({ latencyHint: 'playback' }) : null;
}

// Must run inside the click that turns sound on: Safari only lets an
// AudioContext start from a user gesture, so it's created (or resumed) here,
// synchronously, before the engine's import is awaited.
export function toggle() {
  if (on) {
    on = false;
    params.clear();
    notify();
    engine?.stop();
    return;
  }
  ctx ??= createContext();
  if (!ctx) return; // no Web Audio: the button stays off
  on = true;
  ctx.resume();
  notify();
  if (engine) {
    engine.start();
    return;
  }
  loading ??= import('./engine').then(({ createEngine }) => {
    engine = createEngine(ctx, { isOn, getParam });
    // Turned off again while the engine was loading: build it, stay silent.
    if (on) engine.start();
    else ctx.suspend();
  });
}
