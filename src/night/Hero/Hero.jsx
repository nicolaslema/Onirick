import TapeLabel from '../../components/TapeLabel/TapeLabel';
import { useScrollSections } from '../../components/ScrollSections/ScrollSectionsContext';
import './Hero.css';

// Phase 0: placeholder. Phase 2 adds the DR-1 3D scene (DeviceScene.jsx,
// center-right, tilted ~20°) behind this content.
const Hero = () => {
  const { goTo } = useScrollSections();
  return (
    <section className="night-hero" aria-label="Onirick DR-1">
      <div className="night-hero-content">
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
