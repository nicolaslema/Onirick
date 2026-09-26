import { useEffect, useMemo, useRef, useState } from 'react';

import { DREAMS } from '../../night/dreams';
import { getPlay, usePlay } from '../../night/play';
import { useReducedMotion } from '../../three/useReducedMotion';
import { useScrollSections, useSectionIndex } from '../ScrollSections/ScrollSectionsContext';
import './Transcript.css';

// The dream's log, transcribed by the machine as it happens (PLAN-2.md 4.1).
//
// Only lines already revealed (play.js `reveal`: by beat, progress or event)
// are typed. The block's size never depends on the typing: an invisible copy
// of the whole log sets it, and the typed text is drawn over that copy, out
// of the flow — so the dream's title, anchored above the log, never moves.
// Inside the overlay the text still to type is laid out too (transparent),
// so a word never jumps to the next line when its last letters arrive.
//
// At rest (not the current section, or mid-melt) it shows exactly what was
// typed so far, which is what the melt captured: entering forward the log is
// blank and typing starts after the melt, with no flicker. The section above
// the current one — the one you'd enter moving back — is filled in at once.
// Every time the visible text settles, the section's capture is retaken.

const CPS = 38;
const JITTER = 0.3; // ±30% per character
const PERIOD_PAUSE_MS = 220;
const START_DELAY_MS = 250;
const CARET_LINGER_MS = 1500;

const charDelay = prev => (1000 / CPS) * (1 + (Math.random() * 2 - 1) * JITTER) + (prev === '.' ? PERIOD_PAUSE_MS : 0);

// The log as one string, and where each line ends in it.
function layout(lines) {
  let full = '';
  const ends = lines.map((line, i) => {
    full += (i ? ' ' : '') + line.text;
    return full.length;
  });
  return { full, ends };
}

const Transcript = ({ id }) => {
  const { lines } = DREAMS[id];
  const { full, ends } = useMemo(() => layout(lines), [lines]);
  const { reveal } = usePlay(id);
  const limit = reveal ? ends[reveal - 1] : 0;
  const next = lines[reveal];
  // A line that waits for a scene event (the whale's wave): the caret stays,
  // blinking, as an invitation.
  const waiting = !!next && next.on !== undefined && next.at === undefined;

  const { currentIndex, activeTransition, recapture } = useScrollSections();
  const index = useSectionIndex();
  const reduced = useReducedMotion();
  const entry = getPlay(id);

  const [pos, setPos] = useState(entry.typed);
  const posRef = useRef(entry.typed);
  // REPLAY THE NIGHT zeroes entry.typed from outside: follow it down.
  if (entry.typed < posRef.current) posRef.current = entry.typed;
  const [caret, setCaret] = useState(false);

  const commit = value => {
    posRef.current = value;
    entry.typed = value;
    setPos(value);
  };

  const isCurrent = index === currentIndex;
  const active = isCurrent && !activeTransition && !reduced;

  // Not typing: under reduced motion everything revealed appears at once, and
  // the section above the current one is filled in before it can be entered.
  useEffect(() => {
    if (active) return;
    setCaret(reduced && isCurrent && waiting);
    if (!(reduced || index === currentIndex - 1) || posRef.current >= limit) return;
    commit(limit);
    recapture(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced, index, currentIndex, limit, waiting]);

  useEffect(() => {
    if (!active) return undefined;
    let timer = 0;
    let p = posRef.current;

    const step = () => {
      if (p >= limit) {
        setCaret(true);
        if (!waiting) timer = setTimeout(() => setCaret(false), CARET_LINGER_MS);
        recapture(index);
        return;
      }
      p += 1;
      commit(p);
      timer = setTimeout(step, charDelay(full[p - 1]));
    };

    setCaret(true);
    timer = setTimeout(step, p >= limit ? 0 : START_DELAY_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, limit, waiting]);

  const shown = Math.min(pos, entry.typed, limit);

  return (
    <p className="onk-dream-log onk-transcript">
      {/* Sets the block's size: the whole log, invisible. */}
      <span className="onk-transcript-sizer" aria-hidden="true">
        {full}
      </span>
      <span className="onk-transcript-typed" aria-hidden="true">
        {full.slice(0, shown)}
        {caret && <span className="onk-caret" />}
        <span className="onk-transcript-rest">{full.slice(shown)}</span>
      </span>
      <span className="sr-only">{full.slice(0, limit)}</span>
    </p>
  );
};

export default Transcript;
