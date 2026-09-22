import { useCallback, useRef } from 'react';
import { domToCanvas } from 'modern-screenshot';

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
      const promise = domToCanvas(el, { scale })
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
