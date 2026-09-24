import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';

import TapeLabel from '../../components/TapeLabel/TapeLabel';
import { useIntroStarted } from '../../components/Loader/IntroContext';
import SceneCanvas from '../../components/SceneCanvas/SceneCanvas';
import { useScrollSections } from '../../components/ScrollSections/ScrollSectionsContext';
import DeviceScene from './DeviceScene';
import { useReducedMotion } from '../../three/useReducedMotion';
import './Hero.css';

const HERO_CAMERA = { position: [0, 0.35, 4.6], fov: 32 };

// First load only (PLAN.md 5.2): once the loader starts lifting, the tape
// label, display, body and each button rise 12px and fade in, 0.6s
// power2.out, 80ms apart. Until then the copy stays in its resting state —
// the melt's first capture of this section is taken during the loader.
function useEntrance(ref) {
  const started = useIntroStarted();
  const reduced = useReducedMotion();
  // `started` flips once (loader lifted), so this plays once. Cleanup
  // reverts rather than kills: a killed from() tween would leave the copy
  // stuck invisible (e.g. StrictMode's mount/unmount/mount in dev).
  useLayoutEffect(() => {
    if (!started || reduced || !ref.current) return undefined;
    const c = ref.current;
    const targets = [...c.children].flatMap(el => (el.classList.contains('night-hero-actions') ? [...el.children] : [el]));
    const tween = gsap.from(targets, { opacity: 0, y: 12, duration: 0.6, ease: 'power2.out', stagger: 0.08, clearProps: 'opacity,transform' });
    return () => tween.revert();
  }, [started, reduced, ref]);
}

const Hero = () => {
  const { goTo } = useScrollSections();
  const content = useRef(null);
  useEntrance(content);
  return (
    <section className="night-hero" aria-label="Onirick DR-1">
      <SceneCanvas camera={HERO_CAMERA}>
        <DeviceScene camera={HERO_CAMERA} />
      </SceneCanvas>
      <div className="night-hero-content" ref={content}>
        <TapeLabel>DR-1 · Dream recorder · 1986</TapeLabel>
        <h1 className="night-hero-display">Every night you lose about six dreams. Keep one.</h1>
        <p className="night-hero-body">
          The Onirick DR-1 sits by your bed and records the one that matters. Press REC, close
          your eyes, and scroll.
        </p>
        <div className="night-hero-actions">
          <button type="button" className="onk-btn" onClick={() => goTo('stair')}>
            Begin recording
          </button>
          <button type="button" className="onk-btn-secondary" onClick={() => goTo('manual')}>
            Read the manual →
          </button>
        </div>
      </div>
      <p className="night-hero-track">Scroll to fall asleep ↓</p>
    </section>
  );
};

export default Hero;
