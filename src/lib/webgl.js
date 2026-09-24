// PLAN.md 6: without WebGL2 there's no melt and no 3D — every section shows
// its poster and every transition is a crossfade. Checked once: the
// constructor existing isn't enough (it can exist with WebGL blocked), so a
// context is actually requested.
export const HAS_WEBGL2 =
  typeof window !== 'undefined' &&
  typeof window.WebGL2RenderingContext !== 'undefined' &&
  (() => {
    try {
      return !!document.createElement('canvas').getContext('webgl2');
    } catch {
      return false;
    }
  })();
