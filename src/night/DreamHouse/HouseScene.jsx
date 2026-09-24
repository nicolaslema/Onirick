import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, Color, Object3D, Vector3 } from 'three';

import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { useCameraDrift } from '../../three/useCameraDrift';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';

// Hallway along -z. One "bay" per door pair; the bays scroll toward the
// camera and wrap every BAY, so the hallway never ends while the kitchen
// doorway at the far wall stays at a fixed distance (PLAN.md 6.3).
const HALF_W = 1.2;
const FLOOR = -1.3;
const CEIL = 1.3;
const BAY = 2.4;
const DOOR_W = 0.86; // a touch narrower than its opening: light leaks round the edges
const OPENING = 0.9;
const DOOR_H = 2;
const BAYS = 11;
const FIRST_Z = 3.6; // first bay starts behind the camera
const END_Z = -21;
const CREEP = 0.14; // units/s — "la cámara avanza muy lento"
const AJAR = 0.55; // rad, fully ajar
const DOOR_COUNT = BAYS * 2;

// Door i: bay i >> 1, left (even) or right (odd) wall. Hinge on the far edge.
const doorSide = i => (i % 2 === 0 ? -1 : 1);
const doorCenterZ = i => FIRST_Z - (i >> 1) * BAY - BAY / 2;
const hingeZ = i => doorCenterZ(i) - OPENING / 2;

function useStatic(ref, count, place) {
  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < count; i++) {
      dummy.position.set(0, 0, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      place(dummy, i);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);
}

// Walls between openings, the lintel over each door, the glow behind each
// door, and the spill of light on the floor in front of it.
const Bays = ({ colors }) => {
  const walls = useRef(null);
  const lintels = useRef(null);
  const glows = useRef(null);
  const spills = useRef(null);
  const wallLen = BAY - OPENING;
  useStatic(walls, DOOR_COUNT, (d, i) => {
    d.position.set(doorSide(i) * HALF_W, (FLOOR + CEIL) / 2, doorCenterZ(i) + OPENING / 2 + wallLen / 2);
  });
  useStatic(lintels, DOOR_COUNT, (d, i) => {
    d.position.set(doorSide(i) * HALF_W, (FLOOR + DOOR_H + CEIL) / 2, doorCenterZ(i));
  });
  useStatic(glows, DOOR_COUNT, (d, i) => {
    d.position.set(doorSide(i) * (HALF_W + 0.07), FLOOR + DOOR_H / 2, doorCenterZ(i));
    d.rotation.set(0, doorSide(i) * -Math.PI / 2, 0);
  });
  useStatic(spills, DOOR_COUNT, (d, i) => {
    d.position.set(doorSide(i) * (HALF_W - 0.12), FLOOR + 0.005, doorCenterZ(i));
    d.rotation.set(-Math.PI / 2, 0, 0);
  });
  return (
    <>
      <instancedMesh ref={walls} args={[null, null, DOOR_COUNT]}>
        <boxGeometry args={[0.05, CEIL - FLOOR, wallLen]} />
        <meshStandardMaterial {...FLAT} color={colors.wall} />
      </instancedMesh>
      <instancedMesh ref={lintels} args={[null, null, DOOR_COUNT]}>
        <boxGeometry args={[0.05, CEIL - FLOOR - DOOR_H, OPENING]} />
        <meshStandardMaterial {...FLAT} color={colors.wall} />
      </instancedMesh>
      <instancedMesh ref={glows} args={[null, null, DOOR_COUNT]}>
        <planeGeometry args={[OPENING, DOOR_H]} />
        <meshBasicMaterial color={colors.tint} />
      </instancedMesh>
      <instancedMesh ref={spills} args={[null, null, DOOR_COUNT]}>
        <planeGeometry args={[0.24, DOOR_W]} />
        <meshBasicMaterial color={colors.tint} transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
    </>
  );
};

