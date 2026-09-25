import DreamAction from '../components/DreamAction/DreamAction';
import DreamTitle from '../components/DreamTitle/DreamTitle';
import SceneCanvas from '../components/SceneCanvas/SceneCanvas';
import './shared.css';

// The frame every dream screen shares (PLAN.md 4.3): a full-bleed 3D scene
// with the DreamTitle block bottom-left on top of it, and the dream's
// keyboard action just above it (only visible when focused). `children` is
// the R3F scene; without one it's just the surface ground. `dream` is the id
// in night/dreams.js, where the log's copy lives.
const DreamFrame = ({ dream, tint, tape, time, stage, title, camera, children }) => (
  <section className="night-dream" aria-label={title}>
    {children && <SceneCanvas camera={camera}>{children}</SceneCanvas>}
    <div className="night-dream-title-slot">
      <DreamAction dream={dream} />
      <DreamTitle dream={dream} tint={tint} tape={tape} time={time} stage={stage} title={title} />
    </div>
  </section>
);

export default DreamFrame;
