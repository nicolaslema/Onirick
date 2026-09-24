import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { MorphEngine } from '../../lib/morph';
import { useSectionTextures } from './useSectionTextures';
import { normalizeDelta, scrubStrategy } from './useWheelProgress';
import { ScrollSectionsContext, SectionIndexContext } from './ScrollSectionsContext';

import './ScrollSections.css';

// Normalized scroll pixels needed for a full 0->1 transition between two
// sections. Starting point, needs on-device tuning.
const PX_PER_TRANSITION = 900;
const RESIZE_DEBOUNCE_MS = 200;
// How often an in-progress transition's two sections are re-composited (see
// useSectionTextures' refresh()) so an animated section's background doesn't
// visibly freeze for the whole transition and then "pop" once it completes.
// refresh() is a cheap canvas-to-canvas drawImage (no DOM rasterization), so
// this can run often without the frame-rate cost a domToCanvas-per-tick
// approach had; still not literal per-frame, since there's no visible
// benefit to it once it's already well under a frame's worth of latency.
const LIVE_REFRESH_INTERVAL_MS = 80;
// A touch drag past this many vertical pixels commits to one section change,
// same idea as one wheel tick in 'snap' mode.
const TOUCH_SWIPE_PX = 40;
// Must match .scroll-sections-canvas's `transition: opacity ...` duration in
// ScrollSections.css — see setCanvasVisible below.
const CANVAS_FADE_MS = 150;

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
//   overlayColor) for the transition whose destination is this section —
//   i.e. transition i (between sections i-1 and i) always uses section i's
//   `melt`, in both directions. Falls back to this component's own props.
// - `plainDuration`: same idea for a crossfade whose destination is this
//   section (used whenever either side of the transition is 'scroll', or
//   for a goTo() jump landing here).
//
// Sections rendered inside <ScrollSections> can call useScrollSections()
// (ScrollSectionsContext.js) for { currentIndex, activeTransition, goTo }.
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
  onStateChange
}) {
  const stageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const sectionHostRefs = useRef([]);
  const engineRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const plainTimeoutRef = useRef(null);
  const touchRef = useRef(null); // { y, consumed } | null

  const [currentIndex, setCurrentIndex] = useState(0);
  const [plainTransition, setPlainTransition] = useState(null); // { from, to } | null
  const [activeTransition, setActiveTransition] = useState(null); // { from, to } | null — morph or plain
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
  basePropsRef.current = { transition, duration, plainDuration, ease, intensity, scale, aberration, drift, overlayColor };
  const optsRef = useRef({ ...basePropsRef.current });

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
      canvas.style.visibility = 'visible';
      canvas.style.opacity = '1';
      return;
    }
    canvas.style.opacity = '0';
    canvasHideTimeoutRef.current = setTimeout(() => {
      canvas.style.visibility = 'hidden';
    }, CANVAS_FADE_MS);
  }, []);

  const stopLiveRefresh = useCallback(() => {
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const startLiveRefresh = useCallback(
    (fromIndex, toIndex) => {
      stopLiveRefresh();
      // One-time content-only capture per section per transition (cheap
      // relative to the old per-tick domToCanvas calls, and only needed
      // once since none of this content animates on its own) — refresh()
      // layers it back on top of the live canvas on every tick below.
      sectionTextures.prepareOverlay(fromIndex);
      sectionTextures.prepareOverlay(toIndex);
      refreshTimerRef.current = setInterval(() => {
        sectionTextures.refresh(fromIndex);
        sectionTextures.refresh(toIndex);
      }, LIVE_REFRESH_INTERVAL_MS);
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
  }, [currentIndex, setCanvasVisible]);

  // Pre-captures the current section and its morph-kind neighbours (the only
  // sections the next gesture can melt between), plus their text-only
  // overlays, so a transition can start without waiting on domToCanvas.
  // Runs after commit, so any SceneCanvas a neighbour just mounted is already
  // in the DOM and capture() waits for it to render (waitForCanvasesReady).
  // A 'scroll' section is never a melt texture, so it's skipped.
  useEffect(() => {
    let cancelled = false;
    const fontsReady = document.fonts?.ready ?? Promise.resolve();
    fontsReady.then(() => {
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
  }, [currentIndex, sections.length, sectionTextures, kindOf]);

  // Mirrors { currentIndex, activeTransition } out to a sibling that can't
  // reach ScrollSectionsContext (e.g. a Hud rendered next to
  // <ScrollSections> rather than inside it — see App.jsx).
  useEffect(() => {
    onStateChange?.({ currentIndex, activeTransition });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, activeTransition]);

  // Mount the shared morph engine into the fixed canvas layer, and prime it
  // with the first section's texture once layout/fonts have settled.
  useEffect(() => {
    if (!canvasHostRef.current) return undefined;
    let cancelled = false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const engine = new MorphEngine(canvasHostRef.current, {
      reducedMotion,
      getOptions: () => optsRef.current,
      dprCap: 2,
      canvasClassName: 'scroll-sections-canvas'
    });
    engineRef.current = engine;

    const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fontsReady.then(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        // Only worth priming the engine if section 0 itself is a morph
        // section — a 'scroll' first section never becomes a melt texture.
        if (kindOf(0) === 'morph') {
          sectionTextures.capture(0).then(canvas => {
            if (cancelled || !canvas) return;
            const descriptor = sectionTextures.getTexture(0, engine.gl);
            if (descriptor) engine.setCurrent(descriptor);
          });
        }
        if (sections.length > 1 && kindOf(1) === 'morph') sectionTextures.capture(1);
      });
    });

    return () => {
      cancelled = true;
      stopLiveRefresh();
      clearTimeout(plainTimeoutRef.current);
      clearTimeout(canvasHideTimeoutRef.current);
      sectionTextures.invalidateAll(engine.gl);
      engine.destroy();
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
        const engine = engineRef.current;
        if (!engine) return;
        if (dirRef.current !== 0 || engine.animating) {
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
        sectionTextures.invalidateAll(engine.gl);
        if (kindOf(currentIndexRef.current) === 'morph') {
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
      if (targetIndex < 0 || targetIndex >= sections.length) return;
      if (engineRef.current?.animating || dirRef.current !== 0) return;

      const destIndex = Math.max(currentIndexRef.current, targetIndex);

      // A transition only runs the WebGL melt when BOTH sides are 'morph' —
      // capturing/texturing a 'scroll' section as a melt target doesn't make
      // sense for something meant to read as plain scrolling content, so
      // either side being 'scroll' falls back to the plain CSS crossfade.
      if (kindOf(currentIndexRef.current) !== 'morph' || kindOf(targetIndex) !== 'morph') {
        runPlainTransition(currentIndexRef.current, targetIndex, dir, destIndex);
        return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      if (!sectionTextures.isReady(currentIndexRef.current) || !sectionTextures.isReady(targetIndex)) {
        sectionTextures.capture(targetIndex);
        return;
      }

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
      setCanvasVisible(true);
      startLiveRefresh(currentIndexRef.current, targetIndex);
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

      // A 'scroll'-kind current section owns the wheel until its own
      // content has reached the edge being pushed against — let the browser
      // scroll it natively (no preventDefault) instead of advancing to the
      // next/previous section.
      if (!atScrollEdge(currentIndexRef.current, wheelDir)) return;

      e.preventDefault();
      goToIndex(currentIndexRef.current + wheelDir, wheelDir);
    },
    [goToIndex, atScrollEdge]
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
      touchRef.current = { y: e.touches[0].clientY, consumed: false };
    },
    [mode]
  );

  const handleTouchMove = useCallback(
    e => {
      const start = touchRef.current;
      if (!start || start.consumed) return;

      const deltaY = start.y - e.touches[0].clientY; // >0: swiping up (advance)
      const dir = deltaY > 0 ? 1 : deltaY < 0 ? -1 : 0;

      if (dir !== 0 && !atScrollEdge(currentIndexRef.current, dir)) return; // let native scroll happen
      if (Math.abs(deltaY) < TOUCH_SWIPE_PX) return;

      e.preventDefault();
      start.consumed = true;
      goToIndex(currentIndexRef.current + dir, dir);
    },
    [goToIndex, atScrollEdge]
  );

  const handleTouchEnd = useCallback(() => {
    touchRef.current = null;
  }, []);

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(currentIndexRef.current + 1, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(currentIndexRef.current - 1, -1);
      } else if (e.key === 'Home') {
        e.preventDefault();
        goTo(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goTo(sections.length - 1);
      }
    },
    [goToIndex, goTo, sections.length]
  );

  const contextValue = useMemo(() => ({ currentIndex, activeTransition, goTo }), [currentIndex, activeTransition, goTo]);

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
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onKeyDown={handleKeyDown}
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
                  <section.Component />
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
