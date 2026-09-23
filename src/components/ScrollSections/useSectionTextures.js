import { useCallback, useRef } from 'react';
import { domToCanvas } from 'modern-screenshot';
import { makeTextureFromSource, getSourceSize } from '../../lib/morph';

// A WebGL canvas (three.js/ogl backgrounds like Beams, Strands, LiquidChrome,
// ...) doesn't get its real pixel dimensions until its ResizeObserver-driven
// resize logic has actually run at least once after mount — until then it
// sits at the browser's 300x150 default. Wait for it to reach a real,
// container-matching size before the section is snapshotted, so the very
// first capture isn't taken of a blank canvas.
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

// Captures a full DOM snapshot (via modern-screenshot) of each section —
// this is what the morph engine samples as a texture. A whole-section
// snapshot, rather than grabbing a section's own <canvas> directly, is
// deliberate: a section is a composite of a WebGL background *and* real DOM
// content on top of it (headings, buttons, cards, ...); sampling just the
// canvas silently drops all of that overlaid content from the transition.
//
// A snapshot is inherently a frozen instant, though, and an animated
// section (anything with its own <canvas> background) would visibly "freeze
// then pop" once a transition finished revealing its now-far-ahead-in-time
// live version — see refresh() below, which callers use to re-capture a
// section periodically while it's actively part of a transition, keeping it
// close enough to live that the freeze/pop is no longer perceptible without
// re-capturing every single frame (which would be far too expensive).
export function useSectionTextures(hostRefs) {
  const cacheRef = useRef(new Map()); // index -> HTMLCanvasElement (latest capture)
  const textureCacheRef = useRef(new Map()); // index -> ogl Texture (reused in place)
  const pendingRef = useRef(new Map());

  const capture = useCallback(
    index => {
      if (cacheRef.current.has(index)) return Promise.resolve(cacheRef.current.get(index));
      if (pendingRef.current.has(index)) return pendingRef.current.get(index);

      const el = hostRefs.current[index];
      if (!el) return Promise.resolve(null);

      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const promise = waitForCanvasesReady(el)
        .then(() =>
          domToCanvas(el, {
            scale,
            // Fallback only — every section paints its own opaque
            // background, so a capture can never come back transparent
            // (which the morph shader would render as solid black).
            backgroundColor: '#0b0b10'
          })
        )
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

  const isReady = useCallback(index => cacheRef.current.has(index), []);

  // Builds (and caches) the ogl Texture for a section. The Texture instance
  // itself is created once per index and reused forever — refresh() below
  // mutates its `.image` in place rather than swapping the uniform value, so
  // MorphEngine doesn't need to know anything about "live" sections at all.
  const getTexture = useCallback((index, gl) => {
    const canvas = cacheRef.current.get(index);
    if (!canvas || !gl) return null;

    let oglTexture = textureCacheRef.current.get(index);
    if (!oglTexture) {
      oglTexture = makeTextureFromSource(gl, canvas);
      textureCacheRef.current.set(index, oglTexture);
    }
    return { oglTexture, size: getSourceSize(canvas) };
  }, []);

  // Re-captures a section and updates its already-built Texture's `.image`
  // in place. Callers (ScrollSections) poll this on an interval while a
  // section is actively part of an in-progress transition, not every frame —
  // domToCanvas has real cost, and the goal is "close enough to live that a
  // freeze isn't perceptible", not literal per-frame accuracy.
  const refresh = useCallback(index => {
    const el = hostRefs.current[index];
    const oglTexture = textureCacheRef.current.get(index);
    if (!el || !oglTexture) return Promise.resolve(false);

    const scale = Math.min(window.devicePixelRatio || 1, 2);
    return domToCanvas(el, { scale, backgroundColor: '#0b0b10' })
      .then(canvas => {
        cacheRef.current.set(index, canvas);
        oglTexture.image = canvas; // reference change alone makes ogl re-upload on next render
        return true;
      })
      .catch(() => false);
  }, [hostRefs]);

  const invalidateAll = useCallback(gl => {
    textureCacheRef.current.forEach(oglTexture => {
      if (gl && oglTexture?.texture) gl.deleteTexture(oglTexture.texture);
    });
    textureCacheRef.current.clear();
    cacheRef.current.clear();
    pendingRef.current.clear();
  }, []);

  return { capture, isReady, getTexture, refresh, invalidateAll };
}
