// The alarm's pace (PLAN-2.md 6.5): with `hud.recTo`, the REC dot's blink
// period runs from 1.2 s down to recTo as the dream's scrub goes 0 → 1. One
// function for the HUD's dot and the Fall's alarm beeps (PLAN-3.md 5.6), so
// they can't drift apart.
export const REC_PERIOD = 1.2;

export function recPeriodAt(fraction, recTo) {
  if (!recTo) return REC_PERIOD;
  return REC_PERIOD + (recTo - REC_PERIOD) * Math.min(Math.max(fraction, 0), 1);
}
