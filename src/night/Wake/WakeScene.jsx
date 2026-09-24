import { useMemo } from 'react';

import Atmosphere from '../../three/Atmosphere';
import DR1 from '../../three/DR1';
import { FLAT, readToken } from '../../three/materials';
import { useCameraDrift } from '../../three/useCameraDrift';

const TARGET = [0, 0.05, 0];

const DEVICE_Y = -0.75;
const TABLE_TOP = DEVICE_Y - 0.48; // DR-1 is 0.96 tall

// Low-poly nightstand: a slab and four legs, dark so the dawn light reads on
// its top edge.
const Nightstand = ({ color }) => (
  <group position={[0, TABLE_TOP, 0]}>
    <mesh position={[0, -0.05, 0]}>
      <boxGeometry args={[3.4, 0.1, 1.8]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </mesh>
    {[
      [-1.55, -0.75],
      [1.55, -0.75],
      [-1.55, 0.75],
      [1.55, 0.75]
    ].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x, -1.1, z]}>
        <boxGeometry args={[0.12, 2, 0.12]} />
        <meshStandardMaterial {...FLAT} color={color} />
      </mesh>
    ))}
  </group>
);

// PLAN.md 6.7: the same DR-1, stopped, its tape ejected, on a nightstand in
// low warm light from the left (dawn). Centered, below the copy.
const WakeScene = ({ camera }) => {
  useCameraDrift({ position: camera.position, target: TARGET });
  const colors = useMemo(
    () => ({
      dawn: readToken('--dream-stair'),
      ink: readToken('--ink'),
      surface: readToken('--surface'),
      table: readToken('--line')
    }),
    []
  );
  return (
    <>
      <Atmosphere density={0.06} />
      <hemisphereLight args={[colors.ink, colors.surface, 0.2]} />
      <directionalLight position={[-4, 0.4, 2]} intensity={2.4} color={colors.dawn} />
      <Nightstand color={colors.table} />
      <DR1 recording={false} ejected tapeLabel="Tape 05" position={[0, DEVICE_Y, 0]} rotation={[0, -0.25, 0]} />
    </>
  );
};

export default WakeScene;
