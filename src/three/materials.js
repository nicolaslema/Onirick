import { Color } from 'three';

// Scene colors come from tokens.css (night theme, on :root) rather than
// being duplicated as hex literals here, so the 3D and the DOM can't drift.
export function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// PLAN.md 4.4: every mesh is low-poly, flat shaded, matte.
export const FLAT = { flatShading: true, roughness: 0.9, metalness: 0 };

// PLAN.md 4.4: scene.background is the night surface mixed 15% with the
// dream's tint (no tint: plain surface, e.g. the hero's neutral fog).
export function sceneBackground(tintHex) {
  const bg = new Color(readToken('--surface'));
  return tintHex ? bg.lerp(new Color(tintHex), 0.15) : bg;
}