// Door leaves. Each swings into its room (away from the hallway) as the
// pointer nears it on screen, eased per door.
const Doors = ({ colors, offset }) => {
  const ref = useRef(null);
  const angles = useRef(new Float32Array(DOOR_COUNT));
  const dummy = useMemo(() => new Object3D(), []);
  const probe = useMemo(() => new Vector3(), []);
  // Pivot at the hinge: the leaf extends from it toward the camera (+z).
  const leaf = useMemo(() => new BoxGeometry(0.05, DOOR_H, DOOR_W).translate(0, 0, DOOR_W / 2 + 0.02), []);
  useEffect(() => () => leaf.dispose(), [leaf]);
  const reduced = useReducedMotion();
  useEffect(trackPointer, []);
  useFrame(({ camera }, delta) => {
    if (!ref.current) return;
    const k = 1 - Math.exp(-delta / 0.25);
    for (let i = 0; i < DOOR_COUNT; i++) {
      const side = doorSide(i);
      probe.set(side * HALF_W, FLOOR + DOOR_H / 2, doorCenterZ(i) + offset.current).project(camera);
      const near = probe.z < 1 ? Math.hypot(probe.x - pointer.x, probe.y - pointer.y) : 9;
      const goal = reduced ? 0 : AJAR * Math.max(0, Math.min(1, (0.45 - near) / 0.3));
      angles.current[i] += (goal - angles.current[i]) * k;
      dummy.position.set(side * HALF_W, FLOOR + DOOR_H / 2, hingeZ(i));
      // Left wall swings toward -x, right toward +x: into the room.
      dummy.rotation.set(0, side * angles.current[i], 0);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[leaf, null, DOOR_COUNT]}>
      <meshStandardMaterial {...FLAT} color={colors.door} />
    </instancedMesh>
  );
};

const Hallway = ({ colors }) => {
  const group = useRef(null);
  const offset = useRef(0);
  const time = useRef(0);
  const reduced = useReducedMotion();
  useFrame((_, delta) => {
    time.current += delta * (reduced ? REDUCED_SPEED : 1);
    offset.current = (time.current * CREEP) % BAY;
    if (group.current) group.current.position.z = offset.current;
  });
  return (
    <group ref={group}>
      <Bays colors={colors} />
      <Doors colors={colors} offset={offset} />
    </group>
  );
};

const KITCHEN_W = 1;
const KITCHEN_H = 2.1;
const SIDE_W = HALF_W - KITCHEN_W / 2 + 0.05; // far wall on either side of the doorway

// "Every door opens onto the same kitchen": a lit doorway in the far wall,
// fixed relative to the camera while the hallway creeps past.
const Kitchen = ({ colors }) => (
  <group position={[0, 0, END_Z]}>
    {[-1, 1].map(side => (
      <mesh key={side} position={[side * (KITCHEN_W / 2 + SIDE_W / 2), (FLOOR + CEIL) / 2, 0]}>
        <boxGeometry args={[SIDE_W, CEIL - FLOOR, 0.05]} />
        <meshStandardMaterial {...FLAT} color={colors.wall} />
      </mesh>
    ))}
    <mesh position={[0, (FLOOR + KITCHEN_H + CEIL) / 2, 0]}>
      <boxGeometry args={[KITCHEN_W, CEIL - FLOOR - KITCHEN_H, 0.05]} />
      <meshStandardMaterial {...FLAT} color={colors.wall} />
    </mesh>
    <mesh position={[0, 0, -1.4]}>
      <planeGeometry args={[3, 3]} />
      <meshBasicMaterial color={colors.kitchen} fog={false} />
    </mesh>
  </group>
);

const HouseScene = ({ camera }) => {
  // On a portrait screen the title block runs taller, and at eye level the
  // lit kitchen doorway lands right behind its tape label; looking a little
  // lower lifts the doorway above the copy.
  const portrait = useThree(state => state.viewport.aspect < 1);
  useCameraDrift({ position: camera.position, target: [0, portrait ? -2.4 : 0, -10], pivot: 'camera' });
  const colors = useMemo(() => {
    const tint = readTint('house');
    return {
      tint,
      wall: readToken('--line-strong'),
      door: readToken('--line'),
      floor: readToken('--line'),
      kitchen: `#${new Color(readToken('--ink')).lerp(new Color(tint), 0.35).getHexString()}`,
      surface: readToken('--surface')
    };
  }, []);
  const length = FIRST_Z - END_Z + 2;
  const midZ = (FIRST_Z + END_Z) / 2;
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.075} />
      <hemisphereLight args={[colors.tint, colors.surface, 0.3]} />
      <directionalLight position={[0, 1, END_Z + 2]} intensity={1.6} color={colors.tint} />
      <mesh position={[0, FLOOR - 0.05, midZ]}>
        <boxGeometry args={[HALF_W * 2 + 0.2, 0.1, length]} />
        <meshStandardMaterial {...FLAT} color={colors.floor} />
      </mesh>
      <mesh position={[0, CEIL + 0.05, midZ]}>
        <boxGeometry args={[HALF_W * 2 + 0.2, 0.1, length]} />
        <meshStandardMaterial {...FLAT} color={colors.wall} />
      </mesh>
      <Hallway colors={colors} />
      <Kitchen colors={colors} />
    </>
  );
};

export default HouseScene;
