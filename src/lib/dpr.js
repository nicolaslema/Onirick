// PLAN.md 6: device pixel ratio capped at 1.75, 1.25 on touch devices —
// for the 3D scenes, the melt canvas and the melt's section captures alike.
export const DPR_CAP =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches ? 1.25 : 1.75;

export const cappedDpr = () => Math.min(window.devicePixelRatio || 1, DPR_CAP);
