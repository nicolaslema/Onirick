import { useEffect, useMemo, useRef, useState } from 'react';

import { DREAMS } from '../../night/dreams';
import { getPlay, usePlay } from '../../night/play';
import { lucidity } from '../../night/recording';
import { useReducedMotion } from '../../three/useReducedMotion';
import { useScrollSections, useSectionIndex } from '../ScrollSections/ScrollSectionsContext';
import './Transcript.css';

// The dream's log, transcribed by the machine as it happens (PLAN-2.md 4.1).
//
// Only lines already revealed (play.js `reveal`: by beat, progress or event)
// are typed. The whole log is always laid out — what isn't typed yet is
// transparent — so the block never grows while typing, and a capture never
// shows text that isn't really there.
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
const GLITCH_HOLD_MS = 350;
const ERASE_MS = 45;
const CARET_LINGER_MS = 1500;
// Chance tonight's transcript mistypes its word, by lucidity 0-5: the
// clearer the dreamer, the better the machine hears.
const GLITCH_ODDS = [1, 0.8, 0.6, 0.4, 0.2, 0];

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

function planGlitch(full, glitches) {
  const g = glitches?.[0];
  if (!g) return false;
  const match = new RegExp(`\\b${g.word}\\b`).exec(full);
  if (!match || Math.random() >= GLITCH_ODDS[lucidity()]) return false;
  return { at: match.index, word: g.word, wrong: g.wrong };
}

const Transcript = ({ id }) => {
  const { lines, glitches } = DREAMS[id];
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
  const [wrong, setWrong] = useState(null); // { at, text } while mistyping
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
    if (entry.glitch === null) entry.glitch = planGlitch(full, glitches);
    let timer = 0;
    let p = posRef.current;

    const finish = () => {
      setCaret(true);
      if (!waiting) timer = setTimeout(() => setCaret(false), CARET_LINGER_MS);
      recapture(index);
    };

    const step = () => {
      if (p >= limit) {
        finish();
        return;
      }
      const g = entry.glitch;
      if (g && p === g.at) {
        mistype(g);
        return;
      }
      p += 1;
      commit(p);
      timer = setTimeout(step, charDelay(full[p - 1]));
    };

    // Types the wrong word, holds it, erases it — then carries on.
    const mistype = g => {
      let k = 0;
      const type = () => {
        k += 1;
        setWrong({ at: g.at, word: g.word, text: g.wrong.slice(0, k) });
        timer = k < g.wrong.length ? setTimeout(type, charDelay('')) : setTimeout(erase, GLITCH_HOLD_MS);
      };
      const erase = () => {
        k -= 1;
        if (k > 0) {
          setWrong({ at: g.at, word: g.word, text: g.wrong.slice(0, k) });
          timer = setTimeout(erase, ERASE_MS);
          return;
        }
        setWrong(null);
        entry.glitch = false;
        timer = setTimeout(step, charDelay(''));
      };
      timer = setTimeout(type, charDelay(''));
    };

    setCaret(true);
    timer = setTimeout(step, p >= limit ? 0 : START_DELAY_MS);
    return () => {
      clearTimeout(timer);
      setWrong(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, limit, waiting]);

  const shown = Math.min(pos, entry.typed, limit);
  const typed = wrong ? full.slice(0, wrong.at) + wrong.text : full.slice(0, shown);
  const rest = full.slice(wrong ? wrong.at + wrong.word.length : shown);

  return (
    <p className="onk-dream-log">
      <span aria-hidden="true">
        {typed}
        {caret && <span className="onk-caret" />}
        <span className="onk-transcript-rest">{rest}</span>
      </span>
      <span className="sr-only">{full.slice(0, limit)}</span>
    </p>
  );
};

export default Transcript;
