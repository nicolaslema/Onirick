import { useCallback, useRef } from 'react';
import { domToCanvas } from 'modern-screenshot';
import { makeTextureFromSource, getSourceSize } from '../../lib/morph';

// Fallback background for a capture that comes back genuinely transparent
// (no opaque background anywhere in the captured subtree) — every current
// section paints its own opaque background, so this is only a safety net.
const SECTION_BG = '#07080d';

// A WebGL canvas (three.js/ogl backgrounds like Beams, Strands, LiquidChrome,
// ...) doesn't get its real pixel dimensions until its ResizeObserver-driven
// resize logic has actually run at least once after mount — until then it
// sits at the browser's 300x150 default. Wait for it to reach a real,
// container-matching size before the section is snapshotted, so the very
// first capture isn't taken of a blank canvas. A canvas can also opt into a
// second gate via `data-async-ready` (e.g. RippleDistortion, whose source
// image loads asynchronously and paints solid black until it does) — when
// present, also wait for it to read 'true' before considering the canvas
// ready.
function waitForCanvasesReady(el, { maxWaitMs = 2500, intervalMs = 40 } = {}) {
  return new Promise(resolve => {
    const start = performance.now();
    const check = () => {
      const canvases = el.querySelectorAll('canvas');
      const ready =
        canvases.length === 0 ||
        Array.from(canvases).every(c => {
          const rect = c.getBoundingClientRect();
          const sized = c.width > 2 && c.height > 2 && Math.abs(c.width - rect.width) < rect.width * 0.5 + 4;
          const asyncReady = c.dataset.asyncReady === undefined || c.dataset.asyncReady === 'true';
          return sized && asyncReady;
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

// Turns every pixel close to the canvas's own top-left corner color fully
// transparent, in place. Used to recover real alpha for prepareOverlay()'s
// capture: the section's own root background is forced transparent (with
// its live canvas hidden) before capturing, so in principle the result
// should already be transparent there — but any opaque background painted
// by markup *inside* the section (e.g. a component's own container
// background, unrelated to the section root) still shows through instead.
// Sampling the actual resulting corner color, rather than assuming a fixed
// one, keys out whatever that turns out to be without needing to know every
// such background up front. The corner is assumed to be background, never
// content — true for centered text/cards, which is all this currently
// composites over.
function chromaKeyToTransparent(canvas, tolerance = 12) {
  const { width, height } = canvas;
  if (!width || !height) return canvas;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;
  const [kr, kg, kb] = [d[0], d[1], d[2]];
  for (let i = 0; i < d.length; i += 4) {
    if (Math.abs(d[i] - kr) <= tolerance && Math.abs(d[i + 1] - kg) <= tolerance && Math.abs(d[i + 2] - kb) <= tolerance) {
      d[i + 3] = 0;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas;
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
// live version. refresh() below keeps a section close to live while it's
// part of an active transition — but NOT by re-running domToCanvas on an
// interval, as an earlier version of this file did: any <canvas> inside the
// captured subtree gets rasterized via canvas.toDataURL(), which forces a
// synchronous GPU readback + PNG encode at the canvas's own native pixel
// size, regardless of domToCanvas's `scale` option (confirmed against
// modern-screenshot's source) — ~130-190ms per call on a modest viewport,
// enough to visibly stutter every refresh tick. Instead, prepareOverlay()
// captures the section's static DOM content *once* per transition (with the
// live canvas hidden, so only headings/cards are captured, not the
// animation), and refresh() then just composites the live canvas underneath
// that cached overlay with a plain 2D drawImage — a cheap canvas-to-canvas
// blit, not a DOM rasterization.
export function useSectionTextures(hostRefs) {
  const cacheRef = useRef(new Map()); // index -> HTMLCanvasElement (latest capture; refresh() mutates this in place)
  const textureCacheRef = useRef(new Map()); // index -> ogl Texture (reused in place)
  const pendingRef = useRef(new Map());
  const overlayCacheRef = useRef(new Map()); // index -> content-only canvas (background chroma-keyed to transparent)
  const overlayPendingRef = useRef(new Map());

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
            backgroundColor: SECTION_BG
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
  // mutates its backing canvas's pixels in place (and flags needsUpdate)
  // rather than swapping the uniform value, so MorphEngine doesn't need to
  // know anything about "live" sections at all.
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

  // One-time-per-transition capture of a section's static DOM content
  // (headings, buttons, cards) with its own live <canvas> background hidden
  // and its section root's opaque background forced transparent — the
  // chroma key above is a safety net for anything that still comes back
  // filled with that flat color instead of true alpha. This is the only
  // domToCanvas call refresh() needs for the section for the rest of the
  // transition; everything after it is a cheap canvas-to-canvas blit.
  // No-ops (resolves null) for a section with no <canvas> of its own —
  // static content has nothing to fall out of sync with in the first place.
  const prepareOverlay = useCallback(
    index => {
      if (overlayCacheRef.current.has(index)) return Promise.resolve(overlayCacheRef.current.get(index));
      if (overlayPendingRef.current.has(index)) return overlayPendingRef.current.get(index);

      const el = hostRefs.current[index];
      if (!el) return Promise.resolve(null);
      const root = el.firstElementChild;
      const canvasEl = el.querySelector('canvas');
      if (!canvasEl) return Promise.resolve(null);

      const prevRootBg = root ? root.style.backgroundColor : null;
      const prevCanvasOpacity = canvasEl.style.opacity;
      // Imperative DOM style toggling on a live element reached via a ref —
      // not a React state/props mutation — restored in .finally() below
      // regardless of outcome, so this is safe despite the linter flagging
      // anything reached through hostRefs as if it were owned state.
      //
      // opacity, not visibility: this canvas can still be actively read by
      // refresh() below (via drawImage) on the same 80ms interval while this
      // capture is in flight, and opacity keeps it actively composited (so
      // refresh() keeps reading real pixels) while still making it come
      // back transparent in domToCanvas's clone, same as visibility would.
      // eslint-disable-next-line react/immutability
      if (root) root.style.backgroundColor = 'transparent';
      canvasEl.style.opacity = '0';

      const scale = Math.min(window.devicePixelRatio || 1, 2);
      const promise = domToCanvas(el, { scale, backgroundColor: SECTION_BG })
        .then(canvas => {
          chromaKeyToTransparent(canvas);
          overlayCacheRef.current.set(index, canvas);
          return canvas;
        })
        .catch(() => null)
        .finally(() => {
          if (root) root.style.backgroundColor = prevRootBg;
          canvasEl.style.opacity = prevCanvasOpacity;
          overlayPendingRef.current.delete(index);
        });

      overlayPendingRef.current.set(index, promise);
      return promise;
    },
    [hostRefs]
  );

  // Keeps a section's texture close to live while it's actively part of a
  // transition: draws the section's live <canvas> pixels straight onto its
  // cached capture, then layers prepareOverlay()'s cached content snapshot
  // back on top so headings/cards aren't covered by the fresh background.
  // Callers (ScrollSections) poll this on an interval, not every frame — a
  // compromise, not literal per-frame accuracy, but a much cheaper one now
  // than the old domToCanvas-per-tick approach.
  const refresh = useCallback(
    index => {
      const el = hostRefs.current[index];
      const oglTexture = textureCacheRef.current.get(index);
      const base = cacheRef.current.get(index);
      if (!el || !oglTexture || !base) return false;

      const liveCanvas = el.querySelector('canvas');
      if (!liveCanvas || liveCanvas.width < 2 || liveCanvas.height < 2) return false;

      const ctx = base.getContext('2d');
      ctx.clearRect(0, 0, base.width, base.height);
      ctx.drawImage(liveCanvas, 0, 0, base.width, base.height);
      const overlay = overlayCacheRef.current.get(index);
      if (overlay) ctx.drawImage(overlay, 0, 0, base.width, base.height);

      // Mutating the same canvas object in place, so ogl's own
      // reference-change check (this.image === this.store.image) won't
      // detect anything changed on its own — flag it explicitly instead.
      oglTexture.needsUpdate = true;
      return true;
    },
    [hostRefs]
  );

  const invalidateAll = useCallback(gl => {
    textureCacheRef.current.forEach(oglTexture => {
      if (gl && oglTexture?.texture) gl.deleteTexture(oglTexture.texture);
    });
    textureCacheRef.current.clear();
    cacheRef.current.clear();
    pendingRef.current.clear();
    overlayCacheRef.current.clear();
    overlayPendingRef.current.clear();
  }, []);

  return { capture, isReady, getTexture, prepareOverlay, refresh, invalidateAll };
}
