import { useSyncExternalStore } from 'react';

import { DREAMS, DREAM_IDS } from './dreams';
import { resetNight } from './play';

// What the DR-1 kept tonight (PLAN-2.md 3.5): one fragment per dream, and the
// night's date for the tape label. Lucidity isn't stored — it's just how many
// fragments were kept, so there's one source of truth.
//
// It lives in memory only: a reload is a new night (user decision, Night 2
// phase 4 — a kept fragment surviving the reload made its dream's first
// reaction impossible to see again).

// Local date, e.g. '2026-09-25' — taken once, so a visit that crosses
// midnight keeps the night it started on.
function today() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const fresh = () => ({
  nightOf: today(),
  kept: Object.fromEntries(DREAM_IDS.map(id => [id, null])),
  announcement: null
});

let state = fresh();
const listeners = new Set();

function commit(next) {
  state = next;
  listeners.forEach(listener => listener());
}

// Keeps a dream's fragment. Idempotent: returns true only the first time.
// The Hud reads `announcement` into an aria-live region.
export function keep(id) {
  if (!DREAMS[id] || state.kept[id]) return false;
  commit({
    ...state,
    kept: { ...state.kept, [id]: Date.now() },
    announcement: { text: `Fragment kept: ${DREAMS[id].fragment.label}`, at: Date.now() }
  });
  return true;
}

// Dev only (the ?debug panel): un-keep a fragment.
export function forget(id) {
  if (!state.kept[id]) return;
  commit({ ...state, kept: { ...state.kept, [id]: null }, announcement: null });
}

export const isKept = (id, s = state) => !!s.kept[id];

export const lucidity = (s = state) => DREAM_IDS.filter(id => s.kept[id]).length;

// REPLAY THE NIGHT: a new, blank recording (with today's date) and every
// dream back to its start.
export function reset() {
  commit(fresh());
  resetNight();
}

export function subscribeRecording(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const getSnapshot = () => state;

// { nightOf, kept, announcement } — pass it to lucidity()/isKept() to read
// derived values from the same snapshot.
export function useRecording() {
  return useSyncExternalStore(subscribeRecording, getSnapshot, getSnapshot);
}
