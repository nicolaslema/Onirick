import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';

import { subscribeTarget, usePlayRef } from '../night/play';

// A dream's play target (PLAN-2.md 3.3), smoothed for a scene: a ref whose
// `.current` eases toward the target every frame (`smoothTime` seconds),
// jumps straight to it when the gate prepares or resets the dream (a snap),
// and asks for a frame whenever the target changes — a neighbour's canvas
// only renders on demand, and it has to draw its prepared state before the
// melt captures it. Call it first in the scene, so its useFrame runs before
// the ones that read it.
export function usePlayProgress(id, smoothTime = 0.25) {
  const play = usePlayRef(id);
  const value = useRef(play.current.target);
  const seenSnaps = useRef(play.current.snaps);
  const invalidate = useThree(state => state.invalidate);

  useEffect(
    () =>
      subscribeTarget(changed => {
        if (changed === id) invalidate();
      }),
    [id, invalidate]
  );

  useFrame((_, delta) => {
    const entry = play.current;
    if (entry.snaps !== seenSnaps.current) {
      seenSnaps.current = entry.snaps;
      value.current = entry.target;
      return;
    }
    easing.damp(value, 'current', entry.target, smoothTime, delta);
  });

  return value;
}
