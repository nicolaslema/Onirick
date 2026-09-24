import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Euler, Vector3 } from 'three';
import { easing } from 'maath';

import { pointer, trackPointer } from './pointer';
import { useReducedMotion } from './useReducedMotion';

// Pointer parallax for a scene's camera (PLAN.md 4.4): up to `yaw`/`pitch`
// radians as the pointer moves, smoothed with maath's damp3. Off under
// reduced motion (settles to rest).
// - pivot 'target' (default): the camera orbits `target`, which stays
//   centered — right for an object in open space.
// - pivot 'camera': the camera stays put and turns its head — right for a
//   tight interior, where orbiting a distant target would carry the camera
//   through the walls.
export function useCameraDrift({ position, target = [0, 0, 0], yaw = 0.15, pitch = 0.08, smoothTime = 0.35, pivot = 'target' }) {
  const reduced = useReducedMotion();
  const [px, py, pz] = position;
  const [tx, ty, tz] = target;

  const eye = useMemo(() => new Vector3(px, py, pz), [px, py, pz]);
  const center = useMemo(() => new Vector3(tx, ty, tz), [tx, ty, tz]);
  const angles = useMemo(() => new Vector3(), []);
  const euler = useMemo(() => new Euler(0, 0, 0, 'YXZ'), []);
  const scratch = useMemo(() => new Vector3(), []);

  useEffect(trackPointer, []);

  useFrame((state, delta) => {
    const goalPitch = reduced ? 0 : -pointer.y * pitch;
    const goalYaw = reduced ? 0 : pointer.x * yaw;
    easing.damp3(angles, [goalPitch, goalYaw, 0], smoothTime, delta);
    euler.set(angles.x, angles.y, 0);
    if (pivot === 'camera') {
      // Look direction rotated about the eye; the eye itself never moves.
      state.camera.position.copy(eye);
      scratch.copy(center).sub(eye).applyEuler(euler.set(-angles.x, -angles.y, 0)).add(eye);
      state.camera.lookAt(scratch);
    } else {
      scratch.copy(eye).sub(center).applyEuler(euler).add(center);
      state.camera.position.copy(scratch);
      state.camera.lookAt(center);
    }
  });
}
