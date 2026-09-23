import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import { MorphEngine } from '../../lib/morph';
import { useSectionTextures } from './useSectionTextures';
import { normalizeDelta, scrubStrategy } from './useWheelProgress';

import './ScrollSections.css';

// Normalized scroll pixels needed for a full 0->1 transition between two
// sections. Starting point, needs on-device tuning.
const PX_PER_TRANSITION = 900;
const RESIZE_DEBOUNCE_MS = 200;

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
export default function ScrollSections({
  sections,
  mode = 'snap',
  transition = 'melt',
  duration = 1.5,
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

  const [currentIndex, setCurrentIndex] = useState(0);
  const currentIndexRef = useRef(0);
  const progressRef = useRef(0);
  const dirRef = useRef(0);

  const optsRef = useRef();
  optsRef.current = { transition, duration, ease, intensity, scale, aberration, drift, overlayColor };

  // Resolves each section into a texture the morph engine can sample — a
  // section's own live <canvas> if it renders one (kept continuously
  // up to date, see MorphEngine's liveSource handling), otherwise a one-time
  // DOM snapshot for plain content. See useSectionTextures.js.
  const sectionTextures = useSectionTextures(sectionHostRefs);

  const setCanvasVisible = useCallback(visible => {
    const canvas = engineRef.current?.canvas;
    if (!canvas) return;
    canvas.style.opacity = visible ? '1' : '0';
    canvas.style.visibility = visible ? 'visible' : 'hidden';
  }, []);

  const settle = useCallback(
    newIndex => {
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
      sectionTextures.ensureReady(newIndex - 1);
      sectionTextures.ensureReady(newIndex + 1);
    },
    [sectionTextures]
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
        sectionTextures.ensureReady(0).then(ready => {
          if (cancelled || !ready) return;
          const descriptor = sectionTextures.getTexture(0, engine.gl);
          if (descriptor) engine.setCurrent(descriptor);
        });
        if (sections.length > 1) sectionTextures.ensureReady(1);
      });
    });

    return () => {
      cancelled = true;
      sectionTextures.invalidateAll(engine.gl);
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resizing mid-transition invalidates a snapshot-backed section's pixel
  // dimensions (live-canvas sections resize themselves independently, so
  // they don't strictly need this, but re-priming is cheap and keeps things
  // uniform), so hard-reset to the settled section rather than trying to
  // resize textures mid-morph, then re-resolve once things stop moving.
  useEffect(() => {
    let timeout;
    const onResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        const engine = engineRef.current;
        if (!engine) return;
        if (dirRef.current !== 0 || engine.animating) {
          engine.reset();
          dirRef.current = 0;
          progressRef.current = 0;
          setCanvasVisible(false);
        }
        sectionTextures.invalidateAll(engine.gl);
        sectionTextures.ensureReady(currentIndexRef.current).then(ready => {
          if (!ready) return;
          const descriptor = sectionTextures.getTexture(currentIndexRef.current, engine.gl);
          if (descriptor) engine.setCurrent(descriptor);
        });
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', onResize);
    };
  }, [sectionTextures, setCanvasVisible]);

  const goToIndex = useCallback(
    (targetIndex, dir) => {
      const engine = engineRef.current;
      if (!engine || engine.animating || dirRef.current !== 0) return;
      if (targetIndex < 0 || targetIndex >= sections.length) return;

      if (!sectionTextures.isReady(currentIndexRef.current) || !sectionTextures.isReady(targetIndex)) {
        sectionTextures.ensureReady(targetIndex);
        return;
      }

      const currentDesc = sectionTextures.getTexture(currentIndexRef.current, engine.gl);
      const nextDesc = sectionTextures.getTexture(targetIndex, engine.gl);
      if (!currentDesc || !nextDesc) return;

      dirRef.current = dir;
      engine.prepareTransition(currentDesc, nextDesc, dir);
      setCanvasVisible(true);
      engine.animateProgress(1, {
        duration: optsRef.current.duration,
        ease: optsRef.current.ease,
        onComplete: () => {
          engine.commit();
          settle(targetIndex);
        }
      });
    },
    [sections.length, sectionTextures, setCanvasVisible, settle]
  );

  // 'snap': one wheel tick commits a whole transition via goToIndex's tween.
  // While that tween is in flight, engine.animating (and dirRef, set inside
  // goToIndex) block further calls, so the many wheel events a single
  // scroll gesture fires don't trigger multiple section changes.
  const handleSnapWheel = useCallback(
    e => {
      e.preventDefault();
      const engine = engineRef.current;
      if (!engine || engine.animating || dirRef.current !== 0) return;

      const deltaPx = normalizeDelta(e);
      if (deltaPx === 0) return;
      const wheelDir = Math.sign(deltaPx);

      goToIndex(currentIndexRef.current + wheelDir, wheelDir);
    },
    [goToIndex]
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
          sectionTextures.ensureReady(target);
          return;
        }

        const currentDesc = sectionTextures.getTexture(from, engine.gl);
        const nextDesc = sectionTextures.getTexture(target, engine.gl);
        if (!currentDesc || !nextDesc) return;

        dirRef.current = wheelDir;
        engine.prepareTransition(currentDesc, nextDesc, wheelDir);
      }

      const signedDeltaPx = deltaPx * dirRef.current;
      progressRef.current = scrubStrategy(signedDeltaPx, progressRef.current, {
        pxPerFullTransition: PX_PER_TRANSITION
      });
      engine.setProgress(progressRef.current);
      setCanvasVisible(progressRef.current > 0);

      if (progressRef.current >= 1) {
        engine.commit();
        settle(currentIndexRef.current + dirRef.current);
      } else if (progressRef.current <= 0) {
        dirRef.current = 0;
        setCanvasVisible(false);
      }
    },
    [sections.length, sectionTextures, setCanvasVisible, settle]
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
      onWheel={handleWheel}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {sections.map((section, i) => {
        const isCurrent = i === currentIndex;
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
            data-offscreen={isCurrent ? undefined : true}
            style={{ pointerEvents: isCurrent ? 'auto' : 'none' }}
            aria-hidden={isCurrent ? undefined : true}
            inert={!isCurrent}
          >
            <div
              ref={el => {
                sectionHostRefs.current[i] = el;
              }}
              className="scroll-sections-capture"
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
