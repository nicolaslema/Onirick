// Pure scroll-delta -> progress math, deliberately kept separate from the
// wheel-event plumbing in ScrollSections.jsx so the "feel" can change later
// without touching the event handling: today only `scrubStrategy` is wired
// (progress tracks the wheel in real time, no auto-complete). A future
// snap-on-release mode would live here too, but as a debounced wheel-idle
// timer in the caller feeding MorphEngine.animateProgress() — the same
// tween MorphSlider's endDrag() already uses — rather than a per-tick
// math function, so it isn't stubbed out here half-built.

// deltaMode: 0 = pixel (most trackpads/modern mice), 1 = line, 2 = page.
// Wheel deltas need normalizing to a common pixel-ish unit before they're
// comparable across devices/browsers.
const LINE_HEIGHT_PX = 16;

export function normalizeDelta(e) {
  if (e.deltaMode === 1) return e.deltaY * LINE_HEIGHT_PX;
  if (e.deltaMode === 2) return e.deltaY * (typeof window !== 'undefined' ? window.innerHeight : 800);
  return e.deltaY;
}

// pxPerFullTransition: normalized scroll pixels needed for a full 0->1
// transition. This is a starting point, not a solved number — tune it
// on-device once the feel can actually be tried in a browser.
export function scrubStrategy(deltaPx, progress, { pxPerFullTransition = 900 } = {}) {
  const next = progress + deltaPx / pxPerFullTransition;
  return Math.min(Math.max(next, 0), 1);
}
