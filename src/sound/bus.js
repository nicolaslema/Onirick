// The sound's only piece in the first chunk (PLAN-3.md 3.1): whether sound
// is on, and the two calls the night makes to it — cue() for a one-off sound,
// param() for a continuous value. With sound off both return on their first
// line, so a scene can call them every frame for free. Everything that makes
// sound is imported only once it can actually play.
//
// On by default (the user's call, after phase 1): the toggle reads SOUND ON
// from the start, but no browser lets audio start before the visitor
// interacts with the page — so it starts on the first click, tap or key
// anywhere (not the wheel: browsers don't count it as a gesture). Until
// then nothing is loaded.
//
// No React here, so node --test can load it; SoundToggle has the hook.

let on = false; // what the toggle shows: sound wanted
let ctx = null;
let sound = null;
let loading = null;
let media = null;
const params = new Map();
const listeners = new Set();

// What to load, which media to unlock in the gesture, and whether sound
// starts on (App.jsx sets it): `load` resolves to a module exporting
// createSound(ctx, env), which returns { start(), stop(), cue(name), … }.
let config = { load: null, media: [], defaultOn: false };

const notify = () => listeners.forEach(listener => listener());

export const isOn = () => on;

// On and actually sounding (a gesture happened and the context runs) — the
// toggle's bars only move then.
export const isLive = () => on && ctx?.state === 'running';

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
  if (!AudioContext) return null;
  const context = new AudioContext({ latencyHint: 'playback' });
  context.addEventListener('statechange', notify);
  return context;
}

// Safari iOS only lets a media element play from a gesture: each is played
// (muted) and paused inside one, so the tape can play it later. Retried on
// the next gesture if the browser didn't take this one.
function unlock(el) {
  if (el.dataset.unlocked) return;
  el.play()
    ?.then(() => {
      el.dataset.unlocked = 'true';
      if (el.muted) el.pause();
    })
    .catch(() => {});
}

function createMedia(url) {
  const el = new Audio();
  el.preload = 'auto';
  el.muted = true;
  el.src = url;
  return el;
}

// Must run inside a gesture: Safari only lets an AudioContext start from
// one, so it's created (or resumed) here, synchronously, before anything is
// awaited.
function begin() {
  ctx ??= createContext();
  if (!ctx || !config.load) return false; // no Web Audio: nothing to start
  ctx.resume();
  media ??= config.media.map(createMedia);
  media.forEach(unlock);
  if (sound) {
    sound.start();
    return true;
  }
  loading ??= config.load().then(({ createSound }) => {
    sound = createSound(ctx, { isOn, getParam, media });
    // Turned off again while it was loading: build it, stay silent.
    if (on) sound.start();
    else ctx.suspend();
  });
  return true;
}

// The first gestures, while sound is wanted but hasn't been able to start.
const GESTURES = ['keydown', 'pointerup', 'touchend', 'click'];
function onGesture(event) {
  // The toggle handles its own click (it turns sound off from here).
  if (event.target?.closest?.('.onk-sound')) return;
  if (!on) return disarm();
  begin();
  // Some events aren't gestures to every browser (a touch that scrolled,
  // iOS and pointerup): keep listening until the context actually runs.
  if (ctx?.state === 'running') disarm();
  else ctx?.resume().then(() => ctx.state === 'running' && disarm());
}
const hasWindow = () => typeof window !== 'undefined';
function arm() {
  if (hasWindow()) GESTURES.forEach(type => window.addEventListener(type, onGesture, true));
}
function disarm() {
  if (hasWindow()) GESTURES.forEach(type => window.removeEventListener(type, onGesture, true));
}

export function configureSound(next) {
  config = { ...config, ...next };
  if (config.defaultOn && !on && !ctx) {
    on = true;
    arm();
    notify();
  }
}

// The toggle's click: a gesture of its own.
export function toggle() {
  if (on) {
    on = false;
    params.clear();
    disarm();
    notify();
    sound?.stop();
    return;
  }
  on = true;
  if (!begin()) on = false;
  notify();
}
