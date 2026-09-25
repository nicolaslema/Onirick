import DreamTitle from '../components/DreamTitle/DreamTitle';
import SceneCanvas from '../components/SceneCanvas/SceneCanvas';
import { logText } from './dreams';
import './shared.css';

// The frame every dream screen shares (PLAN.md 4.3): a full-bleed 3D scene
// with the DreamTitle block bottom-left on top of it. `children` is the R3F
// scene; without one (dreams whose scene lands in a later phase) it's just
// the surface ground. `dream` is the id in night/dreams.js, where the log's
// copy lives.
const DreamFrame = ({ dream, tint, tape, time, stage, title, camera, children }) => (
  <section className="night-dream" aria-label={title}>
    {children && <SceneCanvas camera={camera}>{children}</SceneCanvas>}
    <div className="night-dream-title-slot">
      <DreamTitle tint={tint} tape={tape} time={time} stage={stage} title={title} log={logText(dream)} />
    </div>
  </section>
);

export default DreamFrame;
