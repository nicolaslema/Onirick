import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../../three/useReducedMotion';
import './Loader.css';

const FADE_MS = 800; // "el hero aparece desde night (0.8s)" — PLAN.md 5.2

const pad = n => String(n).padStart(2, '0');
// Real elapsed time as a tape counter, MM:SS:hundredths.
const format = ms => `${pad(Math.floor(ms / 60000))}:${pad(Math.floor(ms / 1000) % 60)}:${pad(Math.floor(ms / 10) % 100)}`;

// First-load cover (PLAN.md 5.2): a tape counter runs up from 00:00:00 while
// fonts load and the first two sections are captured; then it fades out
// over 0.8s, revealing the hero from the night surface. Instant under
// reduced motion. Unmounts once gone. Same markup as the static first frame
// in index.html, which it replaces.
const Loader = ({ ready }) => {
  const reduced = useReducedMotion();
  const [initial] = useState(() => format(performance.now()));
  const [gone, setGone] = useState(false);
  const counter = useRef(null);

  // Counts from navigation start (performance.now()'s origin), so it
  // continues from index.html's static frame instead of restarting. Written
  // straight to the DOM: a React render per frame would compete with the
  // very loading it stands in for.
  useEffect(() => {
    if (ready) return undefined;
    let raf;
    const tick = now => {
      if (counter.current) counter.current.textContent = format(now);
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
      <span className="onk-loader-counter" ref={counter} aria-hidden="true">
        {initial}
      </span>
      <span className="sr-only">{ready ? 'Loaded' : 'Loading'}</span>
    </div>
  );
};

export default Loader;
