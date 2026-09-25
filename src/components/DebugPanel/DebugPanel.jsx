import { useEffect, useState } from 'react';

import { NIGHT } from '../../night/config';
import { DREAMS, DREAM_IDS } from '../../night/dreams';
import { getPlay, setTarget, trigger, usePlay } from '../../night/play';
import { forget, isKept, keep, lucidity, reset, useRecording } from '../../night/recording';
import './DebugPanel.css';

// Dev only, with ?debug in the URL (PLAN-2.md 4.5): the current dream's play
// state, the night's recording, and buttons to set any of it — so Wake and
// every dream's states can be tested without playing the night through.
// App.jsx only imports this behind import.meta.env.DEV; it never ships.

// `target` changes without notifying React (scenes poll it every frame), so
// the panel re-renders on a timer and reads the live value on every render
// — including the ones usePlay() triggers, so it's never a tick behind.
function useLiveTarget(id) {
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 100);
    return () => clearInterval(timer);
  }, []);
  return getPlay(id).target;
}

const DreamControls = ({ id }) => {
  const spec = NIGHT.find(section => section.id === id)?.play ?? { model: 'free' };
  const { beat, reveal, events } = usePlay(id);
  const target = useLiveTarget(id);
  const lines = DREAMS[id].lines;
  const eventNames = [...new Set(lines.map(line => line.on).filter(Boolean))];
  const steps =
    spec.model === 'scrub' ? spec.stops : spec.model === 'beats' ? Array.from({ length: spec.beats }, (_, i) => i) : [];

  return (
    <>
      <dl className="debug-grid">
        <dt>model</dt>
        <dd>{spec.model}</dd>
        <dt>target</dt>
        <dd>{target.toFixed(3)}</dd>
        {spec.model === 'beats' && (
          <>
            <dt>beat</dt>
            <dd>{beat}</dd>
          </>
        )}
        <dt>reveal</dt>
        <dd>
          {reveal}/{lines.length}
        </dd>
        <dt>events</dt>
        <dd>{events.length ? events.join(', ') : '—'}</dd>
      </dl>
      {(steps.length > 0 || eventNames.length > 0) && (
        <div className="debug-row">
          {steps.map(value => (
            <button key={value} type="button" data-on={Math.abs(target - value) < 1e-3 || undefined} onClick={() => setTarget(id, value)}>
              {spec.model === 'beats' ? `beat ${value}` : value}
            </button>
          ))}
          {eventNames.map(name => (
            <button key={name} type="button" data-on={events.includes(name) || undefined} onClick={() => trigger(id, name)}>
              {name}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

const DebugPanel = ({ currentId }) => {
  const recording = useRecording();
  const dream = DREAMS[currentId] ? currentId : null;

  return (
    <aside className="debug-panel" aria-label="Debug panel">
      <p className="debug-title">
        Debug · {currentId ?? '—'} · night of {recording.nightOf} · lucidity {lucidity(recording)}/5
      </p>
      {dream && <DreamControls key={dream} id={dream} />}
      <div className="debug-row">
        {DREAM_IDS.map(id => (
          <button
            key={id}
            type="button"
            data-on={isKept(id, recording) || undefined}
            title={DREAMS[id].fragment.label}
            onClick={() => (isKept(id, recording) ? forget(id) : keep(id))}
          >
            {id}
          </button>
        ))}
        <button type="button" onClick={reset}>
          reset night
        </button>
      </div>
    </aside>
  );
};

export default DebugPanel;
