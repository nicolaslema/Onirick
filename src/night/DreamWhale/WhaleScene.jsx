import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, Vector3 } from 'three';
import { easing } from 'maath';

import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCloudTexture } from '../../three/useCloudTexture';
import { useCameraDrift } from '../../three/useCameraDrift';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';

const GRID_X = 12;
const GRID_Z = 12;
const SPACING = 2.3;
const LAP = 40; // s — the whale's route (PLAN.md 6.2)

// Rooftops, tanks, antennas and lit windows, all laid out once from a fixed
// seed so the city is the same on every visit.
function useCity() {
  return useMemo(() => {
    const rand = seeded(7);
    const buildings = [];
    const tanks = [];
    const antennas = [];
    const windows = [];
    for (let ix = 0; ix < GRID_X; ix++) {
      for (let iz = 0; iz < GRID_Z; iz++) {
        const w = 1.5 + rand() * 0.5;
        const d = 1.5 + rand() * 0.5;
        const h = 1.2 + rand() * 3.4;
        const x = (ix - (GRID_X - 1) / 2) * SPACING;
        const z = -iz * SPACING + 4;
        buildings.push({ x, z, w, d, h });
        const r = rand();
        if (r < 0.3) tanks.push({ x: x + (rand() - 0.5) * 0.6, z: z + (rand() - 0.5) * 0.6, y: h });
        else if (r < 0.5) antennas.push({ x: x + (rand() - 0.5) * 0.8, z: z + (rand() - 0.5) * 0.8, y: h, h: 0.8 + rand() * 1.2 });
        // "pocas ventanas encendidas": about one building in six, front face
        if (rand() < 0.17) windows.push({ x: x + (rand() - 0.5) * (w - 0.5), y: 0.4 + rand() * (h - 0.8), z: z + d / 2 + 0.01 });
      }
    }
    return { buildings, tanks, antennas, windows };
  }, []);
}

