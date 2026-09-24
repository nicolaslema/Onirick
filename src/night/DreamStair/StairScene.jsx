import { useLayoutEffect, useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Object3D } from 'three';
import { easing } from 'maath';

import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { useCameraDrift } from '../../three/useCameraDrift';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';

const STEPS = 120;
const PER_TURN = 24;
const RISE = 0.18;
const STEP_RADIUS = 1.25; // step center, from the axis
const BOTTOM = -4;
const WINDOW_EVERY = 12;
const WINDOW_RADIUS = 2.45;
const SPIN = 0.02; // rad/s (PLAN.md 6.1)
const POINTER_SPIN = 0.5; // extra rad at the pointer's edge

const stepAngle = i => (i * Math.PI * 2) / PER_TURN;
const stepY = i => BOTTOM + i * RISE;

const Steps = ({ color }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < STEPS; i++) {
      dummy.position.set(0, stepY(i), 0);
      dummy.rotation.set(0, stepAngle(i), 0);
      dummy.translateX(STEP_RADIUS);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[null, null, STEPS]}>
      <boxGeometry args={[1.6, 0.12, 0.42]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </instancedMesh>
  );
};

// "Every landing has the same window, and the same moon in it": identical
// frame + moon, repeated every 12 steps, facing out toward the camera.
const MoonWindow = ({ index, frameColor, moonColor }) => {
  const a = stepAngle(index);
  const position = [Math.cos(a) * WINDOW_RADIUS, stepY(index) + 0.9, -Math.sin(a) * WINDOW_RADIUS];
  const bar = (w, h, x, y) => (
    <mesh position={[x, y, 0]}>
      <boxGeometry args={[w, h, 0.08]} />
      <meshStandardMaterial {...FLAT} color={frameColor} />
    </mesh>
  );
  return (
    <group position={position} rotation-y={a + Math.PI / 2}>
      {bar(0.9, 0.08, 0, 0.6)}
      {bar(0.9, 0.08, 0, -0.6)}
      {bar(0.08, 1.28, -0.45, 0)}
      {bar(0.08, 1.28, 0.45, 0)}
      {bar(0.04, 1.2, 0, 0)}
      <mesh position={[0.14, 0.22, -0.12]}>
        <circleGeometry args={[0.17, 16]} />
        <meshBasicMaterial color={moonColor} />
      </mesh>
    </group>
  );
};

const Staircase = ({ colors }) => {
  const ref = useRef(null);
  const spin = useRef(0);
  const reduced = useReducedMotion();
  useEffect(trackPointer, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    spin.current += delta * SPIN * (reduced ? REDUCED_SPEED : 1);
    const goal = spin.current + (reduced ? 0 : pointer.x * POINTER_SPIN);
    easing.damp(ref.current.rotation, 'y', goal, 0.5, delta);
  });
  const windows = useMemo(() => Array.from({ length: STEPS / WINDOW_EVERY }, (_, k) => k * WINDOW_EVERY + WINDOW_EVERY / 2), []);
  return (
    <group ref={ref}>
      <mesh position={[0, BOTTOM + (STEPS * RISE) / 2, 0]}>
        <cylinderGeometry args={[0.42, 0.42, STEPS * RISE + 2, 10]} />
        <meshStandardMaterial {...FLAT} color={colors.column} />
      </mesh>
      <Steps color={colors.step} />
      {windows.map(i => (
        <MoonWindow key={i} index={i} frameColor={colors.frame} moonColor={colors.moon} />
      ))}
    </group>
  );
};

const StairScene = ({ camera }) => {
  useCameraDrift({ position: camera.position, target: [0, 3.5, 0] });
  const colors = useMemo(
    () => ({
      tint: readTint('stair'),
      step: readToken('--ink-muted'),
      column: readToken('--line-strong'),
      frame: readToken('--line-strong'),
      moon: readToken('--ink'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.07} />
      <hemisphereLight args={[colors.tint, colors.surface, 0.35]} />
      <directionalLight position={[3, 10, 4]} intensity={2.2} color={colors.tint} />
      <Staircase colors={colors} />
    </>
  );
};

export default StairScene;
