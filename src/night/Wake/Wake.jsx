import { lazy, useEffect, useMemo, useState } from 'react';

import TapeLabel from '../../components/TapeLabel/TapeLabel';
import SceneCanvas from '../../components/SceneCanvas/SceneCanvas';
import { useScrollSections, useSectionIndex } from '../../components/ScrollSections/ScrollSectionsContext';
import { HAS_WEBGL2 } from '../../lib/webgl';
import { useReducedMotion } from '../../three/useReducedMotion';
import { DREAMS, DREAM_IDS } from '../dreams';
import { isKept, lucidity, reset, useRecording } from '../recording';
import { onceSettledAt } from '../stage';
import './Wake.css';

// Loaded with the 3D chunk, after the page has painted.
const WakeScene = lazy(() => import('./WakeScene'));

const WAKE_CAMERA = { position: [0, 1.1, 7.6], fov: 32 };

// "Did you keep anything?" — answered at last (PLAN-2.md 7): a line for how
// much you kept, and the tape's log, one line per dream, printed by the
// machine. All copy here is a draft.
const TIERS = [
  [0, 'The tape is blank. Most nights are.'],
  [1, 'A few seconds made it through.'],
  [3, 'Most of it made it through. Not all of it.'],
  [5, 'You kept all of it. That almost never happens.']
];
const NO_WEBGL = "The tape is blank. Your browser couldn't reach the dream.";
const NO_SIGNAL = '— no signal —';
const tierLine = kept => (HAS_WEBGL2 ? [...TIERS].reverse().find(([min]) => kept >= min)[1] : NO_WEBGL);

// Printing speeds (characters per second) and pauses.
const HEAD_CPS = 70; // "TAPE 02 · THE WHALE…" — the machine's own words, fast
const BODY_CPS = 45; // what you kept (or didn't)
const HEAD_PAUSE_MS = 250;
const ROW_PAUSE_MS = 120;
const START_MS = 350;

// What's printed, in order: the tier line, then each tape's head and body.
function useSegments(recording) {
  return useMemo(() => {
    const kept = lucidity(recording);
    const segments = [{ key: 'tier', text: tierLine(kept), cps: BODY_CPS, pause: 400 }];
    DREAM_IDS.forEach((id, i) => {
      segments.push({ key: `${id}-head`, text: `Tape 0${i + 1} · ${DREAMS[id].title}`, cps: HEAD_CPS, pause: HEAD_PAUSE_MS });
      const has = isKept(id, recording);
      segments.push({ key: `${id}-body`, text: has ? DREAMS[id].fragment.label : NO_SIGNAL, cps: BODY_CPS, pause: ROW_PAUSE_MS, kept: has });
    });
    return segments;
  }, [recording]);
}

// Printed text: what's typed so far, the rest in place but transparent — so
// nothing moves as it prints, and a capture never shows half a line.
const Printed = ({ text, count, className }) => (
  <span className={className} aria-hidden="true">
    {text.slice(0, count)}
    <span className="night-wake-unprinted">{text.slice(count)}</span>
  </span>
);

// The machine prints while Wake is on screen and settled; away from it,
// nothing is printed — the melt in shows it blank, and every arrival
// prints it again. Under reduced motion it's all there at once.
function usePrinter(segments, printing, reduced) {
  const [counts, setCounts] = useState(() => segments.map(() => 0));
  const [done, setDone] = useState(false);
  // A new arrival, a departure, or a different recording: start from blank
  // (adjusted during render, React's pattern for resetting on a change).
  const [seen, setSeen] = useState({ segments, printing });
  if (seen.segments !== segments || seen.printing !== printing) {
    setSeen({ segments, printing });
    setCounts(segments.map(() => 0));
    setDone(false);
  }
  useEffect(() => {
    if (!printing || reduced) return undefined;
    let timer = 0;
    let seg = 0;
    let char = 0;
    const tick = () => {
      if (seg >= segments.length) {
        setDone(true);
        return;
      }
      const s = segments[seg];
      if (char < s.text.length) {
        char += 1;
        const [at, n] = [seg, char];
        setCounts(prev => prev.map((c, i) => (i === at ? n : c)));
        timer = setTimeout(tick, 1000 / s.cps);
        return;
      }
      seg += 1;
      char = 0;
      timer = setTimeout(tick, s.pause);
    };
    timer = setTimeout(tick, START_MS);
    return () => clearTimeout(timer);
  }, [segments, printing, reduced]);
  if (printing && reduced) return { counts: segments.map(s => s.text.length), done: true };
  return { counts, done };
}

