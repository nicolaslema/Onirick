import { useEffect, useRef, useState } from 'react';

import { useReducedMotion } from '../../three/useReducedMotion';

const SCRAMBLE_MS = 400;
const STAGGER_MS = 30;
const TICK_MS = 45; // how often a scrambling digit changes

const randomDigit = () => String(Math.floor(Math.random() * 10));

// Tape counter (PLAN.md 5.2): on each change every digit scrambles for 0.4s
// and settles on its new value, left to right with a 30ms offset. Colons
// stay put. Jumps straight to the value under reduced motion. With a
// `group` (the Hud passes the section index), it only scrambles when the
// group changed too — a dream's scrub moving it second by second just
// updates it.
const ScrambleCounter = ({ value, className, group }) => {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const first = useRef(true);
  const lastGroup = useRef(group);

  useEffect(() => {
    const regrouped = group === undefined || lastGroup.current !== group;
    lastGroup.current = group;
    if (first.current || reduced || !regrouped) {
      first.current = false;
      setShown(value);
      return undefined;
    }
    const start = performance.now();
    const chars = [...value];
    let lastTick = 0;
    let raf;
    const frame = now => {
      const elapsed = now - start;
      if (elapsed >= SCRAMBLE_MS + STAGGER_MS * chars.length) {
        setShown(value);
        return;
      }
      if (now - lastTick >= TICK_MS) {
        lastTick = now;
        let digit = 0;
        setShown(
          chars
            .map(c => {
              if (!/\d/.test(c)) return c;
              const settled = elapsed >= SCRAMBLE_MS + STAGGER_MS * digit++;
              return settled ? c : randomDigit();
            })
            .join('')
        );
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduced]);

  return <span className={className}>{shown}</span>;
};

export default ScrambleCounter;
