import { useEffect, useState, useSyncExternalStore } from 'react';

import { cue, getEngine, isOn, subscribe } from '../../sound/bus';
import { LAYERS } from '../../sound/engine';
import { gainToDb } from '../../sound/synth';

// The sound part of the ?debug panel (PLAN-3.md 3.8): the context's state, a
// meter per layer and on the master (after the limiter), the limiter's
// reduction, a click count, and the phase's test sounds. Levels in dBFS.

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
      meter.port.onmessage = ({ data }) => entry.listeners.forEach(listener => listener(name, data));
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
    return <p className="debug-title">Sound · {on ? 'loading…' : 'off (turn it on in the HUD)'}</p>;
  }

  const clicks = METERED.reduce((sum, name) => sum + (readings[name]?.clicks ?? 0), 0);

  return (
    <>
      <p className="debug-title">
        Sound · {engine.ctx.state} · limiter {engine.nodes.limiter.reduction.toFixed(1)} dB · clicks {clicks}
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
      <div className="debug-row">
        <button type="button" disabled={!on} onClick={() => cue('test')}>
          test tone
        </button>
        <button type="button" disabled={!on} data-on={engine.humming || undefined} onClick={() => engine.testHum(!engine.humming)}>
          test hum
        </button>
      </div>
    </>
  );
};

export default SoundDebug;
