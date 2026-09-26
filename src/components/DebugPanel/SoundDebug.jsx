import { useEffect, useState, useSyncExternalStore } from 'react';

import { cue, getEngine, isOn, subscribe } from '../../sound/bus';
import { LAYERS } from '../../sound/engine';
import { gainToDb } from '../../sound/synth';

// The sound part of the ?debug panel (PLAN-3.md 3.8): the context's state, a
// meter per layer and on the master (after the limiter), the limiter's
// reduction, a click count, the tape's state and
// controls, and a button per one-off sound. Levels in dBFS.

const METERED = [...LAYERS, 'master'];

// One set of meters per engine, however often the panel remounts.
const meters = new WeakMap();

function attachMeters(engine, onReading) {
  if (meters.has(engine)) {
    meters.get(engine).listeners.add(onReading);
    return;
  }
  const entry = { listeners: new Set([onReading]) };
  meters.set(engine, entry);
  const { ctx, nodes } = engine;
  ctx.audioWorklet.addModule(new URL('../../sound/meter.worklet.js', import.meta.url)).then(() => {
    METERED.forEach(name => {
      const meter = new AudioWorkletNode(ctx, 'onirick-meter', { numberOfOutputs: 0 });
      (name === 'master' ? nodes.limiter : nodes.layers[name]).connect(meter);
      meter.port.onmessage = ({ data }) => {
        // Each click's details go to window.__soundClicks, to trace it back.
        if (data.click) return (window.__soundClicks ??= []).push({ layer: name, ...data.click, ctxTime: ctx.currentTime });
        entry.listeners.forEach(listener => listener(name, data));
      };
    });
  });
}

const db = value => {
  const d = gainToDb(value);
  return d === -Infinity || d < -99 ? '−∞' : d.toFixed(1);
};

function useEngine() {
  const [engine, setEngine] = useState(getEngine);
  useEffect(() => {
    if (engine) return undefined;
    const timer = setInterval(() => setEngine(getEngine()), 200);
    return () => clearInterval(timer);
  }, [engine]);
  return engine;
}

const SoundDebug = () => {
  const on = useSyncExternalStore(subscribe, isOn);
  const engine = useEngine();
  const [readings, setReadings] = useState({});
  const [, tick] = useState(0);

  useEffect(() => {
    if (!engine) return undefined;
    const onReading = (name, data) => setReadings(current => ({ ...current, [name]: data }));
    attachMeters(engine, onReading);
    // ctx.state and the limiter's reduction change without telling anyone.
    const timer = setInterval(() => tick(n => n + 1), 200);
    return () => {
      meters.get(engine)?.listeners.delete(onReading);
      clearInterval(timer);
    };
  }, [engine]);

  if (!engine) {
    return <p className="debug-title">Sound · {on ? 'on, starts on the first click, tap or key' : 'off (turn it on in the HUD)'}</p>;
  }

  const clicks = METERED.reduce((sum, name) => sum + (readings[name]?.clicks ?? 0), 0);

  return (
    <>
      <p className="debug-title">
        Sound · {engine.ctx.state} · limiter {engine.nodes.limiter.reduction.toFixed(1)} dB · wow {(engine.nodes.wowDepth.gain.value * 1000).toFixed(2)} ms · clicks {clicks}
      </p>
      <dl className="debug-grid debug-meters">
        {METERED.map(name => (
          <div key={name} className="debug-meter">
            <dt>{name}</dt>
            <dd>
              rms {db(readings[name]?.rms ?? 0)} · peak {db(readings[name]?.peak ?? 0)}
              {readings[name]?.clicks ? ` · clicks ${readings[name].clicks}` : ''}
            </dd>
          </div>
        ))}
      </dl>
      <p className="debug-title">
        Tape · {engine.tape.state} · {engine.tape.position.toFixed(1)} / {Number(engine.tape.duration || 0).toFixed(0)} s
      </p>
      <div className="debug-row">
        <button type="button" disabled={!on} onClick={() => engine.tape.start()}>
          tape start
        </button>
        <button type="button" disabled={!on} onClick={() => engine.tape.stop()}>
          tape stop
        </button>
        <button type="button" disabled={!on} onClick={() => engine.tape.stop(0.4)}>
          burn stop
        </button>
        <button type="button" disabled={!on} onClick={() => engine.tape.rewind()}>
          tape rewind
        </button>
        <button type="button" disabled={!on} onClick={() => engine.tape.seek(engine.tape.loopEnd - 10)}>
          → near loop
        </button>
      </div>
      <div className="debug-row">
        {engine.cues.map(name => (
          <button key={name} type="button" disabled={!on} onClick={() => cue(name, { debug: true })}>
            {name}
          </button>
        ))}
      </div>
    </>
  );
};

export default SoundDebug;
