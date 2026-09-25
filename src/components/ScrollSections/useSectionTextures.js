import { useCallback, useRef } from 'react';
import { cappedDpr } from '../../lib/dpr';

// modern-screenshot and ogl's texture helpers load on demand, outside the
// first JS chunk (PLAN.md 6, performance): nothing here runs before the
// page has painted. Both are in hand by the time a texture is requested —
// the melt engine that asks for one is created only after load() resolves.
let lib = null;
let libPromise = null;
export function loadCaptureLib() {
  libPromise ??= Promise.all([import('modern-screenshot'), import('../../lib/morph/textures')]).then(([shot, textures]) => {
    lib = { domToCanvas: shot.domToCanvas, ...textures };
    return lib;
  });
  return libPromise;
}

// Fallback background for a capture that comes back genuinely transparent
// (no opaque background anywhere in the captured subtree) — every current
// section paints its own opaque background, so this is only a safety net.
const SECTION_BG = '#07080d';

// A WebGL canvas doesn't get its real pixel dimensions until its
// ResizeObserver-driven resize logic has run at least once after mount —
// until then it sits at the browser's 300x150 default. Wait for it to leave
// that default before the section is snapshotted, so the first capture isn't
// taken of a blank canvas. (Comparing its pixel width to its CSS width
// instead would never pass on a HiDPI screen, where the backing store is
// dpr times wider.) A canvas can also opt into a second gate via
// `data-async-ready`, and a SceneCanvas wrapper via `data-scene-ready` (set
// before its <canvas> even exists) — when present, wait for 'true'.
function waitForCanvasesReady(el, { maxWaitMs = 2500, intervalMs = 40 } = {}) {
  return new Promise(resolve => {
    const start = performance.now();
    const check = () => {
      const canvases = el.querySelectorAll('canvas');
      const scenesReady = el.querySelector('[data-scene-ready="false"]') === null;
      const ready =
        scenesReady &&
        Array.from(canvases).every(c => {
          const sized = c.width > 2 && c.height > 2 && !(c.width === 300 && c.height === 150);
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
// capture: the section's own root background is forced transparent (and its
// <canvas> left out) in the captured clone, so in principle the result
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
  // The overlay is captured on a transparent background, so normally the
  // corner already has no alpha and there's nothing to key — skip the
  // full-canvas pixel pass (millions of pixels, on the main thread).
  if (ctx.getImageData(0, 0, 1, 1).data[3] === 0) return canvas;
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
// captures the section's static DOM content *once* (with the canvas left out
// of the captured clone, so only headings/cards are captured, not the
// animation), and refresh() then just composites the live canvas underneath
// that cached overlay with a plain 2D drawImage — a cheap canvas-to-canvas
// blit, not a DOM rasterization.
export function useSectionTextures(hostRefs) {
  const cacheRef = useRef(new Map()); // index -> HTMLCanvasElement (latest capture; refresh() mutates this in place)
  const textureCacheRef = useRef(new Map()); // index -> ogl Texture (reused in place)
  const pendingRef = useRef(new Map());
  const overlayCacheRef = useRef(new Map()); // index -> content-only canvas (background chroma-keyed to transparent)
  const overlayPendingRef = useRef(new Map());
  // index -> bumped by invalidate(): a capture still in flight from before
  // it must not land in the cache afterwards.
  const generationRef = useRef(new Map());
  const generationOf = index => generationRef.current.get(index) ?? 0;

  // One-time capture of a section's static DOM content (headings, buttons,
  // cards) without its <canvas> background: the canvas is filtered out of
  // the captured clone and the clone's section root is made transparent, so
  // the live page is never touched (hiding the real canvas instead would
  // flash the visible section's 3D scene off while this runs). The chroma
  // key above is a safety net for anything that still comes back filled
  // with a flat color instead of true alpha. Cached per section; refresh()
  // only ever blits it. No-ops (resolves null, uncached, so it's retried
  // later) for a section with no <canvas> — static content has nothing to
  // fall out of sync with in the first place.
  const prepareOverlay = useCallback(
    index => {
      if (overlayCacheRef.current.has(index)) return Promise.resolve(overlayCacheRef.current.get(index));
      if (overlayPendingRef.current.has(index)) return overlayPendingRef.current.get(index);

      const el = hostRefs.current[index];
      if (!el || !el.querySelector('canvas')) return Promise.resolve(null);

      const scale = cappedDpr();
      const generation = generationOf(index);
      const promise = loadCaptureLib()
        .then(({ domToCanvas }) =>
          domToCanvas(el, {
            scale,
            // No background fill: the overlay needs true alpha around the text.
            // Text only: no scene canvas, and no poster still standing in for it.
            filter: node => node.nodeName !== 'CANVAS' && !node.classList?.contains('scene-poster'),
            onCloneNode: clone => {
              clone.firstElementChild?.style.setProperty('background-color', 'transparent', 'important');
            }
          })
        )
        .then(canvas => {
          chromaKeyToTransparent(canvas);
          if (generation === generationOf(index)) overlayCacheRef.current.set(index, canvas);
          return canvas;
        })
        .catch(() => null)
        .finally(() => {
          if (overlayPendingRef.current.get(index) === promise) overlayPendingRef.current.delete(index);
        });

      overlayPendingRef.current.set(index, promise);
      return promise;
    },
    [hostRefs]
  );

  const capture = useCallback(
    index => {
      if (cacheRef.current.has(index)) return Promise.resolve(cacheRef.current.get(index));
      if (pendingRef.current.has(index)) return pendingRef.current.get(index);

      const el = hostRefs.current[index];
      if (!el) return Promise.resolve(null);

      const scale = cappedDpr();
      const generation = generationOf(index);
      const promise = waitForCanvasesReady(el)
        .then(loadCaptureLib)
        .then(async ({ domToCanvas }) => {
          // A section with a scene is exactly what refresh() builds every
          // frame: its live canvas with the text-only overlay on top — so
          // compose that instead of rasterizing the whole section again
          // (one domToCanvas per section instead of two, and each one
          // re-embeds the web fonts).
          const live = el.querySelector('canvas');
          const overlay = live ? await prepareOverlay(index) : null;
          if (live && overlay) {
            const rect = el.getBoundingClientRect();
            const base = document.createElement('canvas');
            base.width = Math.floor(rect.width * scale);
            base.height = Math.floor(rect.height * scale);
            const ctx = base.getContext('2d');
            ctx.drawImage(live, 0, 0, base.width, base.height);
            ctx.drawImage(overlay, 0, 0, base.width, base.height);
            return base;
          }
          return domToCanvas(el, {
            scale,
            // Fallback only — every section paints its own opaque
            // background, so a capture can never come back transparent
            // (which the morph shader would render as solid black).
            backgroundColor: SECTION_BG
          });
        })
        .then(canvas => {
          if (generation === generationOf(index)) cacheRef.current.set(index, canvas);
          if (pendingRef.current.get(index) === promise) pendingRef.current.delete(index);
          return canvas;
        })
        .catch(() => {
          if (pendingRef.current.get(index) === promise) pendingRef.current.delete(index);
          return null;
        });

      pendingRef.current.set(index, promise);
      return promise;
    },
    [hostRefs, prepareOverlay]
  );

  const isReady = useCallback(index => cacheRef.current.has(index), []);

  // Builds (and caches) the ogl Texture for a section. The Texture instance
  // itself is created once per index and reused forever — refresh() below
  // mutates its backing canvas's pixels in place (and flags needsUpdate)
  // rather than swapping the uniform value, so MorphEngine doesn't need to
  // know anything about "live" sections at all.
  const getTexture = useCallback((index, gl) => {
    const canvas = cacheRef.current.get(index);
    if (!canvas || !gl || !lib) return null;
    const { makeTextureFromSource, getSourceSize } = lib;

    let oglTexture = textureCacheRef.current.get(index);
    if (!oglTexture) {
      oglTexture = makeTextureFromSource(gl, canvas);
      textureCacheRef.current.set(index, oglTexture);
    }
    return { oglTexture, size: getSourceSize(canvas) };
  }, []);


  // Keeps a section's texture close to live while it's actively part of a
  // transition: draws the section's live <canvas> pixels straight onto its
  // cached capture, then layers prepareOverlay()'s cached content snapshot
  // back on top so headings/cards aren't covered by the fresh background.
  // ScrollSections calls it every frame while a melt is in flight.
  const refresh = useCallback(
    index => {
      const el = hostRefs.current[index];
      const oglTexture = textureCacheRef.current.get(index);
      const base = cacheRef.current.get(index);
      if (!el || !oglTexture || !base) return false;

      const liveCanvas = el.querySelector('canvas');
      if (!liveCanvas || liveCanvas.width < 2 || liveCanvas.height < 2) return false;
      // Until the text-only overlay exists, drawing the live canvas would
      // wipe the section's text out of its texture — keep the full capture.
      const overlay = overlayCacheRef.current.get(index);
      if (!overlay) return false;

      const ctx = base.getContext('2d');
      ctx.clearRect(0, 0, base.width, base.height);
      ctx.drawImage(liveCanvas, 0, 0, base.width, base.height);
      ctx.drawImage(overlay, 0, 0, base.width, base.height);

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

  // One section's capture, texture and text overlay, thrown away so the next
  // capture() / prepareOverlay() takes them afresh — for a section whose
  // text changed while it sat cached (PLAN-2.md 3.4). Never call it mid-melt:
  // the engine may be sampling that texture.
  const invalidate = useCallback((index, gl) => {
    generationRef.current.set(index, generationOf(index) + 1);
    const oglTexture = textureCacheRef.current.get(index);
    if (gl && oglTexture?.texture) gl.deleteTexture(oglTexture.texture);
    textureCacheRef.current.delete(index);
    cacheRef.current.delete(index);
    pendingRef.current.delete(index);
    overlayCacheRef.current.delete(index);
    overlayPendingRef.current.delete(index);
  }, []);

  return { capture, isReady, getTexture, prepareOverlay, refresh, invalidate, invalidateAll };
}
