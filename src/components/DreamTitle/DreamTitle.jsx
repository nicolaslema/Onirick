import TapeLabel from '../TapeLabel/TapeLabel';
import Transcript from '../Transcript/Transcript';

// The one text block on every dream screen: TapeLabel, huge italic serif
// title tinted with that dream's token, then the second-person log — which
// the machine transcribes as it happens (Transcript, PLAN-2.md 4.1).
// `dream` is the id in night/dreams.js.
const DreamTitle = ({ dream, tint, tape, time, stage, title }) => (
  <div className="onk-dream" style={{ '--dream-tint': `var(--dream-${tint})` }}>
    <TapeLabel live>{`Tape ${String(tape).padStart(2, '0')} · ${time} · ${stage}`}</TapeLabel>
    <h2 className="onk-dream-title">{title}</h2>
    <Transcript id={dream} />
  </div>
);

export default DreamTitle;
