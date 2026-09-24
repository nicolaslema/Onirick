import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { MorphEngine } from '../../lib/morph';
import { useSectionTextures } from './useSectionTextures';
import { normalizeDelta, scrubStrategy } from './useWheelProgress';

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

// Scroll-driven version of MorphSlider: instead of morphing between slide
// images on click/drag, this morphs between whole page sections on
// wheel/trackpad scroll. Each section is rendered as real, accessible DOM
// (only the current one is visible/interactive) and the WebGL canvas is a
// transient overlay shown only while a transition is in progress.
//
// `mode` controls how a wheel gesture drives the transition:
// - 'snap' (default): one wheel tick commits a full transition to the next
//   /previous section via a tween, like a slide deck. Simple, and immune to
//   the scrub mode's direction-sign bug below.
// - 'scrub': progress tracks the wheel in real time, no auto-complete.
//
// Each entry in `sections` can also declare a `kind`:
// - 'morph' (default): behaves as above — captured as a texture, melts into
//   its neighbor via the WebGL engine.
// - 'scroll': a plain section that can be taller than the viewport and
//   scrolls internally with native browser scroll (see
//   .scroll-sections-capture--scroll) instead of being captured/melted. A
//   transition into or out of a 'scroll' section never touches the WebGL
//   engine at all — it's a lightweight CSS crossfade instead (see
//   runPlainTransition below), and only fires once that section's own
//   internal scroll has reached the edge the wheel is pushing against.
//   'scroll' kind is currently only wired up for mode 'snap'.
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
  overlayColor = '#000000'
}) {
  const stageRef = useRef(null);
  const canvasHostRef = useRef(null);
  const sectionHostRefs = useRef([]);
  const engineRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const plainTimeoutRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [plainTransition, setPlainTransition] = useState(null); // { from, to } | null
  const currentIndexRef = useRef(0);
  const progressRef = useRef(0);
  const dirRef = useRef(0);

  const optsRef = useRef();
  optsRef.current = { transition, duration, plainDuration, ease, intensity, scale, aberration, drift, overlayColor };

  const kindOf = useCallback(index => sections[index]?.kind ?? 'morph', [sections]);

  // Resolves each section into a texture the morph engine can sample — a
  // full DOM capture (background shader + real content composited), kept
  // fresh via periodic re-capture while actively part of a transition. See
  // useSectionTextures.js.
  const sectionTextures = useSectionTextures(sectionHostRefs);

  const setCanvasVisible = useCallback(visible => {
    const canvas = engineRef.current?.canvas;
    if (!canvas) return;
    canvas.style.opacity = visible ? '1' : '0';
    canvas.style.visibility = visible ? 'visible' : 'hidden';
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
      progressRef.current = 0;
      dirRef.current = 0;
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
      // Only prefetch morph-kind neighbors — a 'scroll' section is never
      // used as a melt texture, so capturing it would just be wasted work.
      if (kindOf(newIndex - 1) === 'morph') sectionTextures.capture(newIndex - 1);
      if (kindOf(newIndex + 1) === 'morph') sectionTextures.capture(newIndex + 1);
    },
    [sectionTextures, stopLiveRefresh, kindOf]
  );

  // Lightweight alternative to the WebGL melt for any transition touching a
  // 'scroll'-kind section: both the outgoing and incoming section are kept
  // on-screen (stacked, see the render below) for `plainDuration` while a
  // pure CSS opacity crossfade (see ScrollSections.css) plays, then settle()
  // runs exactly as it would after a morph transition completes.
  const runPlainTransition = useCallback(
    (fromIndex, toIndex, dir) => {
      dirRef.current = dir;
      setPlainTransition({ from: fromIndex, to: toIndex });
      clearTimeout(plainTimeoutRef.current);
      plainTimeoutRef.current = setTimeout(() => {
        setPlainTransition(null);
        settle(toIndex, dir);
      }, optsRef.current.plainDuration * 1000);
    },
    [settle]
  );

  // Hides the transition canvas only once React has committed the DOM for
  // the newly-current section, so the canvas-hide and the section-swap
  // always land in the same paint.
  useLayoutEffect(() => {
    setCanvasVisible(false);
  }, [currentIndex, setCanvasVisible]);

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
          dirRef.current = 0;
          progressRef.current = 0;
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

      // A transition only runs the WebGL melt when BOTH sides are 'morph' —
      // capturing/texturing a 'scroll' section as a melt target doesn't make
      // sense for something meant to read as plain scrolling content, so
      // either side being 'scroll' falls back to the plain CSS crossfade.
      if (kindOf(currentIndexRef.current) !== 'morph' || kindOf(targetIndex) !== 'morph') {
        runPlainTransition(currentIndexRef.current, targetIndex, dir);
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

      dirRef.current = dir;
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
    [sections.length, sectionTextures, setCanvasVisible, settle, startLiveRefresh, kindOf, runPlainTransition]
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
      if (kindOf(currentIndexRef.current) === 'scroll') {
        const scroller = sectionHostRefs.current[currentIndexRef.current];
        if (scroller) {
          const atTop = scroller.scrollTop <= 0;
          const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
          if ((wheelDir < 0 && !atTop) || (wheelDir > 0 && !atBottom)) return;
        }
      }

      e.preventDefault();
      goToIndex(currentIndexRef.current + wheelDir, wheelDir);
    },
    [goToIndex, kindOf]
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

  const handleKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        goToIndex(currentIndexRef.current + 1, 1);
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        goToIndex(currentIndexRef.current - 1, -1);
      }
    },
    [goToIndex]
  );

  return (
    <div
      ref={stageRef}
      className="scroll-sections"
      style={{ '--scroll-sections-plain-duration': `${plainDuration}s` }}
      onWheel={handleWheel}
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
              <section.Component />
            </div>
          </div>
        );
      })}
      <div ref={canvasHostRef} className="scroll-sections-canvas-host" />
    </div>
  );
}
