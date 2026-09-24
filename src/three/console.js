import { setConsoleFunction } from 'three';

// R3F 9 (through 9.8, the latest) still builds its frame clock with
// THREE.Clock, which three r183+ flags as deprecated on every canvas it
// creates. Nothing to fix on our side, and PLAN.md 9 wants a clean
// console, so that one known message is dropped; everything else three
// logs goes through untouched.
const R3F_CLOCK = 'Clock: This module has been deprecated';

setConsoleFunction((level, message, ...params) => {
  if (level === 'warn' && String(message).includes(R3F_CLOCK)) return;
  console[level](message, ...params);
});
