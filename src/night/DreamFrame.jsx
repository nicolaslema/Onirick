import DreamTitle from '../components/DreamTitle/DreamTitle';
import SceneCanvas from '../components/SceneCanvas/SceneCanvas';
import './shared.css';

// The frame every dream screen shares (PLAN.md 4.3): a full-bleed 3D scene
// with the DreamTitle block bottom-left on top of it. `children` is the R3F
// scene; without one (dreams whose scene lands in a later phase) it's just
// the surface ground.
const DreamFrame = ({ tint, tape, time, stage, title, log, camera, children }) => (
  <section className="night-dream" aria-label={title}>
    {children && <SceneCanvas camera={camera}>{children}</SceneCanvas>}
    <div className="night-dream-title-slot">
      <DreamTitle tint={tint} tape={tape} time={time} stage={stage} title={title} log={log} />
    </div>
  </section>
);

export default DreamFrame;
