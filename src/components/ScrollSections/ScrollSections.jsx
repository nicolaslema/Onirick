import { useCallback, useEffect, useRef, useState } from 'react';

import { MorphEngine } from '../../lib/morph';
import { useSectionSnapshots } from './useSectionSnapshots';
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
export default function ScrollSections({
  sections,
  transition = 'melt',
  duration = 1.1,
  ease = 'power2.inOut',
  intensity = 0.55,
  scale = 2.4,
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

  const snapshots = useSectionSnapshots(sectionHostRefs);

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
      setCanvasVisible(false);
      snapshots.capture(newIndex - 1);
      snapshots.capture(newIndex + 1);
    },
    [snapshots, setCanvasVisible]
  );

  // Mount the shared morph engine into the fixed canvas layer, and prime it
  // with a snapshot of the first section once layout/fonts have settled.
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
        snapshots.capture(0).then(canvas => {
          if (!cancelled && canvas) engine.setCurrent(canvas);
        });
        if (sections.length > 1) snapshots.capture(1);
      });
    });

    return () => {
      cancelled = true;
      engine.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resizing mid-transition invalidates the snapshots' pixel dimensions, so
  // hard-reset to the settled section rather than trying to resize textures
  // mid-morph, then re-capture once things stop moving.
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
        snapshots.invalidateAll();
        snapshots.capture(currentIndexRef.current).then(canvas => {
          if (canvas) engine.setCurrent(canvas);
        });
      }, RESIZE_DEBOUNCE_MS);
    };
    window.addEventListener('resize', onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener('resize', onResize);
    };
  }, [snapshots, setCanvasVisible]);

  const handleWheel = useCallback(
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

        const currentCanvas = snapshots.get(from);
        const nextCanvas = snapshots.get(target);
        if (!currentCanvas) return;
        if (!nextCanvas) {
          snapshots.capture(target);
          return;
        }

        dirRef.current = wheelDir;
        engine.prepareTransition(currentCanvas, nextCanvas, wheelDir);
      }

      progressRef.current = scrubStrategy(deltaPx, progressRef.current, { pxPerFullTransition: PX_PER_TRANSITION });
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
    [sections.length, snapshots, setCanvasVisible, settle]
  );

  const goToIndex = useCallback(
    (targetIndex, dir) => {
      const engine = engineRef.current;
      if (!engine || engine.animating || dirRef.current !== 0) return;
      if (targetIndex < 0 || targetIndex >= sections.length) return;

      const currentCanvas = snapshots.get(currentIndexRef.current);
      const nextCanvas = snapshots.get(targetIndex);
      if (!currentCanvas || !nextCanvas) {
        snapshots.capture(targetIndex);
        return;
      }

      dirRef.current = dir;
      engine.prepareTransition(currentCanvas, nextCanvas, dir);
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
    [sections.length, snapshots, setCanvasVisible, settle]
  );

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
          <div
            key={section.id}
            ref={el => {
              sectionHostRefs.current[i] = el;
            }}
            className="scroll-sections-host"
            style={{
              visibility: isCurrent ? 'visible' : 'hidden',
              pointerEvents: isCurrent ? 'auto' : 'none'
            }}
            aria-hidden={isCurrent ? undefined : true}
            inert={!isCurrent}
          >
            <section.Component />
          </div>
        );
      })}
      <div ref={canvasHostRef} className="scroll-sections-canvas-host" />
    </div>
  );
}