function useInstances(ref, items, place) {
  useLayoutEffect(() => {
    const dummy = new Object3D();
    items.forEach((item, i) => {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      place(dummy, item);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}

const City = ({ colors }) => {
  const { buildings, tanks, antennas, windows } = useCity();
  const b = useRef(null);
  const t = useRef(null);
  const a = useRef(null);
  const w = useRef(null);
  useInstances(b, buildings, (d, { x, z, w: bw, d: bd, h }) => {
    d.position.set(x, h / 2, z);
    d.scale.set(bw, h, bd);
  });
  useInstances(t, tanks, (d, { x, y, z }) => d.position.set(x, y + 0.3, z));
  useInstances(a, antennas, (d, { x, y, z, h }) => {
    d.position.set(x, y + h / 2, z);
    d.scale.set(1, h, 1);
  });
  useInstances(w, windows, (d, { x, y, z }) => d.position.set(x, y, z));
  return (
    <>
      <instancedMesh ref={b} args={[null, null, buildings.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial {...FLAT} color={colors.building} />
      </instancedMesh>
      <instancedMesh ref={t} args={[null, null, tanks.length]}>
        <cylinderGeometry args={[0.32, 0.32, 0.6, 8]} />
        <meshStandardMaterial {...FLAT} color={colors.detail} />
      </instancedMesh>
      <instancedMesh ref={a} args={[null, null, antennas.length]}>
        <boxGeometry args={[0.04, 1, 0.04]} />
        <meshStandardMaterial {...FLAT} color={colors.detail} />
      </instancedMesh>
      <instancedMesh ref={w} args={[null, null, windows.length]}>
        <planeGeometry args={[0.22, 0.32]} />
        <meshBasicMaterial color={colors.tint} />
      </instancedMesh>
    </>
  );
};

// Procedural low-poly whale (PLAN.md 6.2): a stretched icosahedron body,
// cone fins and flukes, nose toward +z so lookAt() steers it along its path.
const WhaleBody = ({ colors }) => (
  <>
    <mesh scale={[1.1, 0.85, 2.9]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshStandardMaterial {...FLAT} color={colors.whale} />
    </mesh>
    {[-1, 1].map(side => (
      <mesh key={`fin${side}`} position={[side * 1.05, -0.35, 0.6]} rotation={[0.3, 0, side * 1.2]} scale={[0.35, 1.3, 0.12]}>
        <coneGeometry args={[0.5, 1, 4]} />
        <meshStandardMaterial {...FLAT} color={colors.whale} />
      </mesh>
    ))}
    <mesh position={[0, 0.05, -3.2]} rotation-x={-Math.PI / 2} scale={[0.5, 1.2, 0.35]}>
      <coneGeometry args={[0.6, 1, 5]} />
      <meshStandardMaterial {...FLAT} color={colors.whale} />
    </mesh>
    {[-1, 1].map(side => (
      <mesh key={`fluke${side}`} position={[side * 0.7, 0.05, -3.8]} rotation={[0, side * 0.5, side * Math.PI / 2]} scale={[0.25, 1.2, 0.1]}>
        <coneGeometry args={[0.6, 1, 4]} />
        <meshStandardMaterial {...FLAT} color={colors.whale} />
      </mesh>
    ))}
    {[-1, 1].map(side => (
      <mesh key={`eye${side}`} position={[side * 0.86, 0.12, 1.7]}>
        <sphereGeometry args={[0.09, 6, 4]} />
        <meshBasicMaterial color={colors.eye} />
      </mesh>
    ))}
  </>
);

// A wide ellipse over the rooftops. A portrait screen sees only ~4 units to
// either side at that depth, so there the loop narrows and runs mostly
// toward and away from the camera instead, keeping the whale in frame.
const ROUTE = {
  landscape: { rx: 8, rz: 5, scale: 1 },
  portrait: { rx: 2.2, rz: 7, scale: 0.75 }
};

const pathPoint = (t, out, route) => {
  const a = (t / LAP) * Math.PI * 2;
  return out.set(Math.cos(a) * route.rx, 11.5 + Math.sin(a * 2) * 0.6, -6 + Math.sin(a) * route.rz);
};

const Whale = ({ colors }) => {
  const portrait = useThree(state => state.viewport.aspect < 1);
  const route = portrait ? ROUTE.portrait : ROUTE.landscape;
  const outer = useRef(null);
  const inner = useRef(null);
  const time = useRef(LAP * 0.3);
  const reduced = useReducedMotion();
  const here = useMemo(() => new Vector3(), []);
  const ahead = useMemo(() => new Vector3(), []);
  useEffect(trackPointer, []);
  useFrame((_, delta) => {
    if (!outer.current) return;
    time.current += delta * (reduced ? REDUCED_SPEED : 1);
    outer.current.position.copy(pathPoint(time.current, here, route));
    outer.current.lookAt(pathPoint(time.current + 0.5, ahead, route));
    // "it turns one eye toward you": a small yaw/roll toward the cursor
    const goal = reduced ? [0, 0, 0] : [-pointer.y * 0.12, pointer.x * 0.3, -pointer.x * 0.15];
    easing.dampE(inner.current.rotation, goal, 0.6, delta);
  });
  return (
    <group ref={outer}>
      <group ref={inner} scale={route.scale}>
        <WhaleBody colors={colors} />
      </group>
    </group>
  );
};

const CLOUDS = [
  [-9, 15, -12, 9, 0.22],
  [4, 16.5, -16, 12, 0.18],
  [11, 13.5, -8, 8, 0.2],
  [-3, 17, -20, 14, 0.16],
  [-12, 12, -18, 10, 0.18],
  [7, 14.5, -3, 7, 0.14],
  [0, 11.5, -26, 16, 0.14]
];

// Alpha planes the pointer pushes around (PLAN.md 6.2).
const Clouds = ({ color }) => {
  const ref = useRef(null);
  const texture = useCloudTexture();
  const reduced = useReducedMotion();
  useFrame((_, delta) => {
    if (!ref.current) return;
    const goal = reduced ? [0, 0, 0] : [pointer.x * 2, pointer.y * 0.8, 0];
    easing.damp3(ref.current.position, goal, 0.9, delta);
  });
  return (
    <group ref={ref}>
      {CLOUDS.map(([x, y, z, s, opacity]) => (
        <mesh key={`${x}${z}`} position={[x, y, z]} scale={[s, s * 0.45, 1]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={texture} color={color} transparent opacity={opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

const WhaleScene = ({ camera }) => {
  // Looking up steeply: the rooftops stay in the bottom strip, below the
  // title, since distant roofs take the fog's tint (= the title's color).
  useCameraDrift({ position: camera.position, target: [0, 12, -6] });
  const colors = useMemo(
    () => ({
      tint: readTint('whale'),
      building: readToken('--line-strong'),
      detail: readToken('--line'),
      whale: readToken('--ink-muted'),
      eye: readToken('--surface'),
      cloud: readToken('--ink'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.05} />
      <hemisphereLight args={[colors.tint, colors.surface, 0.4]} />
      <directionalLight position={[-6, 14, 6]} intensity={2} color={colors.tint} />
      <City colors={colors} />
      <Whale colors={colors} />
      <Clouds color={colors.cloud} />
    </>
  );
};

export default WhaleScene;
