// Pure scroll-delta -> progress math, deliberately kept separate from the
// wheel-event plumbing in ScrollSections.jsx so the "feel" (the `mode` prop
// there) can change without touching event handling. `scrubStrategy` is the
// continuous mode: progress tracks the wheel in real time, no auto-complete.
// The default "snap" mode doesn't use this at all — one wheel tick triggers
// a full MorphEngine.animateProgress() tween (the same one MorphSlider's
// endDrag() and keyboard nav already use), so there's no per-tick math to
// isolate for it.

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
//
// `deltaPx` here must already be signed relative to the transition's own
// direction (dirRef), not the raw wheel delta: progress always means "0 =
// still at the section we started from, 1 = fully at the target", for both
// a forward (dirRef=+1) and a backward (dirRef=-1) transition. Continuing
// to scroll the same way that started the transition must always increase
// progress, so the caller should pass `rawDeltaY * dirRef`, not `rawDeltaY`
// — passing the raw delta makes progress on a backward transition go
// negative and clamp to 0 on the very first tick, which looks like
// scrolling back never works at all.
export function scrubStrategy(deltaPx, progress, { pxPerFullTransition = 900 } = {}) {
  const next = progress + deltaPx / pxPerFullTransition;
  return Math.min(Math.max(next, 0), 1);
}
