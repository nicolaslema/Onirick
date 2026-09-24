import { useEffect, useState } from 'react';

import { useReducedMotion } from '../../three/useReducedMotion';
import './Loader.css';

const FADE_MS = 800; // "el hero aparece desde night (0.8s)" — PLAN.md 5.2

const pad = n => String(n).padStart(2, '0');
// Real elapsed time as a tape counter, MM:SS:hundredths.
const format = ms => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}:${pad(Math.floor(ms / 10) % 100)}`;

// First-load cover (PLAN.md 5.2): a tape counter runs up from 00:00:00 while
// fonts load and the first two sections are captured; then it fades out
// over 0.8s, revealing the hero from the night surface. Instant under
// reduced motion. Unmounts once gone.
const Loader = ({ ready }) => {
  const reduced = useReducedMotion();
  const [elapsed, setElapsed] = useState(0);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (ready) return undefined;
    const start = performance.now();
    let raf;
    const tick = now => {
      setElapsed(now - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready]);

  useEffect(() => {
    if (!ready) return undefined;
    const t = setTimeout(() => setGone(true), reduced ? 0 : FADE_MS);
    return () => clearTimeout(t);
  }, [ready, reduced]);

  if (gone) return null;
  return (
    <div className="onk-loader" data-lifting={ready || undefined} role="status">
      <span className="onk-loader-counter" aria-hidden="true">
        {format(elapsed)}
      </span>
      <span className="sr-only">{ready ? 'Loaded' : 'Loading'}</span>
    </div>
  );
};

export default Loader;
