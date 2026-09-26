// Window-wide pointer position, normalized to [-1, 1] (y up), shared by
// every scene. R3F's own state.pointer only updates for events that reach
// its canvas, and each section's text sits on top of its canvas — tracking
// the window keeps parallax/tilt continuous no matter what's under the
// cursor. One set of listeners for the whole page, installed on first use.
//
// Beyond x/y (PLAN-2.md 3.6):
// - vx, vy: smoothed velocity in NDC/s, decaying to 0 once the pointer stops.
// - stillSince: performance.now() of the last move bigger than STILL_NDC.
// - down: a button or finger is pressed.
// - onTap() / onHold(): taps and press-and-hold, ignoring interactive
//   elements (clicking a button never opens a door).

const STILL_NDC = 0.004;
const VELOCITY_SMOOTH_MS = 80; // time constant of the velocity smoothing
const VELOCITY_DECAY_MS = 120; // how fast velocity fades once moves stop
const TAP_MAX_PX = 10;
const TAP_MAX_MS = 300;
const INTERACTIVE = 'a, button, [role="button"], input, select, textarea, label';

const motion = { vx: 0, vy: 0, at: 0 };
const anchor = { x: 0, y: 0 };

export const pointer = {
  x: 0,
  y: 0,
  get vx() {
    return motion.vx * decay();
  },
  get vy() {
    return motion.vy * decay();
  },
  stillSince: 0,
  down: false
};

function decay() {
  return Math.exp(-(performance.now() - motion.at) / VELOCITY_DECAY_MS);
}

const downHandlers = new Set();
const moveHandlers = new Set();
const upHandlers = new Set();

const isInteractive = target => target instanceof Element && !!target.closest(INTERACTIVE);

function onMove(e) {
  const x = (e.clientX / window.innerWidth) * 2 - 1;
  const y = -((e.clientY / window.innerHeight) * 2 - 1);
  const now = performance.now();
  const dt = now - motion.at;
  if (motion.at && dt > 0) {
    // Ease the (already decayed) velocity toward this move's raw velocity.
    const k = 1 - Math.exp(-dt / VELOCITY_SMOOTH_MS);
    const fade = decay();
    const vx = motion.vx * fade;
    const vy = motion.vy * fade;
    motion.vx = vx + (((x - pointer.x) / dt) * 1000 - vx) * k;
    motion.vy = vy + (((y - pointer.y) / dt) * 1000 - vy) * k;
  }
  motion.at = now;
  pointer.x = x;
  pointer.y = y;
  if (Math.hypot(x - anchor.x, y - anchor.y) > STILL_NDC) {
    anchor.x = x;
    anchor.y = y;
    pointer.stillSince = now;
  }
  moveHandlers.forEach(handler => handler(e));
}

function onDown(e) {
  if (!e.isPrimary || e.button !== 0) return;
  pointer.down = true;
  pointer.stillSince = performance.now();
  downHandlers.forEach(handler => handler(e));
}

function onUp(e, cancelled = false) {
  if (e && !e.isPrimary) return;
  pointer.down = false;
  upHandlers.forEach(handler => handler(e, cancelled));
}

let installed = false;

export function trackPointer() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  pointer.stillSince = performance.now();
  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointerup', e => onUp(e), { passive: true });
  window.addEventListener('pointercancel', e => onUp(e, true), { passive: true });
  // Losing focus mid-press (alt-tab) never delivers the pointerup.
  window.addEventListener('blur', () => pointer.down && onUp(null, true));
}

const toNdc = e => ({ x: (e.clientX / window.innerWidth) * 2 - 1, y: -((e.clientY / window.innerHeight) * 2 - 1) });

// A pointerdown → pointerup under TAP_MAX_PX and TAP_MAX_MS, not on an
// interactive element. `callback({ x, y })` gets the NDC position.
// Returns the unsubscribe function.
export function onTap(callback) {
  trackPointer();
  let start = null;
  const down = e => {
    start = isInteractive(e.target) ? null : { x: e.clientX, y: e.clientY, at: performance.now() };
  };
  const up = (e, cancelled) => {
    const s = start;
    start = null;
    if (!s || cancelled || !e) return;
    if (Math.hypot(e.clientX - s.x, e.clientY - s.y) > TAP_MAX_PX || performance.now() - s.at > TAP_MAX_MS) return;
    callback(toNdc(e));
  };
  downHandlers.add(down);
  upHandlers.add(up);
  return () => {
    downHandlers.delete(down);
    upHandlers.delete(up);
  };
}

// Press and hold: `start()` once the pointer has been down `delay` ms without
// moving more than `tolerance` px, `end()` on release. Moving first means a
// swipe, and nothing happens. Returns the unsubscribe function.
export function onHold({ delay = 250, tolerance = 10 } = {}, { start, end }) {
  trackPointer();
  let origin = null;
  let timer = 0;
  let holding = false;
  const clear = () => {
    clearTimeout(timer);
    origin = null;
  };
  const down = e => {
    if (isInteractive(e.target)) return;
    origin = { x: e.clientX, y: e.clientY };
    timer = setTimeout(() => {
      origin = null;
      holding = true;
      start?.();
    }, delay);
  };
  const move = e => {
    if (origin && Math.hypot(e.clientX - origin.x, e.clientY - origin.y) > tolerance) clear();
  };
  const up = () => {
    clear();
    if (!holding) return;
    holding = false;
    end?.();
  };
  downHandlers.add(down);
  moveHandlers.add(move);
  upHandlers.add(up);
  return () => {
    up();
    downHandlers.delete(down);
    moveHandlers.delete(move);
    upHandlers.delete(up);
  };
}
