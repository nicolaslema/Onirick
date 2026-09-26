// The sound's only piece in the first chunk (PLAN-3.md 3.1): whether sound
// is on, and the two calls the night makes to it — cue() for a one-off sound,
// param() for a continuous value. With sound off both return on their first
// line, so a scene can call them every frame for free. Everything that makes
// sound is imported only once someone turns sound on.
//
// No React here, so node --test can load it; SoundToggle has the hook.

let on = false;
let ctx = null;
let sound = null;
let loading = null;
let media = null;
const params = new Map();
const listeners = new Set();

// What to load, and which media to unlock in the click (App.jsx sets it):
// `load` resolves to a module exporting createSound(ctx, env), which returns
// { start(), stop(), cue(name, options), … }.
let config = { load: null, media: [] };
export function configureSound(next) {
  config = { ...config, ...next };
}

const notify = () => listeners.forEach(listener => listener());

export const isOn = () => on;

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function cue(name, options) {
  if (!on || !sound) return;
  sound.cue(name, options);
}

// Only the last value is kept; the sound reads it when it needs it.
export function param(name, value) {
  if (!on) return;
  params.set(name, value);
}

export const getParam = (name, fallback = 0) => (params.has(name) ? params.get(name) : fallback);

// For the dev panel: the loaded sound once it exists, or null.
export const getEngine = () => sound;

function createContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  return AudioContext ? new AudioContext({ latencyHint: 'playback' }) : null;
}

// Safari iOS only lets a media element play from a gesture: each is played
// (muted) and paused right here, in the click, so the tape can play it later.
function unlock(url) {
  const el = new Audio();
  el.preload = 'auto';
  el.muted = true;
  el.src = url;
  el.play()
    ?.then(() => {
      if (el.muted) el.pause();
    })
    .catch(() => {});
  return el;
}

// Must run inside the click that turns sound on: Safari only lets an
// AudioContext start from a user gesture, so it's created (or resumed) here,
// synchronously, before anything is awaited.
export function toggle() {
  if (on) {
    on = false;
    params.clear();
    notify();
    sound?.stop();
    return;
  }
  ctx ??= createContext();
  if (!ctx || !config.load) return; // no Web Audio: the button stays off
  on = true;
  ctx.resume();
  media ??= config.media.map(unlock);
  notify();
  if (sound) {
    sound.start();
    return;
  }
  loading ??= config.load().then(({ createSound }) => {
    sound = createSound(ctx, { isOn, getParam, media });
    // Turned off again while it was loading: build it, stay silent.
    if (on) sound.start();
    else ctx.suspend();
  });
}
