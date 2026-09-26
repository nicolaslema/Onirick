import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { fontsLoaded } from '../../lib/fonts';
import { DPR_CAP } from '../../lib/dpr';
import { HAS_WEBGL2 } from '../../lib/webgl';
import { loadCaptureLib, useSectionTextures } from './useSectionTextures';
import { normalizeDelta, scrubStrategy } from './useWheelProgress';
import { ScrollSectionsContext, SectionIdContext, SectionIndexContext } from './ScrollSectionsContext';

import './ScrollSections.css';

// Normalized scroll pixels needed for a full 0->1 transition between two
// sections. Starting point, needs on-device tuning.
const PX_PER_TRANSITION = 900;
const RESIZE_DEBOUNCE_MS = 200;
// A touch drag past this many vertical pixels commits to one section change,
// same idea as one wheel tick in 'snap' mode.
const TOUCH_SWIPE_PX = 40;
// A finger travels less than a wheel scrolls: touch deltas fed to a gated
// section's scrub are multiplied by this (PLAN-2.md 3.2.3).
const TOUCH_SCRUB_GAIN = 2.5;
// Wheel events closer together than this belong to the same gesture — see
// handleSnapWheel's edge rule for a 'scroll'-kind section.
const WHEEL_GESTURE_GAP_MS = 200;
// Any of these means a section change may be imminent: build the melt
// engine now (see the first-load effect).
const INTENT_EVENTS = ['pointermove', 'pointerdown', 'touchstart', 'wheel', 'keydown'];
// One arrow-key step inside a 'scroll'-kind section.
const KEY_SCROLL_PX = 80;
// Must match .scroll-sections-canvas's `transition: opacity ...` duration in
// ScrollSections.css — see setCanvasVisible below.
const CANVAS_FADE_MS = 150;
// A gesture held while its captures are taken is dropped after this long
// (PLAN-2.md 3.2.8) — any later and it would feel like a lag, not a response.
const PENDING_NAV_MS = 600;
// Retaking a section's capture after its text changed (PLAN-2.md 3.4):
// wait for the changes to stop, then for the browser to be idle.
const RECAPTURE_DEBOUNCE_MS = 250;

