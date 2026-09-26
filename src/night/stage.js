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

let state = { currentId: null, settled: true };
const listeners = new Set();

export function setStage(next) {
  if (next.currentId === state.currentId && next.settled === state.settled) return;
  state = next;
  listeners.forEach(listener => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

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
