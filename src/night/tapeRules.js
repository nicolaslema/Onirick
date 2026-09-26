// What the tape does when the stage changes (PLAN-3.md 4.1, 4.3, 4.5), as a
// pure function so it can be tested without a browser.
//
// `prev`/`next`: night/stage.js snapshots ({ currentId, settled, transition }).
// `stateOf(id)`: the DR-1's state in that section — 'standby' | 'rec' | 'stop'.
//
// The tape runs while the DR-1 records: a transition heading into a 'rec'
// section starts it, one heading out stops it — at the transition's start,
// so the motor spins up (or down) under the melt or the crossfade. The burn
// into Wake stops it abruptly, silent by the white. Arriving at Wake: STOP
// and eject. Wake → hero (REPLAY THE NIGHT, or Home from Wake): rewind.

export const BURN_STOP_SECONDS = 0.4;

export function tapeCue(prev, next, stateOf) {
  const cue = { tape: null, delay: 0, seconds: undefined, wow: null, rewind: false, stopAndEject: false, standby: false };
  const target = next.transition ? next.transition.toId : next.currentId;
  const recording = stateOf(target) === 'rec';
  cue.standby = stateOf(target) === 'standby';

  const t = next.transition;
  if (t && t !== prev.transition) {
    if (t.kind === 'melt') cue.wow = { duration: t.duration, intensity: t.intensity };
    if (t.fromId === 'wake' && t.toId === 'hero') cue.rewind = true;
    if (recording) cue.tape = 'start';
    else if (t.burn > 0) {
      cue.tape = 'stop';
      cue.seconds = BURN_STOP_SECONDS;
      cue.delay = Math.max(t.duration / 2 - BURN_STOP_SECONDS, 0);
    } else cue.tape = 'stop';
    return cue;
  }

  const arrived = next.settled && (!prev.settled || prev.currentId !== next.currentId);
  if (arrived) {
    cue.tape = recording ? 'start' : 'stop';
    cue.stopAndEject = stateOf(next.currentId) === 'stop';
  }
  return cue;
}
