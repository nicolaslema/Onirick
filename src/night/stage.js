import { useSyncExternalStore } from 'react';

// Which section is on screen, and whether it has settled (no transition in
// flight) — for the 3D scenes, which only listen to the visitor while theirs
// is the dream on screen.
//
// A store rather than a prop: a scene lives inside an R3F <Canvas> (its own
// reconciler, behind a lazy Suspense), and a `live` prop handed down through
// it sometimes never arrived — a House mounted as a neighbour kept
// `live={false}` after becoming current, and its doors ignored every click.
// Subscribing from inside the scene's own tree doesn't depend on that.
//
// App.jsx writes it from ScrollSections' onStateChange.

// `transition`: the one in flight, as ScrollSections resolved it — { fromId,
// toId, kind: 'melt' | 'plain', duration, intensity, burn } — or null. The
// sound follows it (PLAN-3.md 3.4); the scenes only need `settled`.
let state = { currentId: null, settled: true, transition: null };
const listeners = new Set();

export function setStage(next) {
  if (next.currentId === state.currentId && next.settled === state.settled && next.transition === state.transition) return;
  state = next;
  listeners.forEach(listener => listener());
}

export function subscribeStage(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const subscribe = subscribeStage;

export const getStage = () => state;
const getSnapshot = getStage;

// A scene asking to move on by itself (the Fall, carrying you into Wake).
// Only a section component can navigate (goTo lives on ScrollSections'
// context, outside the scene's canvas), so it subscribes and does it.
const navigateListeners = new Set();
export function requestNavigate(id) {
  navigateListeners.forEach(listener => listener(id));
}
export function subscribeNavigate(listener) {
  navigateListeners.add(listener);
  return () => navigateListeners.delete(listener);
}

// A section held a wheel or swipe it won't let leave (keysOnly: the hero) —
// its screen answers (the hero's BEGIN RECORDING pulses).
const nudgeListeners = new Set();
export function nudge(id) {
  nudgeListeners.forEach(listener => listener(id));
}
export function subscribeNudge(listener) {
  nudgeListeners.add(listener);
  return () => nudgeListeners.delete(listener);
}

// Runs `callback` once, the next time `id` is on screen and settled — e.g.
// Replay's new night, once Wake has faded out behind the hero.
export function onceSettledAt(id, callback) {
  const check = () => {
    if (state.currentId !== id || !state.settled) return;
    listeners.delete(check);
    callback();
  };
  listeners.add(check);
}

// True while `id` is the section on screen and nothing is moving.
export function useLive(id) {
  const { currentId, settled } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return currentId === id && settled;
}
