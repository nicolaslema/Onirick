import { useEffect, useRef, useState, useCallback } from 'react';
import { Texture } from 'ogl';

import { MorphEngine } from '../../lib/morph';

import './MorphSlider.css';

const DEFAULT_ITEMS = [
  {
    image: 'https://images.unsplash.com/photo-1782977389500-dd7adad33ebe?q=80&w=1600&auto=format&fit=crop',
    caption: 'One'
  },
  {
    image: 'https://images.unsplash.com/photo-1781499455083-6ccc3beb20cd?q=80&w=1600&auto=format&fit=crop',
    caption: 'Two'
  },
  {
    image: 'https://images.unsplash.com/photo-1776394254711-4a0d7345269a?q=80&w=1600&auto=format&fit=crop',
    caption: 'Three'
  },
  {
    image: 'https://images.unsplash.com/photo-1781242629922-6f39cc3671cd?q=80&w=1600&auto=format&fit=crop',
    caption: 'Four'
  }
];

// Slider-specific concerns (item list, looping index, click/drag navigation)
// wrapped around the generic MorphEngine (GL setup, shaders, render loop,
// shared with the scroll-driven section system in src/components/ScrollSections).
class SliderController {
  constructor(container, { items, startIndex, reducedMotion, getOptions, onIndexChange, dprCap }) {
    this.items = items;
    this.getOptions = getOptions;
    this.onIndexChange = onIndexChange;
    this.reducedMotion = reducedMotion;

    this.current = startIndex;
    this.dragDir = 0;
    this.shownIndex = startIndex;

    this.engine = new MorphEngine(container, {
      reducedMotion,
      getOptions,
      dprCap,
      canvasClassName: 'morph-slider-canvas'
    });

    this.textures = this.items.map(() => null);
    this.sizes = this.items.map(() => [1, 1]);

    this.loadTextures();
  }

  loadTextures() {
    const gl = this.engine.gl;
    this.items.forEach((item, index) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = item.image;
      img.onload = () => {
        const texture = new Texture(gl, { generateMipmaps: false });
        texture.image = img;
        this.textures[index] = texture;
        this.sizes[index] = [img.naturalWidth || 1, img.naturalHeight || 1];
        if (index === this.current) {
          this.engine.setCurrent({ oglTexture: texture, size: this.sizes[index] });
        }
      };
      img.onerror = () => {};
    });
  }

  wrap(i) {
    const n = this.items.length;
    return ((i % n) + n) % n;
  }

  prepareNext(dir) {
    const target = this.wrap(this.current + dir);
    this.engine.prepareTransition(
      { oglTexture: this.textures[this.current], size: this.sizes[this.current] },
      { oglTexture: this.textures[target], size: this.sizes[target] },
      dir
    );
    return target;
  }

  goTo(dir) {
    if (this.engine.animating || this.engine.dragging || this.items.length < 2) return;
    const opts = this.getOptions();
    if (!opts.loop) {
      const raw = this.current + dir;
      if (raw < 0 || raw > this.items.length - 1) return;
    }
    this.engine.syncOptions();
    const target = this.prepareNext(dir);
    this.announce(target);
    const duration = this.reducedMotion ? Math.min(opts.duration, 0.4) : opts.duration;
    this.engine.animateProgress(1, {
      duration,
      ease: opts.ease,
      onComplete: () => this.commit(target)
    });
  }

  announce(index) {
    if (index === this.shownIndex) return;
    this.shownIndex = index;
    if (this.onIndexChange) this.onIndexChange(index);
  }

  commit(target) {
    this.current = target;
    this.engine.commit();
    this.announce(target);
  }

  next() {
    this.goTo(1);
  }

  prev() {
    this.goTo(-1);
  }

  setPointer(x, y) {
    this.engine.setPointer(x, y);
  }

  beginDrag() {
    if (this.engine.animating || this.items.length < 2) return false;
    this.engine.dragging = true;
    this.dragDir = 0;
    this.engine.syncOptions();
    return true;
  }

  drag(ndx) {
    if (!this.engine.dragging) return;
    const opts = this.getOptions();
    const dir = ndx < 0 ? 1 : -1;
    if (!opts.loop) {
      const raw = this.current + dir;
      if (raw < 0 || raw > this.items.length - 1) {
        this.engine.setProgress(0);
        return;
      }
    }
    if (dir !== this.dragDir) {
      this.dragDir = dir;
      this.prepareNext(dir);
    }
    const progress = Math.min(Math.abs(ndx), 1);
    this.engine.setProgress(progress);
    this.announce(progress > 0.5 ? this.wrap(this.current + dir) : this.current);
  }

  endDrag() {
    if (!this.engine.dragging) return;
    this.engine.dragging = false;
    const p = this.engine.getProgress();
    if (this.dragDir === 0) return;
    const target = this.wrap(this.current + this.dragDir);
    const duration = this.reducedMotion ? 0.3 : 0.5;
    if (p > 0.4) {
      this.announce(target);
      this.engine.animateProgress(1, {
        duration,
        ease: 'power2.out',
        onComplete: () => this.commit(target)
      });
    } else {
      this.announce(this.current);
      this.engine.animateProgress(0, { duration, ease: 'power2.out' });
    }
  }

  destroy() {
    this.textures.forEach(tex => {
      if (tex && tex.texture) this.engine.gl.deleteTexture(tex.texture);
    });
    this.engine.destroy();
  }
}

