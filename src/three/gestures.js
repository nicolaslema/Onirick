// Pure gesture detectors (PLAN-2.md 3.6): no React, no DOM — feed them
// samples, they answer. Tested by gestures.test.js (`pnpm test`).

// A wave: the pointer shaken side to side. Feed it the pointer's x (NDC) and
// a timestamp (ms) every frame; it returns true on the sample that completes
// a wave — `reversals` changes of direction within `window` ms, each leg at
// least `minAmp` long — and then starts over.
export function createWaveDetector({ reversals = 3, window = 1500, minAmp = 0.06 } = {}) {
  let anchor = null; // where the current leg started, while no direction yet
  let dir = 0; // +1 moving right, -1 moving left, 0 not yet decided
  let extreme = 0; // furthest x reached in the current direction
  let turns = []; // timestamps of the direction changes

  const restart = x => {
    anchor = x;
    dir = 0;
    extreme = x;
    turns = [];
  };

  return function update(x, t) {
    if (anchor === null) restart(x);
    turns = turns.filter(at => t - at <= window);

    if (dir === 0) {
      if (Math.abs(x - anchor) >= minAmp) {
        dir = Math.sign(x - anchor);
        extreme = x;
      }
      return false;
    }

    // Still going the same way: push the extreme further.
    if ((x - extreme) * dir > 0) {
      extreme = x;
      return false;
    }

    // Came back far enough from the extreme: that's a change of direction,
    // and the new leg already measures minAmp.
    if ((extreme - x) * dir >= minAmp) {
      turns.push(t);
      dir = -dir;
      extreme = x;
      if (turns.length >= reversals) {
        restart(x);
        return true;
      }
    }
    return false;
  };
}
