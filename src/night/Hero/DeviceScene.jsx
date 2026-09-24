import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';

import Atmosphere from '../../three/Atmosphere';
import DR1 from '../../three/DR1';
import { readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { useCameraDrift } from '../../three/useCameraDrift';
import { useReducedMotion } from '../../three/useReducedMotion';

const BASE_YAW = -0.35; // ~20°, front turned toward the copy on the left
const TILT = 0.14; // ±8° with the pointer (PLAN.md 6.0)

// Center-right on a landscape screen (the copy owns the left). On a
// portrait one there's no "right" to spare, so it moves up above the copy
// and shrinks.
function useDeviceLayout() {
  const viewport = useThree(state => state.viewport);
  const portrait = viewport.aspect < 1;
  return portrait
    ? { position: [0, viewport.height * 0.28, 0], scale: 0.75 }
    : { position: [Math.min(viewport.width * 0.2, 1.6), -0.05, 0], scale: 1 };
}

const TiltingDevice = () => {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const layout = useDeviceLayout();
  useEffect(trackPointer, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const goal = reduced ? [0.12, BASE_YAW, 0] : [0.12 - pointer.y * TILT, BASE_YAW + pointer.x * TILT, 0];
    easing.dampE(ref.current.rotation, goal, 0.35, delta);
  });
  return (
    <group position={layout.position} scale={layout.scale}>
      <group ref={ref} rotation={[0.12, BASE_YAW, 0]}>
        <DR1 recording />
      </group>
    </group>
  );
};

const DeviceScene = ({ camera }) => {
  useCameraDrift({ position: camera.position });
  const light = useMemo(() => readToken('--ink'), []);
  const ground = useMemo(() => readToken('--surface'), []);
  return (
    <>
      <Atmosphere density={0.06} />
      <hemisphereLight args={[light, ground, 0.35]} />
      <directionalLight position={[2.5, 3, 4]} intensity={2} color={light} />
      <TiltingDevice />
    </>
  );
};

export default DeviceScene;
