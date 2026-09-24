import { useEffect, useRef } from 'react';
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

// This is Current's one 'scroll'-kind section (see App.jsx) — its content
// runs taller than the viewport and scrolls natively rather than melting
// into its neighbors, so each stat gets its own reveal-on-scroll instead of
// all four appearing at once.
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return ref;
}

const Reveal = ({ className = '', children }) => {
  const ref = useReveal();
  return (
    <div ref={ref} className={`current-reveal ${className}`}>
      {children}
    </div>
  );
};

const Proof = () => (
  <section className="current-proof">
    <p className="current-proof-intro">
      Numbers, for what a fabricated product's numbers are worth — this section scrolls on its own
      instead of melting into the next one.
    </p>
    <div className="current-proof-stats">
      {STATS.map(s => (
        <Reveal className="current-stat" key={s.label}>
          <span className="current-stat-value">{s.value}</span>
          <span className="current-stat-label">{s.label}</span>
        </Reveal>
      ))}
    </div>
    <Reveal className="current-placeholder current-testimonial">
      <span className="current-placeholder-label">testimonial</span>
    </Reveal>
    <Reveal className="current-proof-logos">
      <p className="current-proof-logos-label">In production at</p>
      <div className="current-proof-logos-row">
        {[0, 1, 2, 3, 4].map(i => (
          <div className="current-placeholder current-logo-slot" key={i}>
            <span className="current-placeholder-label">logo</span>
          </div>
        ))}
      </div>
    </Reveal>
  </section>
);

export default Proof;