export default function MorphSlider({
  items = DEFAULT_ITEMS,
  startIndex = 0,
  transition = 'melt',
  duration = 1.1,
  ease = 'power2.inOut',
  intensity = 0.55,
  scale = 2.4,
  aberration = 0.35,
  drift = 0.4,
  autoplay = false,
  autoplayDelay = 4,
  loop = true,
  radius = 16,
  overlayColor = '#000000',
  showCaptions = true,
  showControls = true,
  showIndicators = true,
  className = '',
  ...props
}) {
  const containerRef = useRef(null);
  const sliderRef = useRef(null);
  const [index, setIndex] = useState(startIndex);
  const [hovering, setHovering] = useState(false);

  const optsRef = useRef();
  optsRef.current = { transition, duration, ease, intensity, scale, aberration, drift, overlayColor, loop };

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const slider = new SliderController(containerRef.current, {
      items,
      startIndex,
      reducedMotion,
      dprCap: 2,
      getOptions: () => optsRef.current,
      onIndexChange: setIndex
    });
    sliderRef.current = slider;
    setIndex(startIndex);

    return () => {
      slider.destroy();
      sliderRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, startIndex]);

  const handleNext = useCallback(() => sliderRef.current?.next(), []);
  const handlePrev = useCallback(() => sliderRef.current?.prev(), []);

  useEffect(() => {
    if (!autoplay || hovering) return undefined;
    const id = setTimeout(() => sliderRef.current?.next(), Math.max(autoplayDelay, 1) * 1000);
    return () => clearTimeout(id);
  }, [autoplay, autoplayDelay, hovering, index]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    let startX = 0;
    let width = 1;
    let active = false;

    const onDown = e => {
      const rect = el.getBoundingClientRect();
      width = rect.width || 1;
      startX = e.clientX;
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      sliderRef.current?.setPointer(px, 1 - py);
      active = sliderRef.current?.beginDrag() ?? false;
      if (active && el.setPointerCapture) {
        try {
          el.setPointerCapture(e.pointerId);
        } catch {}
      }
    };
    const onMove = e => {
      if (!active) return;
      const ndx = (e.clientX - startX) / width;
      sliderRef.current?.drag(ndx);
    };
    const onUp = () => {
      if (!active) return;
      active = false;
      sliderRef.current?.endDrag();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  const onKeyDown = useCallback(
    e => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      }
    },
    [handleNext, handlePrev]
  );

  const hasCaptions = items.some(item => item.caption);

  return (
    <div
      className={`morph-slider ${className}`.trim()}
      style={{
        borderRadius: `${radius}px`,
        '--ms-swap': `${(duration * 0.66).toFixed(3)}s`,
        '--ms-dot': `${(duration * 0.45).toFixed(3)}s`
      }}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      {...props}
    >
      <div
        ref={containerRef}
        className="morph-slider-stage"
        role="group"
        aria-roledescription="carousel"
        aria-label="Image morph slider"
        tabIndex={0}
        onKeyDown={onKeyDown}
      />

      {showCaptions && hasCaptions && (
        <div className="morph-slider-caption" aria-live="polite">
          {items.map((item, i) =>
            item.caption ? (
              <span
                key={i}
                aria-hidden={i === index ? undefined : true}
                className={`morph-slider-caption-text ${i === index ? 'is-active' : ''}`}
              >
                {item.caption}
              </span>
            ) : null
          )}
        </div>
      )}

      {showControls && (
        <div className="morph-slider-controls">
          <button type="button" className="morph-slider-btn" aria-label="Previous slide" onClick={handlePrev}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M15 5l-7 7 7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button type="button" className="morph-slider-btn" aria-label="Next slide" onClick={handleNext}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path
                d="M9 5l7 7-7 7"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      {showIndicators && (
        <div className="morph-slider-indicators" role="tablist" aria-label="Slides">
          {items.map((item, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Go to slide ${i + 1}`}
              className={`morph-slider-dot ${i === index ? 'is-active' : ''}`}
              onClick={() => {
                const slider = sliderRef.current;
                if (!slider || i === index) return;
                slider.goTo(i > index ? 1 : -1);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
