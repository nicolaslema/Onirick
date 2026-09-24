import TapeLabel from '../../components/TapeLabel/TapeLabel';
import './Manual.css';

const STEPS = [
  { n: '01', text: 'Place it within arm’s reach.' },
  { n: '02', text: 'Press REC before you close your eyes.' },
  { n: '03', text: 'In the morning, press ▶. The tape keeps one dream.' }
];

const SPECS = [
  { label: 'Recording', value: '6h 40m', note: 'Of REM, on one 90-minute tape. It only keeps what matters.' },
  { label: 'Battery', value: '11 nights' },
  { label: 'Tape', value: 'C-90 DREAM', note: 'Standard cassettes will record, but only nightmares.' },
  { label: 'Noise floor', value: '−42 dB', note: 'Quieter than your breathing. That’s the point.' },
  { label: 'Weight', value: '640 g' },
  { label: 'Size', value: '142 × 96 × 38 mm' }
];

const WARNINGS = [
  'Do not record on nights you want to forget.',
  'Recordings of other people’s dreams are not supported.',
  'If the tape plays back a dream you don’t remember having, stop the unit and turn on the lights.'
];

// The one 'scroll'-kind section (see App.jsx's NIGHT config) — paper theme,
// no 3D, native scroll. data-theme="paper" here flips every color token for
// this subtree only (see tokens.css).
const Manual = () => (
  <section className="night-manual" data-theme="paper" aria-label="Manual">
    <div className="night-manual-inner">
      <TapeLabel>03:40 AM · You woke up</TapeLabel>
      <h2 className="night-manual-heading">You woke up. Here&rsquo;s how it works.</h2>
      <p className="night-manual-lede">
        The DR-1 listens for the moment your breathing slows, then records until morning. It keeps
        one dream. Usually the right one.
      </p>

      <div className="night-manual-block">
        <h3 className="night-manual-block-title">How the DR-1 listens</h3>
        <ol className="night-manual-steps">
          {STEPS.map(s => (
            <li key={s.n}>
              <span className="night-manual-step-n">{s.n}</span>
              <span>{s.text}</span>
            </li>
          ))}
        </ol>
      </div>

      <table className="onk-spec">
        <tbody>
          {SPECS.map(s => (
            <tr key={s.label}>
              <th>{s.label}</th>
              <td>
                {s.value}
                {s.note && <small>{s.note}</small>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="night-manual-block">
        <h3 className="night-manual-block-title">Warnings</h3>
        <ul className="night-manual-warnings">
          {WARNINGS.map(w => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      </div>

      <TapeLabel>Go back to sleep ↓</TapeLabel>
    </div>
  </section>
);

export default Manual;
