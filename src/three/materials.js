import { Color, SRGBColorSpace } from 'three';

// Scene colors come from tokens.css (night theme, on :root) rather than
// being duplicated as hex literals here, so the 3D and the DOM can't drift.
export function readToken(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// A dream's tint token (PLAN.md 4.1): drives its fog, main light and title.
export function readTint(tint) {
  return readToken(`--dream-${tint}`);
}

// PLAN.md 4.4: every mesh is low-poly, flat shaded, matte.
export const FLAT = { flatShading: true, roughness: 0.9, metalness: 0 };

// PLAN.md 4.4: scene.background is the night surface mixed 15% with the
// dream's tint (no tint: plain surface, e.g. the hero's neutral fog).
// Mixed in sRGB, like the tokens themselves: Color.lerp works in linear space,
// where 15% of a bright tint comes out several times lighter (a mid brown
// instead of a near-black), and the dream's log text loses its AA contrast.
export function sceneBackground(tintHex) {
  const bg = new Color(readToken('--surface'));
  if (!tintHex) return bg;
  const a = bg.getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const b = new Color(tintHex).getRGB({ r: 0, g: 0, b: 0 }, SRGBColorSpace);
  const mix = (x, y) => x + (y - x) * 0.15;
  return new Color().setRGB(mix(a.r, b.r), mix(a.g, b.g), mix(a.b, b.b), SRGBColorSpace);
}
