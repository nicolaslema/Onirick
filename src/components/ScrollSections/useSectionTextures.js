import { useCallback, useRef } from 'react';
import { domToCanvas } from 'modern-screenshot';
import { makeTextureFromSource, getSourceSize } from '../../lib/morph';

// A WebGL canvas (three.js/ogl backgrounds like Beams, Strands, LiquidChrome,
// ...) doesn't get its real pixel dimensions until its ResizeObserver-driven
// resize logic has actually run at least once after mount — until then it
// sits at the browser's 300x150 default. Wait for it to reach a real,
// container-matching size before treating it as usable.
function waitForCanvasReady(canvasEl, { maxWaitMs = 1500, intervalMs = 40 } = {}) {
  return new Promise(resolve => {
    const start = performance.now();
    const check = () => {
      const rect = canvasEl.getBoundingClientRect();
      const ready = canvasEl.width > 2 && canvasEl.height > 2 && Math.abs(canvasEl.width - rect.width) < rect.width * 0.5 + 4;
      if (ready || performance.now() - start > maxWaitMs) {
        resolve();
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

// Resolves each section into a texture source for the morph engine:
// - If the section renders its own <canvas> (an animated WebGL background),
//   that live canvas element is tracked directly and re-sampled every frame
//   it's in use (see MorphEngine's liveSource handling) — so the shader
//   keeps animating in sync all the way through a transition instead of
//   freezing on a one-time snapshot and then "popping" to whatever frame the
//   live animation had actually reached by the time the transition ends.
// - Otherwise (plain DOM/text content, no canvas of its own), falls back to
//   a one-time modern-screenshot capture — static content has no "live"
//   state to fall out of sync with, so a snapshot is equivalent forever.
export function useSectionTextures(hostRefs) {
  // index -> { canvasEl } | { snapshot } | { canvasEl, oglTexture, size } | { snapshot, oglTexture, size }
  const sourceRef = useRef(new Map());
  const pendingRef = useRef(new Map());

  const ensureReady = useCallback(
    index => {
      if (sourceRef.current.has(index)) return Promise.resolve(true);
      if (pendingRef.current.has(index)) return pendingRef.current.get(index);

      const el = hostRefs.current[index];
      if (!el) return Promise.resolve(false);

      const canvasEl = el.querySelector('canvas');

      const promise = (
        canvasEl
          ? waitForCanvasReady(canvasEl).then(() => ({ canvasEl }))
          : domToCanvas(el, {
              scale: Math.min(window.devicePixelRatio || 1, 2),
              // Fallback only — every section paints its own opaque
              // background, so a capture can never come back transparent
              // (which the morph shader would render as solid black).
              backgroundColor: '#0b0b10'
            }).then(snapshot => ({ snapshot }))
      )
        .then(result => {
          sourceRef.current.set(index, result);
          pendingRef.current.delete(index);
          return true;
        })
        .catch(() => {
          pendingRef.current.delete(index);
          return false;
        });

      pendingRef.current.set(index, promise);
      return promise;
    },
    [hostRefs]
  );

  const isReady = useCallback(index => sourceRef.current.has(index), []);

  // Builds (and caches) the ogl Texture for a section. For a live canvas the
  // Texture wrapper itself is created once and reused forever — MorphEngine
  // re-uploads its pixels every frame via needsUpdate, so there's nothing to
  // rebuild later, but `size` is recomputed on every call (cheap) so an
  // aspect-ratio change (e.g. a window resize) is picked up next time this
  // section is used in a transition without needing an explicit invalidation.
  const getTexture = useCallback((index, gl) => {
    const source = sourceRef.current.get(index);
    if (!source || !gl) return null;

    if (source.canvasEl) {
      if (!source.oglTexture) source.oglTexture = makeTextureFromSource(gl, source.canvasEl);
      return { oglTexture: source.oglTexture, size: getSourceSize(source.canvasEl), liveSource: source.canvasEl };
    }

    if (!source.oglTexture) {
      source.oglTexture = makeTextureFromSource(gl, source.snapshot);
      source.size = getSourceSize(source.snapshot);
    }
    return { oglTexture: source.oglTexture, size: source.size };
  }, []);

  const invalidateAll = useCallback(gl => {
    sourceRef.current.forEach(source => {
      if (gl && source.oglTexture?.texture) gl.deleteTexture(source.oglTexture.texture);
    });
    sourceRef.current.clear();
    pendingRef.current.clear();
  }, []);

  return { ensureReady, isReady, getTexture, invalidateAll };
}
