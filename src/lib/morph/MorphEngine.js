import { Renderer, Triangle, Program, Mesh } from 'ogl';
import { gsap } from 'gsap';

import { vertexShader, fragmentShader, TRANSITIONS, hexToRgb } from './shaders';
import { makeFallbackTexture, resolveTextureSource } from './textures';

// Generic "morph between two textures" WebGL engine shared by MorphSlider
// (image-to-image, driven by click/GSAP or pointer-drag) and ScrollSections
// (section-to-section, driven by scroll). Owns the GL context, render loop
// and shader uniforms only — anything about *what* is being morphed (an
// image list vs. page sections) and *how progress is driven* (drag vs.
// wheel) lives in the consumer.
export class MorphEngine {
  constructor(container, { reducedMotion = false, getOptions, dprCap = 2, canvasClassName = 'morph-canvas' } = {}) {
    this.container = container;
    this.getOptions = getOptions;
    this.reducedMotion = reducedMotion;

    // Public flags consumers toggle to pause automatic option re-sync
    // (syncOptions()) while they're mid-interaction or mid-tween, so a
    // prop change doesn't cause a visible jump during a drag/scroll/tween.
    this.dragging = false;
    this.animating = false;
    this.tween = null;

    this.renderer = new Renderer({
      alpha: false,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, dprCap)
    });
    this.gl = this.renderer.gl;
    this.gl.clearColor(0.05, 0.05, 0.06, 1);

    this.canvas = this.gl.canvas;
    this.canvas.className = canvasClassName;
    container.appendChild(this.canvas);

    this.geometry = new Triangle(this.gl);

    const opts = this.getOptions();
    const fallback = makeFallbackTexture(this.gl);
    this.program = new Program(this.gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        tCurrent: { value: fallback },
        tNext: { value: fallback },
        uResolution: { value: [1, 1] },
        uCurrentSize: { value: [1, 1] },
        uNextSize: { value: [1, 1] },
        uProgress: { value: 0 },
        uDir: { value: 1 },
        uMode: { value: TRANSITIONS[opts.transition] ?? 0 },
        uIntensity: { value: opts.intensity },
        uScale: { value: opts.scale },
        uAberration: { value: opts.aberration },
        uDrift: { value: opts.drift },
        uTime: { value: 0 },
        uReduce: { value: reducedMotion ? 1 : 0 },
        uPointer: { value: [0.5, 0.5] },
        uOverlay: { value: hexToRgb(opts.overlayColor) }
      }
    });

    this.mesh = new Mesh(this.gl, { geometry: this.geometry, program: this.program });

    this.onContextLost = this.onContextLost.bind(this);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost, false);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();

    this.loop = this.loop.bind(this);
    this.raf = requestAnimationFrame(this.loop);
  }

  // Loads current/next textures (raw image/canvas elements, or a
  // { oglTexture, size } descriptor — see resolveTextureSource) and points
  // the shader at them. Does not touch uProgress; call setProgress()/
  // animateProgress() separately to actually drive the transition.
  prepareTransition(current, next, dir = 1) {
    const c = resolveTextureSource(this.gl, current);
    const n = resolveTextureSource(this.gl, next);
    this.program.uniforms.tCurrent.value = c.texture;
    this.program.uniforms.tNext.value = n.texture;
    this.program.uniforms.uCurrentSize.value = c.size;
    this.program.uniforms.uNextSize.value = n.size;
    this.program.uniforms.uDir.value = dir;
  }

  // Targeted updates for priming tCurrent/tNext individually without
  // touching the other slot or uDir — e.g. when a lazily-loaded image
  // finishes loading for the item that's already showing at rest.
  setCurrent(source) {
    const c = resolveTextureSource(this.gl, source);
    this.program.uniforms.tCurrent.value = c.texture;
    this.program.uniforms.uCurrentSize.value = c.size;
  }

  setNext(source) {
    const n = resolveTextureSource(this.gl, source);
    this.program.uniforms.tNext.value = n.texture;
    this.program.uniforms.uNextSize.value = n.size;
  }

  // Direct, un-tweened progress write — what a scrub/drag input tick calls.
  setProgress(p) {
    this.program.uniforms.uProgress.value = Math.min(Math.max(p, 0), 1);
  }

  getProgress() {
    return this.program.uniforms.uProgress.value;
  }

  // Tweened progress — what a click/keyboard/snap commit calls.
  animateProgress(target, { duration = 1, ease = 'power2.inOut', onComplete } = {}) {
    if (this.tween) this.tween.kill();
    this.animating = true;
    this.tween = gsap.to(this.program.uniforms.uProgress, {
      value: target,
      duration,
      ease,
      onComplete: () => {
        this.animating = false;
        this.tween = null;
        if (onComplete) onComplete();
      }
    });
    return this.tween;
  }

  // Promotes tNext into tCurrent and resets progress to 0 — call once a
  // transition has fully reached the next item/section.
  commit() {
    this.program.uniforms.tCurrent.value = this.program.uniforms.tNext.value;
    this.program.uniforms.uCurrentSize.value = this.program.uniforms.uNextSize.value;
    this.program.uniforms.uProgress.value = 0;
  }

  // Hard-resets progress to 0 and cancels any in-flight tween, without
  // touching which textures are loaded — for callers that need to bail out
  // of a transition (e.g. a window resize mid-scrub) rather than let it
  // finish.
  reset() {
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
    this.animating = false;
    this.dragging = false;
    this.setProgress(0);
  }

  setPointer(x, y) {
    this.program.uniforms.uPointer.value = [x, y];
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(rect.width, 1);
    const h = Math.max(rect.height, 1);
    this.renderer.setSize(w, h);
    this.program.uniforms.uResolution.value = [this.gl.canvas.width, this.gl.canvas.height];
  }

  syncOptions() {
    const opts = this.getOptions();
    this.program.uniforms.uMode.value = TRANSITIONS[opts.transition] ?? 0;
    this.program.uniforms.uIntensity.value = opts.intensity;
    this.program.uniforms.uScale.value = opts.scale;
    this.program.uniforms.uAberration.value = opts.aberration;
    this.program.uniforms.uDrift.value = opts.drift;
    this.program.uniforms.uOverlay.value = hexToRgb(opts.overlayColor);
  }

  loop(t) {
    this.program.uniforms.uTime.value = t * 0.001;
    if (!this.dragging && !this.animating) this.syncOptions();
    this.renderer.render({ scene: this.mesh });
    this.raf = requestAnimationFrame(this.loop);
  }

  onContextLost(e) {
    e.preventDefault();
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    if (this.tween) this.tween.kill();
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    if (this.program && this.program.program) this.gl.deleteProgram(this.program.program);
    const ext = this.gl.getExtension('WEBGL_lose_context');
    if (ext) ext.loseContext();
    if (this.canvas.parentNode) this.canvas.parentNode.removeChild(this.canvas);
  }
}
