import { useSyncExternalStore } from 'react';

import { isOn, subscribe, toggle } from '../../sound/bus';
import './SoundToggle.css';

// SOUND OFF / SOUND ON (PLAN-3.md 3.6), in the HUD's top-left corner under
// ONIRICK · DR-1. The HUD is aria-hidden corner by corner; this is the one
// thing in it a screen reader and a keyboard reach. Its name is "Sound" and
// aria-pressed carries the state — the visible "off"/"on" is hidden from the
// name, or it would read as "Sound on, not pressed".
const SoundToggle = () => {
  const on = useSyncExternalStore(subscribe, isOn, () => false);
  return (
    <button type="button" className="onk-sound" aria-pressed={on} data-on={on || undefined} onClick={toggle}>
      <span className="onk-sound-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span>
        Sound<span aria-hidden="true"> {on ? 'on' : 'off'}</span>
      </span>
    </button>
  );
};

export default SoundToggle;
