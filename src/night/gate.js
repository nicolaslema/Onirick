import { DREAMS } from './dreams';
import { getPlay, setTarget } from './play';

// The gate (PLAN-2.md 3.2): what ScrollSections asks before letting a gesture
// leave a section, and where a dream's own scroll goes instead. ScrollSections
// knows nothing about dreams — it only calls these four methods by index.
//
// - 'beats' (e.g. Ocean): one step per gesture; while a beat plays out
//   (beatDuration) further gestures are swallowed, like during a melt.
// - 'scrub' (Stair, Fall): wheel and finger move a 0-1 progress; keys jump to
//   the next of the dream's `stops`, tweened.
// - 'free' or no `play`: never gates anything.
//
// Its own module rather than part of play.js: it needs the NIGHT config,
// whose sections import scenes that import play.js.

const EPS = 1e-4;
const KEY_TWEEN_MS = 800; // PLAN-2.md 3.2.4
const REDUCED_LOCK_MS = 150; // reduced motion: beats land at once; just debounce

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// power2.inOut, same curve GSAP uses for the melts.
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function createNightGate(sections) {
  const lockUntil = new Map(); // id -> performance.now() until which a beat is still playing
  const tweens = new Map(); // id -> requestAnimationFrame handle of a key tween

  const gated = index => {
    const section = sections[index];
    const play = section?.play;
    if (!play || !DREAMS[section.id] || (play.model !== 'beats' && play.model !== 'scrub')) return null;
    return { id: section.id, play };
  };

  const last = play => (play.model === 'beats' ? play.beats - 1 : 1);

  const cancelTween = id => {
    cancelAnimationFrame(tweens.get(id));
    tweens.delete(id);
  };

  const tweenTo = (id, to) => {
    cancelTween(id);
    const from = getPlay(id).target;
    if (reducedMotion() || Math.abs(to - from) < EPS) {
      setTarget(id, to);
      return;
    }
    const start = performance.now();
    const frame = now => {
      const t = Math.min(1, (now - start) / KEY_TWEEN_MS);
      setTarget(id, from + (to - from) * easeInOut(t));
      if (t < 1) tweens.set(id, requestAnimationFrame(frame));
      else tweens.delete(id);
    };
    tweens.set(id, requestAnimationFrame(frame));
  };

  const locked = id => performance.now() < (lockUntil.get(id) ?? 0);

  return {
    canLeave(index, dir) {
      const g = gated(index);
      if (!g) return true;
      if (locked(g.id) || tweens.has(g.id)) return false;
      const { target } = getPlay(g.id);
      return dir > 0 ? target >= last(g.play) - EPS : target <= EPS;
    },

    // `step`: this input is one discrete step — the start of a wheel gesture,
    // a touch crossing the swipe threshold, a key press. `deltaPx`: signed
    // scroll distance (wheel, or touch already multiplied by its gain).
    // Returns true when the input was the dream's to use (always, here).
    consume(index, dir, { source, deltaPx = 0, step = false } = {}) {
      const g = gated(index);
      if (!g) return false;
      const { id, play } = g;
      const { target } = getPlay(id);

      if (play.model === 'beats') {
        if (!step || locked(id)) return true;
        const next = Math.min(Math.max(Math.round(target) + dir, 0), play.beats - 1);
        if (next === Math.round(target)) return true;
        setTarget(id, next);
        lockUntil.set(id, performance.now() + (reducedMotion() ? REDUCED_LOCK_MS : play.beatDuration * 1000));
        return true;
      }

      // scrub
      if (source === 'key') {
        if (!step || tweens.has(id)) return true;
        const stops = play.stops ?? [0, 1];
        const next = dir > 0 ? (stops.find(s => s > target + EPS) ?? 1) : ([...stops].reverse().find(s => s < target - EPS) ?? 0);
        tweenTo(id, next);
        return true;
      }
      cancelTween(id);
      setTarget(id, Math.min(Math.max(target + deltaPx / play.length, 0), 1));
      return true;
    },

    // Section `index` just became a neighbour: leave it as it will be found —
    // at its start if it will be entered moving forward, at its end if
    // entered moving back. Returns true when that changed its state.
    prepare(index, entryDir) {
      const g = gated(index);
      if (!g) return false;
      const to = entryDir > 0 ? 0 : last(g.play);
      cancelTween(g.id);
      lockUntil.delete(g.id);
      if (Math.abs(getPlay(g.id).target - to) < EPS) return false;
      setTarget(g.id, to, { snap: true });
      return true;
    },

    // A jump (goTo) lands here: start from the beginning.
    reset(index) {
      const g = gated(index);
      if (!g) return;
      cancelTween(g.id);
      lockUntil.delete(g.id);
      setTarget(g.id, 0, { snap: true });
    }
  };
}
