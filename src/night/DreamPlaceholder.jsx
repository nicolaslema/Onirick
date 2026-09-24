import DreamTitle from '../components/DreamTitle/DreamTitle';
import './shared.css';

// Phase 0 stand-in for a dream's 3D scene: just the surface ground and its
// DreamTitle block. Phase 3/5 replace the inside of .night-dream with the
// real R3F scene per dream, without touching this positioning.
const DreamPlaceholder = ({ tint, tape, time, stage, title, log }) => (
  <section className="night-dream" aria-label={title}>
    <div className="night-dream-title-slot">
      <DreamTitle tint={tint} tape={tape} time={time} stage={stage} title={title} log={log} />
    </div>
  </section>
);

export default DreamPlaceholder;
