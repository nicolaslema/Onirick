import './shared.css';
import './Proof.css';

// Invented numbers for an invented product — leaning into scale here since
// there's nothing real being misrepresented; still specific rather than
// round, which is what makes a fabricated stat read as a stat and not a
// placeholder.
const STATS = [
  { value: '40ms', label: 'average time to first paint on any effect' },
  { value: '18,400+', label: 'sites running at least one effect in production' },
  { value: '60fps', label: 'sustained, even on integrated graphics from 2018' },
  { value: '0', label: 'shader lines you have to write yourself' }
];

const Proof = () => (
  <section className="current-proof">
    <div className="current-proof-stats">
      {STATS.map(s => (
        <div className="current-stat" key={s.label}>
          <span className="current-stat-value">{s.value}</span>
          <span className="current-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
    <div className="current-proof-logos">
      <p className="current-proof-logos-label">In production at</p>
      <div className="current-proof-logos-row">
        {[0, 1, 2, 3, 4].map(i => (
          <div className="current-placeholder current-logo-slot" key={i}>
            <span className="current-placeholder-label">logo</span>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default Proof;
