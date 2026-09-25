import { DREAMS } from '../../night/dreams';
import { markTouched, trigger } from '../../night/play';
import './DreamAction.css';

// Each dream's one interaction, reachable by keyboard (PLAN-2.md 3.7): a real
// button, visually hidden until it takes focus (the skip-link pattern), that
// fires the same 'action' event the pointer gesture does. The scene decides
// what 'action' means (wave, stop climbing, ...). Hidden from melt captures
// by its class (useSectionTextures), so it can never be caught mid-focus.
const DreamAction = ({ dream }) => (
  <button
    type="button"
    className="onk-btn-secondary dream-action"
    onClick={() => {
      markTouched(dream);
      trigger(dream, 'action');
    }}
  >
    {DREAMS[dream].action}
  </button>
);

export default DreamAction;
