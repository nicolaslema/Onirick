import TapeLabel from '../TapeLabel/TapeLabel';

// The one text block on every dream screen: TapeLabel, huge italic serif
// title tinted with that dream's token, then a short second-person log.
const DreamTitle = ({ tint, tape, time, stage, title, log }) => (
  <div className="onk-dream" style={{ '--dream-tint': `var(--dream-${tint})` }}>
    <TapeLabel live>{`Tape ${String(tape).padStart(2, '0')} · ${time} · ${stage}`}</TapeLabel>
    <h2 className="onk-dream-title">{title}</h2>
    <p className="onk-dream-log">{log}</p>
  </div>
);

export default DreamTitle;
