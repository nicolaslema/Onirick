import { lazy } from 'react';
import TapeLabel from '../../components/TapeLabel/TapeLabel';
import SceneCanvas from '../../components/SceneCanvas/SceneCanvas';
import { useScrollSections } from '../../components/ScrollSections/ScrollSectionsContext';
import './Wake.css';

// Loaded with the 3D chunk, after the page has painted.
const WakeScene = lazy(() => import('./WakeScene'));

const WAKE_CAMERA = { position: [0, 1.1, 7.6], fov: 32 };

const Wake = () => {
  const { goTo } = useScrollSections();
  return (
    <section className="night-wake" aria-label="Wake">
      <SceneCanvas camera={WAKE_CAMERA}>
        <WakeScene camera={WAKE_CAMERA} />
      </SceneCanvas>
      <div className="night-wake-content">
        <TapeLabel>07:02 AM · Recording saved</TapeLabel>
        <h1 className="night-wake-display">Did you keep anything?</h1>
        <p className="night-wake-body">
          The DR-1 isn&rsquo;t real. Neither was the whale. Onirick is a design experiment in
          scroll-driven motion by Nicolás Lema.
        </p>
        <div className="night-wake-actions">
          <button type="button" className="onk-btn" onClick={() => goTo('hero')}>
            Replay the night
          </button>
          <a
            className="onk-btn-secondary"
            href="https://github.com/nicolaslema/Onirick"
            target="_blank"
            rel="noreferrer"
          >
            View source →
          </a>
        </div>
      </div>
    </section>
  );
};

export default Wake;
