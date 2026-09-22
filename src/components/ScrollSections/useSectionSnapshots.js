import { useCallback, useRef } from 'react';
import { domToCanvas } from 'modern-screenshot';

// A WebGL canvas (three.js/R3F backgrounds like Beams, LiquidEther, ...)
// doesn't get its real pixel dimensions until its ResizeObserver-driven
// resize logic has actually run at least once after mount — until then it
// sits at the browser's 300x150 default and renders nothing meaningful. If
// domToCanvas() captures a section before that happens, the snapshot bakes
// in that blank frame permanently (captures are cached forever), so every
// future transition touching that section shows black regardless of how
// long the page has been open. Wait for every <canvas> under the section to
// reach a real, container-matching size before snapshotting it.
function waitForCanvasesReady(el, { maxWaitMs = 1500, intervalMs = 40 } = {}) {
  return new Promise(resolve => {
    const start = performance.now();
    const check = () => {
      const canvases = el.querySelectorAll('canvas');
      const ready =
        canvases.length === 0 ||
        Array.from(canvases).every(c => {
          const rect = c.getBoundingClientRect();
          return c.width > 2 && c.height > 2 && Math.abs(c.width - rect.width) < rect.width * 0.5 + 4;
        });
      if (ready || performance.now() - start > maxWaitMs) {
        resolve();
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// Captures + caches a <canvas> snapshot of each section's DOM host, keyed by
// index, so the morph engine can treat "the section" as a texture the same
// way it already treats a slide image. Sections have no animated WebGL of
// their own, so a snapshot is equivalent to the live DOM at any point in
// time until layout actually changes (handled by re-capturing on resize).
export function useSectionSnapshots(hostRefs) {
  const cacheRef = useRef(new Map());
  const pendingRef = useRef(new Map());

  const capture = useCallback(
    index => {
      if (cacheRef.current.has(index)) return Promise.resolve(cacheRef.current.get(index));
      if (pendingRef.current.has(index)) return pendingRef.current.get(index);

      const el = hostRefs.current[index];
      if (!el) return Promise.resolve(null);

      const scale = Math.min(window.devicePixelRatio || 1, 2);
      // backgroundColor is a fallback only — every section already paints its
      // own opaque background — so a capture can never come back transparent
      // (which the morph shader would render as solid black).
      const promise = waitForCanvasesReady(el)
        .then(() => domToCanvas(el, { scale, backgroundColor: '#0b0b10' }))
        .then(canvas => {
          cacheRef.current.set(index, canvas);
          pendingRef.current.delete(index);
          return canvas;
        })
        .catch(() => {
          pendingRef.current.delete(index);
          return null;
        });

      pendingRef.current.set(index, promise);
      return promise;
    },
    [hostRefs]
  );

  const get = useCallback(index => cacheRef.current.get(index) ?? null, []);

  const invalidateAll = useCallback(() => {
    cacheRef.current.clear();
    pendingRef.current.clear();
  }, []);

  return { capture, get, invalidateAll };
}
