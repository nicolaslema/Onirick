import { DREAMS } from '../../night/dreams';
import { act, markTouched } from '../../night/play';
import './DreamAction.css';

// Each dream's one interaction, reachable by keyboard (PLAN-2.md 3.7): a real
// button, visually hidden until it takes focus (the skip-link pattern), that
// fires the dream's action (play.js act()) — the scene decides what it means
// (wave, stop climbing, ...), the same as its pointer gesture. Hidden from
// melt captures by its class (useSectionTextures), so it can never be caught
// mid-focus.
const DreamAction = ({ dream }) => (
  <button
    type="button"
    className="onk-btn-secondary dream-action"
    onClick={() => {
      markTouched(dream);
      act(dream);
    }}
  >
    {DREAMS[dream].action}
  </button>
);

export default DreamAction;
