import { useMemo, useSyncExternalStore } from 'react';

import { DREAMS, DREAM_IDS } from './dreams';

// Per-dream play state (PLAN-2.md 3.3), outside React.
//
// Each dream has one mutable entry:
//   target    scrub: progress 0-1; beats: the target beat; free: stays 0
//   beat      Math.round(target) — only meaningful for beats
//   reveal    how many log lines are enabled (from target, events and DREAMS[id].lines)
//   events    scene events that already happened this night ('wave', 'let-go', ...)
//   settledAt performance.now() of the last change
//   snaps     bumped when a scene should jump straight to `target`, unsmoothed
//             (a counter, not a flag, so every reader of the entry sees it)
//   typed     how many characters of the log the transcript has typed so far
//   hinted    the Hud already showed this dream's prompt tonight
//   touched   the visitor already tried the dream's interaction (no prompt needed)
//
// Scenes read the entry every frame through usePlayRef() and smooth toward
// `target` themselves — nothing here re-renders React per frame. React only
// hears about `beat`, `reveal` and `events` (usePlay), which change rarely.
// subscribeTarget() hears every change, for scenes that must redraw a frame
// while their canvas only renders on demand (a neighbour being prepared).
//
// Events outlive leaving the dream: they last the night, and survive a
// reload (sessionStorage), so a whale you already waved at still has its
// full log. resetNight() (REPLAY THE NIGHT) clears them.

const EVENTS_KEY = 'onirick.events';
const EPS = 1e-6;

function loadEvents() {
  try {
    const raw = sessionStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

const stored = loadEvents();

const entries = Object.fromEntries(
  DREAM_IDS.map(id => [
    id,
    { target: 0, beat: 0, reveal: 0, events: new Set(stored[id] ?? []), settledAt: 0, snaps: 0, typed: 0, hinted: false, touched: false }
  ])
);

function revealFor(id, target, events) {
  let count = 0;
  for (const line of DREAMS[id].lines) {
    const byAt = line.at !== undefined && target >= line.at - EPS;
    const byOn = line.on !== undefined && events.has(line.on);
    if (!byAt && !byOn) break;
    count += 1;
  }
  return count;
}

const snapshotOf = entry => ({ beat: entry.beat, reveal: entry.reveal, events: [...entry.events] });

for (const id of DREAM_IDS) entries[id].reveal = revealFor(id, 0, entries[id].events);
const snapshots = Object.fromEntries(DREAM_IDS.map(id => [id, snapshotOf(entries[id])]));

const listeners = new Set();
const targetListeners = new Set();

function saveEvents() {
  try {
    sessionStorage.setItem(EVENTS_KEY, JSON.stringify(Object.fromEntries(DREAM_IDS.map(id => [id, [...entries[id].events]]))));
  } catch {
    // Private mode or blocked storage: events just last until the tab reloads.
  }
}

// Recomputes the derived fields and tells React — but only if something
// React cares about actually changed.
function update(id) {
  const entry = entries[id];
  entry.beat = Math.round(entry.target);
  entry.reveal = revealFor(id, entry.target, entry.events);
  entry.settledAt = performance.now();
  targetListeners.forEach(listener => listener(id));
  const prev = snapshots[id];
  if (prev.beat === entry.beat && prev.reveal === entry.reveal && prev.events.length === entry.events.size) return;
  snapshots[id] = snapshotOf(entry);
  listeners.forEach(listener => listener());
}

export function getPlay(id) {
  return entries[id];
}

export function setTarget(id, value, { snap = false } = {}) {
  const entry = entries[id];
  if (!entry) return;
  entry.target = value;
  if (snap) entry.snaps += 1;
  update(id);
}

// A scene event ('wave', 'let-go', ...). Returns true the first time it
// happens this night.
export function trigger(id, event) {
  const entry = entries[id];
  if (!entry || entry.events.has(event)) return false;
  entry.events.add(event);
  saveEvents();
  update(id);
  return true;
}

// The dream's keyboard action (DreamAction, PLAN-2.md 3.7): a repeatable
// signal, not a once-a-night event — the scene decides what it means each
// time (stop climbing, wave, open a door...). `listener(id)`.
const actionListeners = new Set();
export function act(id) {
  actionListeners.forEach(listener => listener(id));
}
export function subscribeAction(listener) {
  actionListeners.add(listener);
  return () => actionListeners.delete(listener);
}

// The visitor tried the dream's interaction (held, waved, opened a door...):
// its Hud prompt is no longer needed. Scenes call it; no re-render.
export function markTouched(id) {
  if (entries[id]) entries[id].touched = true;
}

// Back to the dream's start (a goTo() jump landing on it). Events stay.
export function resetPlay(id) {
  setTarget(id, 0, { snap: true });
}

// REPLAY THE NIGHT: every dream back to its start, every event forgotten.
export function resetNight() {
  for (const id of DREAM_IDS) {
    const entry = entries[id];
    entry.events.clear();
    entry.target = 0;
    entry.snaps += 1;
    entry.typed = 0;
    entry.hinted = false;
    entry.touched = false;
    update(id);
  }
  saveEvents();
}

export function subscribePlay(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Every change to any dream's entry, as `listener(id)` — not for React.
export function subscribeTarget(listener) {
  targetListeners.add(listener);
  return () => targetListeners.delete(listener);
}

// For scenes, inside useFrame: `usePlayRef(id).current.target`.
export function usePlayRef(id) {
  return useMemo(() => ({ current: entries[id] }), [id]);
}

// For React: { beat, reveal, events } — re-renders only when those change.
export function usePlay(id) {
  const get = () => snapshots[id];
  return useSyncExternalStore(subscribePlay, get, get);
}
