import { useEffect, useRef, useState } from 'react';

import { DREAMS } from '../../night/dreams';
import { getPlay } from '../../night/play';
import { isKept, lucidity, useRecording } from '../../night/recording';
import { useReducedMotion } from '../../three/useReducedMotion';
import ScrambleCounter from './ScrambleCounter';
import './Hud.css';

// Styled by the shared .onk-hud rules in styles/components.css, plus Hud.css
// for the state line, lucidity, prompt and tape progress. REC uses the same
// blinking .onk-rec dot as TapeLabel (1.2s steps(2), static under reduced
// motion).
const STATE_LABEL = { standby: 'Standby', rec: 'Rec', stop: '■ Stop' };

const PROMPT_AFTER_MS = 6000; // PLAN-2.md 4.3
const PROMPT_FOR_MS = 5000;
const FRESH_MS = 1200; // a newly kept fragment's segment blinks rec (4.2)

// How far into its own scroll a gated dream is, 0-1 (PLAN-2.md 4.4).
function fractionOf(id, play) {
  if (!id || !play) return 0;
  const { target } = getPlay(id);
  if (play.model === 'scrub') return target;
  if (play.model === 'beats') return target / Math.max(1, play.beats - 1);
  return 0;
}

const gatedPlay = play => (play?.model === 'scrub' || play?.model === 'beats' ? play : null);

