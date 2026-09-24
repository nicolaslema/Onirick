import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { easing } from 'maath';

import Atmosphere from '../../three/Atmosphere';
import { readTint, readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCloudTexture } from '../../three/useCloudTexture';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';

// Falling forever (PLAN.md 6.6). Everything lives in a column H tall that
// scrolls upward past a camera looking down; each layer is drawn twice,
// stacked, and wraps every H, so the fall never runs out.
const H = 40;
const SPREAD = 14;
const SPEED = 5; // units/s, constant
const POINTS = 2000;
const CLOUDS = 26;
const LINES = 140;
const SHAKE = 0.002;
const STEER = 2.2; // how far the pointer pulls the camera, in units

function useFallClock() {
  const t = useRef(0);
  const reduced = useReducedMotion();
  useFrame((_, delta) => {
    t.current += delta * (reduced ? REDUCED_SPEED : 1);
  });
  return t;
}

// One layer, tiled: `children` renders the column once; it's drawn at y=0
// and y=-H and the pair scrolls up at `speed`, wrapping every H.
const Tiled = ({ time, speed, children }) => {
  const ref = useRef(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = (time.current * speed) % H;
  });
  return (
    <group ref={ref}>
      <group>{children}</group>
      <group position-y={-H}>{children}</group>
    </group>
  );
};

function useColumnPoints(count, seed) {
  const geometry = useMemo(() => {
    const rand = seeded(seed);
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (rand() - 0.5) * SPREAD * 2;
      pos[i * 3 + 1] = -rand() * H;
      pos[i * 3 + 2] = (rand() - 0.5) * SPREAD * 2;
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    return g;
  }, [count, seed]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

// Fine, thin streaks along the fall — the "líneas de velocidad".
function useSpeedLines() {
  const geometry = useMemo(() => {
    const rand = seeded(23);
    const pos = new Float32Array(LINES * 6);
    for (let i = 0; i < LINES; i++) {
      const x = (rand() - 0.5) * SPREAD * 1.6;
      const z = (rand() - 0.5) * SPREAD * 1.6;
      const y = -rand() * H;
      const len = 1.5 + rand() * 3;
      pos.set([x, y, z, x, y - len, z], i * 6);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3));
    return g;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return geometry;
}

const CloudColumn = ({ texture, color }) => {
  const clouds = useMemo(() => {
    const rand = seeded(31);
    return Array.from({ length: CLOUDS }, () => ({
      x: (rand() - 0.5) * SPREAD * 1.8,
      y: -rand() * H,
      z: (rand() - 0.5) * SPREAD * 1.8,
      s: 4 + rand() * 6,
      r: rand() * Math.PI,
      o: 0.14 + rand() * 0.18
    }));
  }, []);
  return clouds.map((c, i) => (
    <mesh key={i} position={[c.x, c.y, c.z]} rotation={[-Math.PI / 2, 0, c.r]} scale={[c.s, c.s * 0.6, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial map={texture} color={color} transparent opacity={c.o} depthWrite={false} />
    </mesh>
  ));
};

// Looking down the fall; the pointer steers (moves the camera across X/Z,
// eased) and a tiny tremor keeps it from ever feeling still.
const FallCamera = ({ position }) => {
  const reduced = useReducedMotion();
  const offset = useRef({ x: 0, z: 0 });
  useEffect(trackPointer, []);
  useFrame((state, delta) => {
    const o = offset.current;
    easing.damp(o, 'x', reduced ? 0 : pointer.x * STEER, 0.6, delta);
    easing.damp(o, 'z', reduced ? 0 : -pointer.y * STEER, 0.6, delta);
    const t = state.clock.elapsedTime;
    const shake = reduced ? 0 : SHAKE;
    const sx = Math.sin(t * 47.3) * shake;
    const sy = Math.sin(t * 53.1 + 1.3) * shake;
    state.camera.position.set(position[0] + o.x + sx, position[1] + sy, position[2] + o.z);
    state.camera.lookAt(o.x * 0.6, -12, o.z * 0.6 - 2);
  });
  return null;
};

const FallScene = ({ camera }) => {
  const time = useFallClock();
  const texture = useCloudTexture();
  const points = useColumnPoints(POINTS, 5);
  const lines = useSpeedLines();
  const colors = useMemo(
    () => ({
      tint: readTint('fall'),
      ink: readToken('--ink'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.05} />
      <FallCamera position={camera.position} />
      <Tiled time={time} speed={SPEED}>
        <points geometry={points}>
          {/* soft round dots — bare points render as squares, very visibly up close */}
          <pointsMaterial map={texture} color={colors.ink} size={0.09} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
        </points>
      </Tiled>
      <Tiled time={time} speed={SPEED * 0.7}>
        <CloudColumn texture={texture} color={colors.ink} />
      </Tiled>
      <Tiled time={time} speed={SPEED * 1.6}>
        <lineSegments geometry={lines}>
          <lineBasicMaterial color={colors.ink} transparent opacity={0.35} depthWrite={false} />
        </lineSegments>
      </Tiled>
    </>
  );
};

export default FallScene;
