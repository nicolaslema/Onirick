import { Texture } from 'ogl';

export function makeFallbackTexture(gl) {
  const size = 4;
  const data = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = 24;
    data[i * 4 + 1] = 24;
    data[i * 4 + 2] = 28;
    data[i * 4 + 3] = 255;
  }
  return new Texture(gl, { image: data, width: size, height: size, generateMipmaps: false });
}

// Accepts an HTMLImageElement, an HTMLCanvasElement, or an already-built ogl
// Texture (passed through unchanged so callers can keep reusing texture
// instances they preloaded themselves, e.g. MorphSlider's item cache).
export function makeTextureFromSource(gl, source) {
  if (!source) return null;
  if (source instanceof Texture) return source;
  const texture = new Texture(gl, { generateMipmaps: false });
  texture.image = source;
  return texture;
}

export function getSourceSize(source) {
  if (!source) return [1, 1];
  if (typeof source.naturalWidth === 'number') {
    return [source.naturalWidth || 1, source.naturalHeight || 1];
  }
  if (typeof source.width === 'number') {
    return [source.width || 1, source.height || 1];
  }
  return [1, 1];
}

// Normalizes whatever MorphEngine.prepareTransition() is handed into a
// { texture, size } pair. Accepts either a raw HTMLImageElement/
// HTMLCanvasElement (texture + size auto-detected, e.g. section snapshots),
// or a pre-built descriptor { oglTexture, size } for callers that already
// own and cache their own ogl Texture instances (e.g. MorphSlider's preloaded
// item textures) and want to reuse them instead of re-wrapping every frame.
// Note: the descriptor key is `oglTexture`, not `texture` — ogl's own
// Texture instances already have an internal `.texture` field (the raw
// WebGLTexture handle), so `texture` would collide with a bare Texture input.
export function resolveTextureSource(gl, input) {
  if (input && input.oglTexture) {
    return { texture: input.oglTexture, size: input.size || [1, 1] };
  }
  return { texture: makeTextureFromSource(gl, input), size: getSourceSize(input) };
}