// '06:41 AM' <-> minutes since midnight.
const toMinutes = clock => {
  const [, h, m, ampm] = /(\d+):(\d+)\s*(AM|PM)/.exec(clock);
  return ((Number(h) % 12) + (ampm === 'PM' ? 12 : 0)) * 60 + Number(m);
};
const pad = n => String(n).padStart(2, '0');
const fromMinutes = total => {
  const h24 = Math.floor(total / 60) % 24;
  return `${pad(h24 % 12 || 12)}:${pad(total % 60)} ${h24 < 12 ? 'AM' : 'PM'}`;
};
// '00:52:17' <-> seconds.
const toSeconds = counter => counter.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
const fromSeconds = total => [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(pad).join(':');

// The clock (and counter) a scrubbing dream moves through: `clock` → `clockTo`
// with its progress, a minute (a second) at a time. Re-renders only when the
// text changes.
function useScrubbedHud(dream, hud, play) {
  const [shown, setShown] = useState(null); // { hud, clock, counter } | null
  const moving = !!play && !!(hud.clockTo || hud.counterTo);
  useEffect(() => {
    if (!moving) return undefined;
    let raf = 0;
    const frame = () => {
      const f = fractionOf(dream, play);
      const clock = hud.clockTo ? fromMinutes(Math.round(toMinutes(hud.clock) + (toMinutes(hud.clockTo) - toMinutes(hud.clock)) * f)) : hud.clock;
      const counter = hud.counterTo ? fromSeconds(Math.round(toSeconds(hud.counter) + (toSeconds(hud.counterTo) - toSeconds(hud.counter)) * f)) : hud.counter;
      setShown(prev => (prev?.hud === hud && prev.clock === clock && prev.counter === counter ? prev : { hud, clock, counter }));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [moving, dream, hud, play]);
  // Until the first frame of this section's scrub, its own static values.
  return moving && shown?.hud === hud ? shown : hud;
}

// The current tape: lit (as before), or for a dream with its own scroll, a
// bar filling with its progress — written straight to the DOM every frame.
// Once full it blinks once: one more gesture and you're through.
const ActiveTape = ({ dream, play }) => {
  const fill = useRef(null);
  const bar = useRef(null);
  useEffect(() => {
    if (!play) return undefined;
    let raf = 0;
    const frame = () => {
      const f = Math.min(Math.max(fractionOf(dream, play), 0), 1);
      if (fill.current) fill.current.style.transform = `scaleX(${f})`;
      if (bar.current) {
        const full = f > 0.999;
        if (full !== (bar.current.dataset.full === 'true')) bar.current.dataset.full = String(full);
      }
      raf = requestAnimationFrame(frame);
    };
    frame();
    return () => cancelAnimationFrame(raf);
  }, [dream, play]);
  if (!play) return <span data-active />;
  return (
    <span ref={bar} data-active data-progress>
      <i ref={fill} />
    </span>
  );
};

// LUCIDITY ▮▮▯▯▯ (PLAN-2.md 4.2): one segment per fragment kept tonight. A
// segment kept while you watch blinks rec twice, then stays ink.
const Lucidity = () => {
  const recording = useRecording();
  const level = lucidity(recording);
  const seen = useRef(level);
  const [fresh, setFresh] = useState(-1);
  useEffect(() => {
    if (level > seen.current) {
      setFresh(level - 1);
      const timer = setTimeout(() => setFresh(-1), FRESH_MS);
      seen.current = level;
      return () => clearTimeout(timer);
    }
    seen.current = level;
    return undefined;
  }, [level]);
  return (
    <span className="onk-hud-lucidity">
      Lucidity
      <span className="onk-hud-segments">
        {Array.from({ length: 5 }, (_, i) => (
          <i key={i} data-on={i < level || undefined} data-fresh={i === fresh || undefined} />
        ))}
      </span>
    </span>
  );
};

// PROMPT · WAVE ↔ (PLAN-2.md 4.3): 6 s into a dream whose interaction isn't
// obvious, if its fragment isn't kept and it wasn't tried, for 5 s — once per
// dream per night.
const Prompt = ({ dream, settled }) => {
  // `text` outlives `on`, so the line keeps its words while fading out.
  const [prompt, setPrompt] = useState({ text: '', on: false });
  const recording = useRecording();
  const hint = dream ? DREAMS[dream].hint : null;
  const kept = dream ? isKept(dream, recording) : true;
  useEffect(() => {
    if (!hint || !settled || kept) return undefined;
    const entry = getPlay(dream);
    if (entry.hinted) return undefined;
    let hide = 0;
    const show = setTimeout(() => {
      if (entry.touched || entry.hinted) return;
      entry.hinted = true;
      setPrompt({ text: hint, on: true });
      hide = setTimeout(() => setPrompt(p => ({ ...p, on: false })), PROMPT_FOR_MS);
    }, PROMPT_AFTER_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
      // Leaving the dream (or keeping its fragment) takes the prompt away.
      setPrompt(p => (p.on ? { ...p, on: false } : p));
    };
  }, [dream, hint, settled, kept]);
  return (
    <span className="onk-hud-prompt" data-on={prompt.on || undefined}>
      Prompt · {prompt.text}
    </span>
  );
};

// Driven by App.jsx's lifted ScrollSections state (see the comment there) —
// follows the actual current section, including flipping into the paper
// theme on the manual. `dream`: the current section's id if it's a dream;
// `play`: its play spec; `lucid`: show the lucidity line (dreams and Wake);
// `settled`: no transition in flight.
const Hud = ({
  hud = { state: 'standby', clock: '11:58 PM', counter: '00:00:00' },
  index = 0,
  total = 8,
  theme = 'night',
  tape,
  title,
  dream,
  play,
  lucid = false,
  settled = true
}) => {
  // The visual HUD is aria-hidden (it's redundant with each section's own
  // content, and a four-corner fixed overlay reads as noise to a screen
  // reader) — this announces the same change in words instead, on every
  // section change. It has to be a sibling of the aria-hidden div, not
  // nested inside it: an aria-hidden ancestor suppresses aria-live
  // descendants too.
  const announce = tape ? `Tape ${String(tape).padStart(2, '0')}, ${title}` : title;
  // "Fragment kept: …" (PLAN-2.md 3.5) gets its own live region, so it never
  // overwrites — or is overwritten by — the section announcement.
  const { announcement } = useRecording();
  const reduced = useReducedMotion();
  const gated = gatedPlay(play);
  const { clock, counter } = useScrubbedHud(dream, hud, gated);

  return (
    <>
      <div className="onk-hud" data-theme={theme} data-reduced={reduced || undefined} aria-hidden="true">
        <div className="onk-hud-tl">
          <span className="onk-hud-mark">Onirick</span>
          <span>DR-1</span>
        </div>
        <div className="onk-hud-tr">
          <span className="onk-hud-state">
            {hud.state === 'rec' && <span className="onk-rec" />}
            {STATE_LABEL[hud.state] ?? hud.state}
          </span>
          <span>{clock}</span>
        </div>
        <div className="onk-hud-bl">
          <Prompt dream={dream} settled={settled} />
          {lucid && <Lucidity />}
        </div>
        <div className="onk-hud-br">
          {/* Scrambles when the section changes, not while a scrub moves it second by second. */}
          <ScrambleCounter className="onk-hud-counter" value={counter} group={index} />
          <div className="onk-hud-tapes">
            {Array.from({ length: total - 1 }, (_, i) =>
              index === i + 1 ? <ActiveTape key={i} dream={dream} play={gated} /> : <span key={i} />
            )}
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
      <div className="sr-only" aria-live="polite">
        {announcement?.text}
      </div>
    </>
  );
};

export default Hud;