const Wake = () => {
  const { goTo, currentIndex, activeTransition, recapture } = useScrollSections();
  const index = useSectionIndex();
  const printing = index === currentIndex && !activeTransition;
  const reduced = useReducedMotion();
  const recording = useRecording();
  const segments = useSegments(recording);
  const { counts, done } = usePrinter(segments, printing, reduced);
  const [saved, setSaved] = useState('');

  // The ejected tape's label counts what you kept: a fragment kept while
  // Wake sits cached (the Fall's, a second before the melt) retakes its
  // capture, so the melt shows the right count. The printed log needs
  // nothing — at rest it's blank.
  const kept = lucidity(recording);
  useEffect(() => {
    recapture(index);
  }, [kept, index, recapture]);

  const replay = () => {
    // A new night — once the hero has settled and Wake is gone, so the
    // recording doesn't empty itself before your eyes.
    onceSettledAt('hero', reset);
    goTo('hero');
  };
  const save = async () => {
    setSaved('');
    // Loaded on the first click: it's only ever needed here.
    const { saveTape } = await import('./saveTape');
    const result = await saveTape(recording, segments[0].text);
    if (result !== 'cancelled') setSaved('Tape saved.');
  };

  return (
    <section className="night-wake" aria-label="Wake">
      <SceneCanvas camera={WAKE_CAMERA}>
        <WakeScene camera={WAKE_CAMERA} />
      </SceneCanvas>
      <div className="night-wake-content">
        <TapeLabel>07:02 AM · Recording saved</TapeLabel>
        <h1 className="night-wake-display">Did you keep anything?</h1>
        <p className="night-wake-tier">
          <Printed text={segments[0].text} count={counts[0]} />
          <span className="sr-only">{segments[0].text}</span>
        </p>
        <p className="night-wake-body">
          The DR-1 isn&rsquo;t real. Neither was the whale. Onirick is a design experiment in
          scroll-driven motion by Nicolás Lema.
        </p>
        <ol className="night-wake-tapes" aria-label="Your recording">
          {DREAM_IDS.map((id, i) => {
            const head = segments[1 + i * 2];
            const body = segments[2 + i * 2];
            return (
              <li key={id} data-kept={body.kept || undefined}>
                <Printed className="night-wake-tape-head" text={head.text} count={counts[1 + i * 2]} />
                <span className="night-wake-tape-leader" aria-hidden="true" data-on={counts[1 + i * 2] > 0 || undefined} />
                <Printed className="night-wake-tape-body" text={body.text} count={counts[2 + i * 2]} />
                <span className="sr-only">{`${head.text}: ${body.kept ? body.text : 'no signal'}`}</span>
              </li>
            );
          })}
        </ol>
        <div className="night-wake-actions" data-ready={done || undefined}>
          <button type="button" className="onk-btn" onClick={replay}>
            Replay the night
          </button>
          <button type="button" className="onk-btn-secondary" onClick={save}>
            Save the tape ↓
          </button>
          <a className="onk-btn-secondary" href="https://github.com/nicolaslema/Onirick" target="_blank" rel="noreferrer">
            View source →
          </a>
        </div>
        <span className="sr-only" aria-live="polite">
          {saved}
        </span>
      </div>
    </section>
  );
};

export default Wake;