// Scroll-driven version of MorphSlider: instead of morphing between slide
// images on click/drag, this morphs between whole page sections on
// wheel/trackpad/touch. Each section is rendered as real, accessible DOM
// (only the current one is visible/interactive) and the WebGL canvas is a
// transient overlay shown only while a transition is in progress.
//
// `mode` controls how a wheel gesture drives the transition:
// - 'snap' (default): one wheel tick commits a full transition to the next
//   /previous section via a tween, like a slide deck. Simple, and immune to
//   the scrub mode's direction-sign bug below.
// - 'scrub': progress tracks the wheel in real time, no auto-complete.
//
// Each entry in `sections` can also declare:
// - `kind`: 'morph' (default) melts into a morph neighbour via the WebGL
//   engine; 'scroll' is a plain section that can be taller than the
//   viewport and scrolls internally with native browser scroll (see
//   .scroll-sections-capture--scroll) instead of being captured/melted. A
//   transition into or out of a 'scroll' section never touches the WebGL
//   engine at all — it's a lightweight CSS crossfade instead (see
//   runPlainTransition below), and only fires once that section's own
//   internal scroll has reached the edge being pushed against. 'scroll'
//   kind and touch swiping are currently only wired up for mode 'snap'.
// - `melt`: overrides (duration, ease, intensity, scale, aberration, drift,
//   overlayColor, burn — a full-frame fade into overlayColor mid-melt) for
//   the transition whose destination is this section — i.e. transition i
//   (between sections i-1 and i) always uses section i's `melt`, in both
//   directions. Falls back to this component's own props.
// - `detour`: reached by a goTo() jump that skips sections before it, it's a
//   side trip — leaving it by either edge crossfades back to where the jump
//   came from (the manual, opened from the hero, returns to the hero).
// - `plainDuration`: same idea for a crossfade whose destination is this
//   section (used whenever either side of the transition is 'scroll', or
//   for a goTo() jump landing here).
//
// `gate` (optional) lets a section keep gestures for itself before they
// change section — a dream's own scrub or beats (PLAN-2.md 3.2). Four
// methods, all by section index:
// - canLeave(index, dir): may a gesture in `dir` leave this section now?
// - consume(index, dir, { source: 'wheel' | 'touch' | 'key', deltaPx, step }):
//   the gesture stays in the section; `step` marks a discrete step (a wheel
//   gesture's start, a swipe crossing its threshold, a key press).
// - prepare(index, entryDir): `index` just became a neighbour and will be
//   entered moving `entryDir` — set it up as it will be found (true if that
//   changed it, so its capture is retaken).
// - reset(index): a goTo() jump is landing there.
// Same edge rule as a 'scroll' section: the gesture that carries a gated
// section to its end doesn't also leave it; a fresh gesture does.
//
// Sections rendered inside <ScrollSections> can call useScrollSections()
// (ScrollSectionsContext.js) for { currentIndex, activeTransition, goTo,
// inDetour }.
// A sibling of <ScrollSections> (e.g. a Hud) can't reach that context, so
// ScrollSections also takes an onStateChange callback mirroring the same
// { currentIndex, activeTransition } out to the parent.
export default function ScrollSections({
  sections,
  mode = 'snap',
  transition = 'melt',
  duration = 1.5,
  plainDuration = 0.6,
  ease = 'power2.inOut',
  intensity = 0.85,
  scale = 5,
  aberration = 0.35,
  drift = 0.4,
  overlayColor = '#000000',
  burn = 0,
  gate,
  onStateChange,
  onReady
}) {
  const stageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const sectionHostRefs = useRef([]);
  const engineRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const plainTimeoutRef = useRef(null);
  // { y, lastY, consumed: changed section, stepped: took a gated beat, scrolled } | null
  const touchRef = useRef(null);
  const gateRef = useRef(gate);
  gateRef.current = gate;
  // One gesture that arrived before its captures were ready, retried once
  // they are (PLAN-2.md 3.2.8). { target, dir, at } | null.
  const pendingNavRef = useRef(null);
  const goToIndexRef = useRef(null);
  // Sections whose capture must be retaken once nothing is moving (3.4).
  const recaptureRef = useRef({ indices: new Set(), timer: 0 });
  const wheelGestureRef = useRef({ lastAt: 0, dir: 0, scrolled: false });

  const [currentIndex, setCurrentIndex] = useState(0);
  const [plainTransition, setPlainTransition] = useState(null); // { from, to } | null
  const [activeTransition, setActiveTransition] = useState(null); // { from, to } | null — morph or plain
  // Bumped when every cached capture is thrown away (resize), so the
  // pre-capture effect below runs again for the current section's neighbours.
  const [captureEpoch, setCaptureEpoch] = useState(0);
  // A detour: a jump (goTo) straight into a `detour: true` section that
  // skipped the sections before it. Until it's left, leaving that section by
  // either edge returns to where the jump came from instead of stepping on to
  // its neighbours — see goToIndex. { at, back } | null.
  const detourRef = useRef(null);
  const [inDetour, setInDetour] = useState(false);
  const currentIndexRef = useRef(0);
  const progressRef = useRef(0);
  const dirRef = useRef(0);

  // basePropsRef always mirrors this component's own props (safe to
  // overwrite every render). optsRef is what the engine actually reads
  // (MorphEngine's getOptions) and is ONLY ever written imperatively —
  // never during render — so a per-transition override set right before a
  // melt starts can't be clobbered by an unrelated re-render landing
  // mid-transition. settle() resets it back to the base props once a
  // transition finishes.
  const basePropsRef = useRef();
  basePropsRef.current = { transition, duration, plainDuration, ease, intensity, scale, aberration, drift, overlayColor, burn };
  const optsRef = useRef({ ...basePropsRef.current });

  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const kindOf = useCallback(index => sections[index]?.kind ?? 'morph', [sections]);

  // Resolves each section into a texture the morph engine can sample — a
  // full DOM capture (background shader + real content composited), kept
  // fresh via periodic re-capture while actively part of a transition. See
  // useSectionTextures.js.
  const sectionTextures = useSectionTextures(sectionHostRefs);

  // Setting `visibility: hidden` synchronously alongside `opacity: 0` short-
  // circuits ScrollSections.css's opacity transition on this canvas —
  // visibility isn't itself transitioned, so the element stops being
  // rendered on the very next frame regardless of how long the opacity fade
  // is *supposed* to take. That meant every transition ended (and began)
  // with a hard, same-frame cut between the melt's last WebGL frame (a
  // resampled domToCanvas texture, never pixel-identical to real DOM text)
  // and the real section underneath — the "snap to the static look" this
  // fixes. Hiding still needs `visibility` (so the fully-transparent canvas
  // doesn't stay in the paint/compositing tree indefinitely), just deferred
  // until the opacity fade it's paired with has actually finished.
  const canvasHideTimeoutRef = useRef(null);
  const setCanvasVisible = useCallback(visible => {
    const canvas = engineRef.current?.canvas;
    if (!canvas) return;
    clearTimeout(canvasHideTimeoutRef.current);
    if (visible) {
      engineRef.current.start();
      canvas.style.visibility = 'visible';
      canvas.style.opacity = '1';
      return;
    }
    canvas.style.opacity = '0';
    canvasHideTimeoutRef.current = setTimeout(() => {
      canvas.style.visibility = 'hidden';
      engineRef.current?.stop();
    }, CANVAS_FADE_MS);
  }, []);

  const stopLiveRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      cancelAnimationFrame(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  // Re-composites the two sections of an in-flight melt from their live
  // canvases (useSectionTextures' refresh()) every frame, so their scenes
  // keep moving at full frame rate inside the melt. It used to run every
  // 80 ms, which showed any fast scene (the fall) at ~12 fps for the whole
  // transition and then snapped to full speed once it settled. A refresh is
  // a GPU canvas-to-canvas draw plus a texture upload — measured at
  // ~0.2 ms, cheap enough to do per frame.
  const startLiveRefresh = useCallback(
    (fromIndex, toIndex) => {
      stopLiveRefresh();
      // Text-only overlays (normally already pre-built by the pre-capture
      // effect) that refresh() layers back on top of the live canvas.
      sectionTextures.prepareOverlay(fromIndex);
      sectionTextures.prepareOverlay(toIndex);
      const tick = () => {
        sectionTextures.refresh(fromIndex);
        sectionTextures.refresh(toIndex);
        refreshTimerRef.current = requestAnimationFrame(tick);
      };
      // Synchronously for the first one: the cached capture is from
      // whenever the section was last settled, so an animated scene would
      // otherwise show that stale pose on the melt's first frame.
      tick();
    },
    [sectionTextures, stopLiveRefresh]
  );

  // `dir` (1 forward, -1 backward, 0 unknown) is only used to decide, for a
  // 'scroll'-kind section becoming current, which end of its own content to
  // land on — arriving from above starts at its top, arriving from below
  // (scrolling backward past it) starts at its bottom, so continuing to
  // scroll in that same direction doesn't require re-crossing content
  // that's already been seen.
  const settle = useCallback(
    (newIndex, dir = 0) => {
      stopLiveRefresh();
      currentIndexRef.current = newIndex;
      setCurrentIndex(newIndex);
      if (detourRef.current && detourRef.current.at !== newIndex) {
        detourRef.current = null;
        setInDetour(false);
      }
      setActiveTransition(null);
      progressRef.current = 0;
      dirRef.current = 0;
      // Back to this component's own props — see the comment on optsRef.
      optsRef.current = { ...basePropsRef.current };
      // Canvas hide is intentionally NOT done here — see the layout effect
      // below keyed on `currentIndex`. Hiding it synchronously in this same
      // tick (a raw DOM write) could momentarily run ahead of React actually
      // committing the new section's visibility swap (a state update), which
      // would flash the previous section's real DOM for a frame before the
      // new one settles in.
      if (kindOf(newIndex) === 'scroll') {
        const scroller = sectionHostRefs.current[newIndex];
        if (scroller) scroller.scrollTop = dir < 0 ? scroller.scrollHeight : 0;
      }
      // Neighbour prefetch happens in the effect keyed on currentIndex below,
      // not here: a neighbour's 3D scene (SceneCanvas) only mounts once React
      // commits this index change, so capturing it from here would snapshot
      // the section before its scene exists and cache that forever.
    },
    [stopLiveRefresh, kindOf]
  );

  // Lightweight alternative to the WebGL melt for any transition touching a
  // 'scroll'-kind section, or a goTo() jump between non-adjacent sections:
  // both the outgoing and incoming section are kept on-screen (stacked, see
  // the render below) for the resolved plainDuration while a pure CSS
  // opacity crossfade (see ScrollSections.css) plays, then settle() runs
  // exactly as it would after a morph transition completes. `destIndex` is
  // the section whose plainDuration override applies — the higher index of
  // an adjacent pair (matching how melt overrides resolve, so a section's
  // crossfade is the same length in both directions), or the jump's actual
  // target for a non-adjacent goTo().
  const runPlainTransition = useCallback(
    (fromIndex, toIndex, dir, destIndex) => {
      dirRef.current = dir;
      setActiveTransition({ from: fromIndex, to: toIndex });
      const plainMs = (sections[destIndex]?.plainDuration ?? basePropsRef.current.plainDuration) * 1000;
      if (stageRef.current) {
        stageRef.current.style.setProperty('--scroll-sections-plain-duration', `${plainMs / 1000}s`);
      }
      setPlainTransition({ from: fromIndex, to: toIndex });
      clearTimeout(plainTimeoutRef.current);
      plainTimeoutRef.current = setTimeout(() => {
        setPlainTransition(null);
        settle(toIndex, dir);
      }, plainMs);
    },
    [settle, sections]
  );

  // Hides the transition canvas only once React has committed the DOM for
  // the newly-current section, so the canvas-hide and the section-swap
  // always land in the same paint.
  useLayoutEffect(() => {
    setCanvasVisible(false);
    // A button that triggered the change (BEGIN RECORDING, REPLAY THE
    // NIGHT, ...) now sits inside an inert, off-screen section; the browser
    // drops its focus to <body> on the next frame, where arrow keys no
    // longer reach the stage. Hand focus to the stage before that happens.
    const focused = document.activeElement;
    const inCurrent = sectionHostRefs.current[currentIndex]?.contains(focused);
    if (!inCurrent && (focused === document.body || stageRef.current?.contains(focused))) {
      stageRef.current?.focus({ preventScroll: true });
    }
  }, [currentIndex, setCanvasVisible]);

  // Pre-captures the current section and its morph-kind neighbours (the only
  // sections the next gesture can melt between), plus their text-only
  // overlays, so a transition can start without waiting on domToCanvas.
  // Runs after commit, so any SceneCanvas a neighbour just mounted is already
  // in the DOM and capture() waits for it to render (waitForCanvasesReady).
  // A 'scroll' section is never a melt texture, so it's skipped.
  useEffect(() => {
    // A gated neighbour is left as it will be found before it's captured:
    // the one below at its start, the one above at its end (PLAN-2.md 3.3).
    // If that changed it, its cached capture shows the old state — retake it.
    for (const [i, entryDir] of [
      [currentIndex - 1, -1],
      [currentIndex + 1, 1]
    ]) {
      if (i < 0 || i >= sections.length) continue;
      if (gateRef.current?.prepare(i, entryDir)) sectionTextures.invalidate(i, engineRef.current?.gl);
    }
    if (!HAS_WEBGL2) return undefined;
    let cancelled = false;
    fontsLoaded().then(() => {
      if (cancelled) return;
      for (const i of [currentIndex, currentIndex - 1, currentIndex + 1]) {
        if (i < 0 || i >= sections.length || kindOf(i) !== 'morph') continue;
        sectionTextures.capture(i);
        sectionTextures.prepareOverlay(i);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [currentIndex, captureEpoch, sections.length, sectionTextures, kindOf]);

  // Throws a section's capture away and retakes it (PLAN-2.md 3.4) — for a
  // section whose text changed while it sat cached (a transcript that
  // finished typing, a recording that grew). Debounced, never mid-transition
  // (the engine may be sampling that texture), and in idle time: a capture
  // costs 100-400 ms. Only the current section and its neighbours are
  // retaken right away; any other one is simply captured fresh when it next
  // becomes a neighbour.
  const recapture = useCallback(
    index => {
      if (!HAS_WEBGL2 || index < 0 || index >= sections.length || kindOf(index) !== 'morph') return;
      const r = recaptureRef.current;
      r.indices.add(index);
      const busy = () => dirRef.current !== 0 || !!engineRef.current?.animating;
      const idle = window.requestIdleCallback ?? (cb => setTimeout(cb, 0));
      const flush = () => {
        if (busy()) {
          r.timer = setTimeout(flush, RECAPTURE_DEBOUNCE_MS);
          return;
        }
        idle(
          () => {
            if (busy()) {
              r.timer = setTimeout(flush, RECAPTURE_DEBOUNCE_MS);
              return;
            }
            const indices = [...r.indices];
            r.indices.clear();
            for (const i of indices) {
              sectionTextures.invalidate(i, engineRef.current?.gl);
              if (Math.abs(i - currentIndexRef.current) > 1) continue;
              sectionTextures.capture(i);
              sectionTextures.prepareOverlay(i);
            }
          },
          { timeout: 500 }
        );
      };
      clearTimeout(r.timer);
      r.timer = setTimeout(flush, RECAPTURE_DEBOUNCE_MS);
    },
    [sections.length, kindOf, sectionTextures]
  );
  useEffect(() => () => clearTimeout(recaptureRef.current.timer), []);

  // Mirrors { currentIndex, activeTransition } out to a sibling that can't
  // reach ScrollSectionsContext (e.g. a Hud rendered next to
  // <ScrollSections> rather than inside it — see App.jsx).
  useEffect(() => {
    onStateChange?.({ currentIndex, activeTransition });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeTransition]);

  // First load: capture sections 0 and 1 (what the first gesture melts
  // between), reveal the page (onReady → App's Loader lifts), then prefetch
  // the shared morph engine's code. The engine itself — a second WebGL
  // context plus a shader compile — is only built on the first sign the
  // visitor is about to move: a pointer move, touch, wheel or key, caught on
  // window in the capture phase, i.e. before this component's own handler
  // for that same event runs. Nothing melts before then, and a visitor who
  // never scrolls never pays for it. The engine's and the capture library's
  // code both load on demand, out of the first JS chunk.
  useEffect(() => {
    if (!canvasHostRef.current) return undefined;
    let cancelled = false;
    let engine = null;
    let removeIntentListeners = () => {};
    if (!HAS_WEBGL2) {
      // Nothing to capture: the page is ready as soon as its fonts are.
      fontsLoaded().then(() => {
        if (!cancelled) onReadyRef.current?.();
      });
      return () => {
        cancelled = true;
      };
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    Promise.all([loadCaptureLib(), fontsLoaded()])
      .then(() => new Promise(resolve => requestAnimationFrame(resolve)))
      .then(() => {
        if (cancelled) return null;
        // Sections 0 and 1 are captured as they are right now, so the caller
        // must keep them in their resting state until onReady fires (Hero
        // holds its entrance animation). A 'scroll' section never melts.
        const ready = [];
        if (kindOf(0) === 'morph') ready.push(sectionTextures.capture(0));
        if (sections.length > 1 && kindOf(1) === 'morph') ready.push(sectionTextures.capture(1));
        return Promise.all(ready);
      })
      .then(() => {
        if (cancelled) return null;
        onReadyRef.current?.();
        return import('../../lib/morph/MorphEngine');
      })
      .then(mod => {
        if (cancelled || !mod) return;
        const build = () => {
          removeIntentListeners();
          if (cancelled || engine) return;
          engine = new mod.MorphEngine(canvasHostRef.current, {
            reducedMotion,
            getOptions: () => optsRef.current,
            dprCap: DPR_CAP,
            canvasClassName: 'scroll-sections-canvas',
            autoRun: false // runs only while its canvas is shown — see setCanvasVisible
          });
          engineRef.current = engine;
          const descriptor = kindOf(0) === 'morph' ? sectionTextures.getTexture(0, engine.gl) : null;
          if (descriptor) engine.setCurrent(descriptor);
        };
        removeIntentListeners = () => INTENT_EVENTS.forEach(type => window.removeEventListener(type, build, true));
        INTENT_EVENTS.forEach(type => window.addEventListener(type, build, { capture: true, passive: true }));
      });

    return () => {
      cancelled = true;
      removeIntentListeners();
      stopLiveRefresh();
      clearTimeout(plainTimeoutRef.current);
      clearTimeout(canvasHideTimeoutRef.current);
      if (engine) {
        sectionTextures.invalidateAll(engine.gl);
        engine.destroy();
      }
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resizing mid-transition invalidates a section's captured pixel
  // dimensions, so hard-reset to the settled section rather than trying to
  // resize textures mid-morph, then re-capture once things stop moving.
  useEffect(() => {
    let timeout;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        if (!HAS_WEBGL2) return;
        // The engine may not exist yet (it's built on first intent) — the
        // cached captures still have to go, or they'd melt at the old size.
        const engine = engineRef.current;
        if (engine && (dirRef.current !== 0 || engine.animating)) {
          stopLiveRefresh();
          engine.reset();
          clearTimeout(plainTimeoutRef.current);
          setPlainTransition(null);
          setActiveTransition(null);
          dirRef.current = 0;
          progressRef.current = 0;
          optsRef.current = { ...basePropsRef.current };
          setCanvasVisible(false);
        }
        sectionTextures.invalidateAll(engine?.gl);
        setCaptureEpoch(epoch => epoch + 1);
        if (engine && kindOf(currentIndexRef.current) === 'morph') {
          sectionTextures.capture(currentIndexRef.current).then(canvas => {
            if (!canvas) return;
            const descriptor = sectionTextures.getTexture(currentIndexRef.current, engine.gl);
            if (descriptor) engine.setCurrent(descriptor);
          });
        }
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', onResize);
    };
  }, [sectionTextures, setCanvasVisible, stopLiveRefresh, kindOf]);

  const goToIndex = useCallback(
    (targetIndex, dir) => {
      if (engineRef.current?.animating || dirRef.current !== 0) return;
      const detour = detourRef.current;
      if (detour && currentIndexRef.current === detour.at) {
        // Either edge of a detour section leads back to where the jump
        // came from — a crossfade, like any non-adjacent move.
        runPlainTransition(detour.at, detour.back, -1, detour.back);
        return;
      }
      if (targetIndex < 0 || targetIndex >= sections.length) return;

      const destIndex = Math.max(currentIndexRef.current, targetIndex);

      // A transition only runs the WebGL melt when BOTH sides are 'morph' —
      // capturing/texturing a 'scroll' section as a melt target doesn't make
      // sense for something meant to read as plain scrolling content, so
      // either side being 'scroll' falls back to the plain CSS crossfade.
      // No WebGL2 (PLAN.md 6): no melt engine at all, every transition fades.
      if (!HAS_WEBGL2 || kindOf(currentIndexRef.current) !== 'morph' || kindOf(targetIndex) !== 'morph') {
        runPlainTransition(currentIndexRef.current, targetIndex, dir, destIndex);
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      if (!sectionTextures.isReady(currentIndexRef.current) || !sectionTextures.isReady(targetIndex)) {
        // Not captured yet (or retaken after its text changed): hold this
        // one gesture and replay it once both captures land, unless that
        // takes longer than PENDING_NAV_MS or something else moved first.
        const from = currentIndexRef.current;
        const at = performance.now();
        pendingNavRef.current = { target: targetIndex, dir, at };
        Promise.all([sectionTextures.capture(from), sectionTextures.capture(targetIndex)]).then(() => {
          const pending = pendingNavRef.current;
          if (pending?.at !== at) return;
          pendingNavRef.current = null;
          if (performance.now() - at > PENDING_NAV_MS || currentIndexRef.current !== from) return;
          goToIndexRef.current?.(pending.target, pending.dir);
        });
        return;
      }
      pendingNavRef.current = null;

      const currentDesc = sectionTextures.getTexture(currentIndexRef.current, engine.gl);
      const nextDesc = sectionTextures.getTexture(targetIndex, engine.gl);
      if (!currentDesc || !nextDesc) return;

      // Transition i (between sections i-1 and i) always uses section i's
      // own melt override, in both directions — destIndex is always the
      // higher of the two indices regardless of which way we're going.
      optsRef.current = { ...basePropsRef.current, ...(sections[destIndex]?.melt ?? {}) };
      // The render loop only calls this itself when neither dragging nor
      // animating (see MorphEngine.loop) — during the tween that's about to
      // start, it won't, so push the merged options onto the uniforms once,
      // explicitly, right now.
      engine.syncOptions();

      dirRef.current = dir;
      setActiveTransition({ from: currentIndexRef.current, to: targetIndex });
      engine.prepareTransition(currentDesc, nextDesc, dir);
      // Refresh first: showing the canvas draws a frame immediately, and it
      // must already hold both scenes' live pose, not their cached one.
      startLiveRefresh(currentIndexRef.current, targetIndex);
      setCanvasVisible(true);
      engine.animateProgress(1, {
        duration: optsRef.current.duration,
        ease: optsRef.current.ease,
        onComplete: () => {
          engine.commit();
          settle(targetIndex, dir);
        }
      });
    },
    [sections, sectionTextures, setCanvasVisible, settle, startLiveRefresh, kindOf, runPlainTransition]
  );
  goToIndexRef.current = goToIndex;

  // Jumps to any section by id or index. Adjacent to the current section:
  // behaves exactly like a wheel tick (melt if both sides are 'morph',
  // otherwise the plain crossfade). Non-adjacent: always the plain
  // crossfade — a melt is only ever textured for two neighbours, so there's
  // no sensible melt appearance for a jump — using the target section's own
  // plainDuration (its "entrance" crossfade, the same idea as a melt
  // override, just not tied to a specific neighbour).
  const goTo = useCallback(
    target => {
      const targetIndex = typeof target === 'string' ? sections.findIndex(s => s.id === target) : target;
      if (targetIndex < 0 || targetIndex >= sections.length) return;
      if (engineRef.current?.animating || dirRef.current !== 0) return;

      const from = currentIndexRef.current;
      if (targetIndex === from) return;
      const dir = targetIndex > from ? 1 : -1;

      if (Math.abs(targetIndex - from) === 1) {
        goToIndex(targetIndex, dir);
      } else {
        // Jumping ahead into a detour section (READ THE MANUAL from the
        // hero) skips the night before it; remember where to return.
        if (sections[targetIndex]?.detour && targetIndex > from) {
          detourRef.current = { at: targetIndex, back: from };
          setInDetour(true);
        }
        // A jump lands on a dream at its start, whatever state it was left in.
        gateRef.current?.reset(targetIndex);
        runPlainTransition(from, targetIndex, dir, targetIndex);
      }
    },
    [sections, goToIndex, runPlainTransition]
  );

  // dir>0: wants to advance (down/forward). dir<0: wants to go back
  // (up/backward). True once a 'scroll'-kind section's own content has
  // nothing more to reveal in that direction (or isn't 'scroll' at all, so
  // there's nothing to consume in the first place) — shared by the wheel
  // and touch handlers below.
  const atScrollEdge = useCallback(
    (index, dir) => {
      if (kindOf(index) !== 'scroll') return true;
      const scroller = sectionHostRefs.current[index];
      if (!scroller) return true;
      const atTop = scroller.scrollTop <= 0;
      const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      return dir > 0 ? atBottom : atTop;
    },
    [kindOf]
  );

  // The gate's half of "may this gesture leave the section" (see `gate`
  // above); no gate means yes.
  const gateCanLeave = useCallback((index, dir) => gateRef.current?.canLeave(index, dir) ?? true, []);

  // 'snap': one wheel tick commits a whole transition via goToIndex's tween.
  // While that tween is in flight, engine.animating (and dirRef, set inside
  // goToIndex or runPlainTransition) block further calls, so the many wheel
  // events a single scroll gesture fires don't trigger multiple section
  // changes.
  const handleSnapWheel = useCallback(
    e => {
      if (engineRef.current?.animating || dirRef.current !== 0) {
        e.preventDefault();
        return;
      }

      const deltaPx = normalizeDelta(e);
      if (deltaPx === 0) return;
      const wheelDir = Math.sign(deltaPx);

      // Wheel events closer together than WHEEL_GESTURE_GAP_MS (a trackpad's
      // momentum tail included) are one gesture.
      const now = performance.now();
      const gesture = wheelGestureRef.current;
      if (now - gesture.lastAt > WHEEL_GESTURE_GAP_MS || gesture.dir !== wheelDir) {
        gesture.scrolled = false;
        gesture.dir = wheelDir;
      }
      gesture.lastAt = now;

      // A 'scroll'-kind current section owns the wheel until its own
      // content has reached the edge being pushed against — let the browser
      // scroll it natively (no preventDefault) instead of advancing to the
      // next/previous section.
      if (!atScrollEdge(currentIndexRef.current, wheelDir)) {
        gesture.scrolled = true;
        return;
      }

      e.preventDefault();
      // A gated section (a dream's scrub or beats) keeps the gesture until it
      // reaches its own end — same edge rule as the manual below.
      if (!gateCanLeave(currentIndexRef.current, wheelDir)) {
        gateRef.current.consume(currentIndexRef.current, wheelDir, { source: 'wheel', deltaPx, step: !gesture.scrolled });
        gesture.scrolled = true;
        return;
      }
      // The gesture that carried the content to its edge doesn't also leave
      // the section — otherwise the momentum tail of every flick to the
      // bottom of the manual would fire straight into Dream 04. A fresh
      // gesture at the edge does.
      if (gesture.scrolled) return;
      goToIndex(currentIndexRef.current + wheelDir, wheelDir);
    },
    [goToIndex, atScrollEdge, gateCanLeave]
  );

  // 'scrub': progress follows the wheel in real time. `deltaPx` is signed
  // relative to dirRef (not the raw wheel delta) before being handed to
  // scrubStrategy — see the comment on scrubStrategy for why: passing the
  // raw delta makes a backward transition's progress go negative and clamp
  // to 0 on the very first tick, i.e. scrolling back never appears to work.
  const handleScrubWheel = useCallback(
    e => {
      e.preventDefault();
      const engine = engineRef.current;
      if (!engine || engine.animating) return;

      const deltaPx = normalizeDelta(e);
      if (deltaPx === 0) return;
      const wheelDir = Math.sign(deltaPx);

      if (dirRef.current === 0) {
        const from = currentIndexRef.current;
        const target = from + wheelDir;
        if (target < 0 || target >= sections.length) return;

        if (!sectionTextures.isReady(from)) return;
        if (!sectionTextures.isReady(target)) {
          sectionTextures.capture(target);
          return;
        }

        const currentDesc = sectionTextures.getTexture(from, engine.gl);
        const nextDesc = sectionTextures.getTexture(target, engine.gl);
        if (!currentDesc || !nextDesc) return;

        dirRef.current = wheelDir;
        engine.prepareTransition(currentDesc, nextDesc, wheelDir);
        startLiveRefresh(from, target);
      }

      const signedDeltaPx = deltaPx * dirRef.current;
      progressRef.current = scrubStrategy(signedDeltaPx, progressRef.current, {
        pxPerFullTransition: PX_PER_TRANSITION
      });
      engine.setProgress(progressRef.current);
      setCanvasVisible(progressRef.current > 0);

      if (progressRef.current >= 1) {
        engine.commit();
        settle(currentIndexRef.current + dirRef.current, dirRef.current);
      } else if (progressRef.current <= 0) {
        stopLiveRefresh();
        dirRef.current = 0;
        setCanvasVisible(false);
      }
    },
    [sections.length, sectionTextures, setCanvasVisible, settle, startLiveRefresh, stopLiveRefresh]
  );

  const handleWheel = mode === 'scrub' ? handleScrubWheel : handleSnapWheel;

  // Touch swipe — only wired up for 'snap' mode, same as 'scroll' kind (see
  // the doc comment above). A vertical drag past TOUCH_SWIPE_PX commits to
  // one section change, same threshold-then-commit shape as a wheel tick
  // rather than scrub's continuous tracking.
  const handleTouchStart = useCallback(
    e => {
      if (mode !== 'snap' || e.touches.length !== 1) return;
      const y = e.touches[0].clientY;
      touchRef.current = { y, lastY: y, consumed: false, stepped: false, scrolled: false };
    },
    [mode]
  );

  const handleTouchMove = useCallback(
    e => {
      const start = touchRef.current;
      if (!start || start.consumed) return;

      const y = e.touches[0].clientY;
      const deltaY = start.y - y; // >0: swiping up (advance)
      const dir = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;

      if (dir !== 0 && !atScrollEdge(currentIndexRef.current, dir)) {
        start.scrolled = true; // let native scroll happen
        return;
      }
      // A gated dream keeps the swipe: a scrub follows the finger (the move
      // since the last touchmove, amplified — a finger travels less than a
      // wheel), beats take one step when the swipe crosses its threshold.
      if (dir !== 0 && !gateCanLeave(currentIndexRef.current, dir)) {
        if (e.cancelable) e.preventDefault();
        if (engineRef.current?.animating || dirRef.current !== 0) return;
        // `stepped`, not `consumed`: a scrub keeps following the finger
        // after the threshold; only a beat is limited to one per swipe.
        const crossed = !start.stepped && Math.abs(deltaY) >= TOUCH_SWIPE_PX;
        if (crossed) start.stepped = true;
        gateRef.current.consume(currentIndexRef.current, dir, {
          source: 'touch',
          deltaPx: (start.lastY - y) * TOUCH_SCRUB_GAIN,
          step: crossed
        });
        start.lastY = y;
        start.scrolled = true;
        return;
      }
      start.lastY = y;
      // Same rule as the wheel: the swipe that scrolled the content to its
      // edge doesn't also change section; the next one does.
      if (start.scrolled) return;
      if (Math.abs(deltaY) < TOUCH_SWIPE_PX) return;

      // Not cancelable once the browser has started a native scroll for
      // this touch; calling preventDefault() then only logs an error.
      if (e.cancelable) e.preventDefault();
      start.consumed = true;
      goToIndex(currentIndexRef.current + dir, dir);
    },
    [goToIndex, atScrollEdge, gateCanLeave]
  );

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  // Arrow keys / PageUp / PageDown inside a 'scroll'-kind section scroll its
  // content first (the stage, not the scroller, holds focus, so the browser
  // wouldn't); only once that edge is reached do they change section.
  const stepOrScroll = useCallback(
    (dir, page) => {
      const index = currentIndexRef.current;
      if (!atScrollEdge(index, dir)) {
        const scroller = sectionHostRefs.current[index];
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const amount = page ? scroller.clientHeight * 0.85 : KEY_SCROLL_PX;
        scroller.scrollBy({ top: dir * amount, behavior: reduced ? 'auto' : 'smooth' });
        return;
      }
      // A gated dream: a key is one step (a beat, or the scrub's next stop).
      if (!gateCanLeave(index, dir)) {
        if (!engineRef.current?.animating && dirRef.current === 0) gateRef.current.consume(index, dir, { source: 'key', page, step: true });
        return;
      }
      goToIndex(index + dir, dir);
    },
    [atScrollEdge, gateCanLeave, goToIndex]
  );

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        stepOrScroll(1, e.key === 'PageDown');
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        stepOrScroll(-1, e.key === 'PageUp');
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(sections.length - 1);
      }
    },
    [stepOrScroll, goTo, sections.length]
  );

  // Wheel and touchmove are attached natively, non-passive: React registers
  // its onWheel/onTouchMove as passive listeners, where preventDefault() is
  // ignored (and Chrome logs an error for every call) — and these handlers
  // need it, e.g. to stop the manual's scroll from chaining at its edges.
  // Keys are heard on window, not the stage: the stage only has focus after
  // a click, so arrows would do nothing for someone arriving by keyboard or
  // after only using the wheel. Modified keys (browser shortcuts) pass.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return undefined;
    const onKey = e => {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      handleKeyDown(e);
    };
    stage.addEventListener('wheel', handleWheel, { passive: false });
    stage.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      stage.removeEventListener('wheel', handleWheel);
      stage.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('keydown', onKey);
    };
  }, [handleWheel, handleTouchMove, handleKeyDown]);

  const contextValue = useMemo(
    () => ({ currentIndex, activeTransition, goTo, inDetour, recapture }),
    [currentIndex, activeTransition, goTo, inDetour, recapture]
  );

  // Lets the browser scroll a 'scroll'-kind current section natively (touch
  // included); blocked everywhere else, where ScrollSections owns the
  // gesture itself.
  const touchAction = kindOf(currentIndex) === 'scroll' ? 'pan-y' : 'none';

  return (
    <ScrollSectionsContext.Provider value={contextValue}>
      <div
        ref={stageRef}
        className="scroll-sections"
        style={{ '--scroll-sections-plain-duration': `${plainDuration}s`, touchAction }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        tabIndex={-1}
      >
        {sections.map((section, i) => {
          const isCurrent = i === currentIndex;
          // During a plain (non-morph) transition, both the outgoing and
          // incoming section are kept on-screen at once — stacked, crossfading
          // via the CSS animations below — instead of the instant off-screen
          // swap a normal index change does.
          const isPlainFrom = plainTransition?.from === i;
          const isPlainTo = plainTransition?.to === i;
          const isVisible = isCurrent || isPlainFrom || isPlainTo;
          return (
            // Non-current sections are moved off-screen (not visibility/opacity/
            // display: hidden) so modern-screenshot can still capture them
            // correctly — it clones computed styles onto whatever it rasterizes,
            // so visibility:hidden (or opacity:0/display:none) on the captured
            // element makes the snapshot itself blank, which the shader then
            // renders as solid black. `transform` is on this outer wrapper only;
            // the ref'd capture div underneath carries no hiding style at all.
            <div
              key={section.id}
              className="scroll-sections-host"
              data-section={section.id}
              data-offscreen={isVisible ? undefined : true}
              data-plain-exit={isPlainFrom ? true : undefined}
              data-plain-enter={isPlainTo ? true : undefined}
              style={{ pointerEvents: isCurrent ? 'auto' : 'none' }}
              aria-hidden={isCurrent ? undefined : true}
              inert={!isCurrent}
            >
              <div
                ref={el => {
                  sectionHostRefs.current[i] = el;
                }}
                className={
                  (section.kind ?? 'morph') === 'scroll'
                    ? 'scroll-sections-capture scroll-sections-capture--scroll'
                    : 'scroll-sections-capture'
                }
              >
                <SectionIndexContext.Provider value={i}>
                  <SectionIdContext.Provider value={section.id}>
                    <section.Component />
                  </SectionIdContext.Provider>
                </SectionIndexContext.Provider>
              </div>
            </div>
          );
        })}
        <div ref={canvasHostRef} className="scroll-sections-canvas-host" />
      </div>
    </ScrollSectionsContext.Provider>
  );
}
