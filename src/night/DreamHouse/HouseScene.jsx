import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { BoxGeometry, Color, Object3D, Vector3 } from 'three';

import { markTouched, subscribeAction } from '../../night/play';
import { keep } from '../../night/recording';
import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken } from '../../three/materials';
import { onTap, pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCameraDrift } from '../../three/useCameraDrift';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';
import { useLive } from '../stage';

// Dream 03, The House You Grew Up In (PLAN-2.md 6.3). A hallway that never
// ends. Open a door and someone steps out — every door opens onto the same
// kitchen, and someone is always just leaving it. Some walk toward the
// kitchen at the far end and are lost in its light; some come toward you and
// pass without looking. Doors open on their own too: life goes on. Reach for
// the kitchen and the hallway stretches.

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
const BAYS = 14; // enough to cover the kitchen stretched all the way back
const FIRST_Z = 3.6; // first bay starts behind the camera
const END_Z = -21;
const CREEP = 0.14; // units/s — "la cámara avanza muy lento"
const AJAR = 0.55; // rad, ajar under the pointer
const OPEN = 1.35; // rad, opened by a click
const DOOR_COUNT = BAYS * 2;

// Door i: bay i >> 1, left (even) or right (odd) wall. Hinge on the far edge.
const doorSide = i => (i % 2 === 0 ? -1 : 1);
const doorCenterZ = i => FIRST_Z - (i >> 1) * BAY - BAY / 2;
const hingeZ = i => doorCenterZ(i) - OPENING / 2;

// Timing (PLAN-2.md 6.3).
const DOOR_OPEN_S = 6; // an opened door closes by itself after this long
const STEP_OUT_DELAY = 0.4; // after the door swings, someone steps out
const EMERGE = 0.6; // from inside the room to the threshold
const TURN = 0.4; // from the threshold into a lane
const LANE_X = 0.35;
const SPONTANEOUS = [7, 12]; // s between doors opening on their own
const TO_KITCHEN = 0.6; // share of shadows walking away, toward the kitchen
const POOL = 10;
const KITCHEN_FADE = [3, 2.2]; // start fading this far before the kitchen, over this distance
const CAMERA_FADE = [1.2, 1.2]; // fade once past this z, over this distance
const TAP_RADIUS = 0.15; // NDC — how close to a door a tap has to land

// The kitchen when reached for: back STRETCH units in STRETCH_OUT s, then
// home again over STRETCH_BACK s.
const STRETCH = 6;
const STRETCH_OUT = 0.8;
const STRETCH_BACK = 6;
const KITCHEN_W = 1;
const KITCHEN_H = 2.1;

const easeOut = t => 1 - (1 - t) ** 2;
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = t => Math.min(Math.max(t, 0), 1);

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
// door, and the spill of light on the floor in front of it — which reaches
// further into the hallway as its door opens.
const Bays = ({ house, colors }) => {
  const walls = useRef(null);
  const lintels = useRef(null);
  const glows = useRef(null);
  const spills = useRef(null);
  const dummy = useMemo(() => new Object3D(), []);
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
  useFrame(() => {
    const { angles } = house.current;
    for (let i = 0; i < DOOR_COUNT; i++) {
      const open = clamp01((angles[i] - AJAR) / (OPEN - AJAR));
      const reach = 1 + 3 * open;
      dummy.position.set(doorSide(i) * (HALF_W - 0.12 * reach), FLOOR + 0.005, doorCenterZ(i));
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(reach, 1, 1);
      dummy.updateMatrix();
      spills.current.setMatrixAt(i, dummy.matrix);
    }
    spills.current.instanceMatrix.needsUpdate = true;
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

// Door leaves. Each swings into its room (away from the hallway): ajar as
// the pointer nears it, wide open when clicked (house.angles, eased in the
// scene's own frame loop).
const Doors = ({ house, colors }) => {
  const ref = useRef(null);
  const dummy = useMemo(() => new Object3D(), []);
  // Pivot at the hinge: the leaf extends from it toward the camera (+z).
  const leaf = useMemo(() => new BoxGeometry(0.05, DOOR_H, DOOR_W).translate(0, 0, DOOR_W / 2 + 0.02), []);
  useEffect(() => () => leaf.dispose(), [leaf]);
  useFrame(() => {
    if (!ref.current) return;
    const { angles } = house.current;
    for (let i = 0; i < DOOR_COUNT; i++) {
      const side = doorSide(i);
      dummy.position.set(side * HALF_W, FLOOR + DOOR_H / 2, hingeZ(i));
      // Left wall swings toward -x, right toward +x: into the room.
      dummy.rotation.set(0, side * angles[i], 0);
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

const Hallway = ({ house, colors }) => {
  const group = useRef(null);
  useFrame(() => {
    if (group.current) group.current.position.z = house.current.offset;
  });
  return (
    <group ref={group}>
      <Bays house={house} colors={colors} />
      <Doors house={house} colors={colors} />
    </group>
  );
};

const SIDE_W = HALF_W - KITCHEN_W / 2 + 0.05; // far wall on either side of the doorway

// "Every door opens onto the same kitchen": a lit doorway in the far wall,
// fixed relative to the camera while the hallway creeps past — until you
// reach for it, and it draws back (under reduced motion it dims instead).
const Kitchen = ({ house, colors }) => {
  const group = useRef(null);
  const light = useRef(null);
  const reduced = useReducedMotion();
  useFrame(() => {
    const { stretch } = house.current;
    if (group.current) group.current.position.z = END_Z - (reduced ? 0 : stretch);
    if (light.current) light.current.opacity = reduced ? 1 - 0.6 * (stretch / STRETCH) : 1;
  });
  return (
    <group ref={group} position={[0, 0, END_Z]}>
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
        <meshBasicMaterial ref={light} color={colors.kitchen} fog={false} transparent />
      </mesh>
    </group>
  );
};

// The people who come out of the doors: dark silhouettes (a body and a
// head), never facing you. Drawn from the shared pool in house.shadows.
const Shadows = ({ house, colors }) => {
  const groups = useRef([]);
  const materials = useRef([]);
  const dark = useMemo(() => new Color(colors.silhouette), [colors.silhouette]);
  const glow = useMemo(() => new Color(colors.kitchen), [colors.kitchen]);
  useFrame(() => {
    house.current.shadows.forEach((s, i) => {
      const g = groups.current[i];
      if (!g) return;
      g.visible = s.phase !== 'free' && s.phase !== 'waiting';
      if (!g.visible) return;
      const bob = s.phase === 'walking' ? 0.02 * Math.abs(Math.sin(Math.PI * 2 * 2 * s.t)) : 0;
      g.position.set(s.x, FLOOR + bob, s.z);
      g.rotation.y = s.facing;
      g.scale.set(1, 1 + 0.15 * s.lost, 1);
      materials.current[i * 2].color.copy(dark).lerp(glow, s.lost);
      materials.current[i * 2 + 1].color.copy(dark).lerp(glow, s.lost);
      materials.current[i * 2].opacity = s.opacity;
      materials.current[i * 2 + 1].opacity = s.opacity;
    });
  });
  const material = k => (
    <meshBasicMaterial
      ref={m => {
        materials.current[k] = m;
      }}
      color={colors.silhouette}
      transparent
      depthWrite={false}
    />
  );
  return Array.from({ length: POOL }, (_, i) => (
    <group
      key={i}
      ref={g => {
        groups.current[i] = g;
      }}
      visible={false}
    >
      <mesh position={[0, 0.72, 0]}>
        <capsuleGeometry args={[0.17, 0.95, 3, 8]} />
        {material(i * 2)}
      </mesh>
      <mesh position={[0, 1.48, 0]}>
        <icosahedronGeometry args={[0.14, 1]} />
        {material(i * 2 + 1)}
      </mesh>
    </group>
  ));
};

const freeShadow = () => ({ phase: 'free', owned: false, side: 1, dir: -1, lane: 0, speed: 0.7, t: 0, x: 0, z: 0, facing: 0, lost: 0, opacity: 1 });

// The hallway's life: its creep, the doors, the kitchen's stretch and the
// pool of shadows — one frame loop, one shared ref, no React re-renders.
function useHouse(live) {
  const reduced = useReducedMotion();
  const camera = useThree(state => state.camera);
  const house = useRef({
    clock: 0,
    time: 0,
    offset: 0,
    angles: new Float32Array(DOOR_COUNT),
    openUntil: new Float32Array(DOOR_COUNT),
    stretch: 0,
    stretchT: -1,
    shadows: Array.from({ length: POOL }, freeShadow),
    nextOnItsOwn: 4
  });
  const rand = useMemo(() => seeded(19), []);
  const probe = useMemo(() => new Vector3(), []);

  const doorWorldZ = i => doorCenterZ(i) + house.current.offset;

  // A door swings open and, a moment later, someone steps out of it.
  const openDoor = useCallback(
    (i, { owned, dir }) => {
      const h = house.current;
      h.openUntil[i] = h.clock + DOOR_OPEN_S;
      const s = h.shadows.find(sh => sh.phase === 'free');
      if (!s) return;
      const side = doorSide(i);
      // Kitchen-bound walk one lane, the others the other — with some mixing,
      // so it doesn't read as traffic.
      const usual = dir < 0 ? -LANE_X : LANE_X;
      Object.assign(s, freeShadow(), {
        phase: 'waiting',
        owned,
        side,
        dir,
        lane: rand() < 0.7 ? usual : -usual,
        speed: 0.6 + rand() * 0.3,
        t: -STEP_OUT_DELAY,
        x: side * (HALF_W + 0.7),
        z: doorWorldZ(i),
        facing: side < 0 ? Math.PI / 2 : -Math.PI / 2
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const nearestDoor = useCallback(
    (ndc, radius) => {
      let best = -1;
      let bestD = radius;
      for (let i = 0; i < DOOR_COUNT; i++) {
        probe.set(doorSide(i) * HALF_W, FLOOR + DOOR_H / 2, doorWorldZ(i)).project(camera);
        if (probe.z >= 1) continue;
        const d = Math.hypot(probe.x - ndc.x, probe.y - ndc.y);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return best;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [camera, probe]
  );

  // Is this tap on the kitchen doorway (as it's drawn right now)?
  const onKitchen = useCallback(
    ndc => {
      const z = END_Z - (reduced ? 0 : house.current.stretch);
      const corners = [
        [-KITCHEN_W / 2, FLOOR],
        [KITCHEN_W / 2, FLOOR + KITCHEN_H]
      ].map(([x, y]) => probe.set(x, y, z).project(camera).clone());
      return ndc.x > corners[0].x && ndc.x < corners[1].x && ndc.y > corners[0].y && ndc.y < corners[1].y;
    },
    [camera, probe, reduced]
  );

  useEffect(() => {
    if (!live) return undefined;
    trackPointer();
    const offTap = onTap(ndc => {
      const h = house.current;
      if (onKitchen(ndc)) {
        markTouched('house');
        if (h.stretchT < 0) h.stretchT = 0;
        return;
      }
      const i = nearestDoor(ndc, TAP_RADIUS);
      if (i < 0 || h.openUntil[i] > h.clock) return;
      markTouched('house');
      openDoor(i, { owned: true, dir: rand() < TO_KITCHEN ? -1 : 1 });
    });
    // "Open a door" from the keyboard: the closed door nearest a few steps
    // ahead, and whoever comes out walks to the kitchen.
    const offAction = subscribeAction(id => {
      if (id !== 'house') return;
      const h = house.current;
      let best = -1;
      for (let i = 0; i < DOOR_COUNT; i++) {
        if (h.openUntil[i] > h.clock) continue;
        if (best < 0 || Math.abs(doorWorldZ(i) + 4.5) < Math.abs(doorWorldZ(best) + 4.5)) best = i;
      }
      if (best >= 0) openDoor(best, { owned: true, dir: -1 });
    });
    return () => {
      offTap();
      offAction();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live, openDoor, nearestDoor, onKitchen]);

  useFrame(({ camera: cam }, delta) => {
    const h = house.current;
    const dt = Math.min(delta, 0.1);
    const pace = reduced ? REDUCED_SPEED : 1;
    h.clock += dt;
    h.time += dt * pace;
    const offset = (h.time * CREEP) % BAY;
    // The hallway just wrapped back a bay: the door that was here is now
    // two indices closer — carry the doors' state along so none of them jumps.
    if (offset < h.offset) {
      h.angles.copyWithin(0, 2);
      h.openUntil.copyWithin(0, 2);
      h.angles.fill(0, DOOR_COUNT - 2);
      h.openUntil.fill(0, DOOR_COUNT - 2);
    }
    h.offset = offset;

    // The kitchen's stretch: out fast, home slowly.
    if (h.stretchT >= 0) {
      h.stretchT += dt;
      const t = h.stretchT;
      if (t < STRETCH_OUT) h.stretch = STRETCH * easeOut(t / STRETCH_OUT);
      else if (t < STRETCH_OUT + STRETCH_BACK) h.stretch = STRETCH * (1 - easeInOut((t - STRETCH_OUT) / STRETCH_BACK));
      else {
        h.stretch = 0;
        h.stretchT = -1;
      }
    }

    // Life goes on without you: a far door opens by itself now and then.
    if (h.clock >= h.nextOnItsOwn) {
      h.nextOnItsOwn = h.clock + SPONTANEOUS[0] + rand() * (SPONTANEOUS[1] - SPONTANEOUS[0]);
      const far = [];
      for (let i = 0; i < DOOR_COUNT; i++) {
        const z = doorWorldZ(i);
        if (z < -7 && z > -16 && h.openUntil[i] <= h.clock) far.push(i);
      }
      if (far.length) openDoor(far[Math.floor(rand() * far.length)], { owned: false, dir: rand() < TO_KITCHEN ? -1 : 1 });
    }

    // Doors: wide open while clicked, else ajar under the pointer.
    const k = 1 - Math.exp(-dt / 0.25);
    for (let i = 0; i < DOOR_COUNT; i++) {
      let goal = 0;
      if (h.openUntil[i] > h.clock) goal = OPEN;
      else if (!reduced && live) {
        probe.set(doorSide(i) * HALF_W, FLOOR + DOOR_H / 2, doorWorldZ(i)).project(cam);
        const near = probe.z < 1 ? Math.hypot(probe.x - pointer.x, probe.y - pointer.y) : 9;
        goal = AJAR * clamp01((0.45 - near) / 0.3);
      }
      h.angles[i] += (goal - h.angles[i]) * k;
    }

    // The shadows.
    const kitchenZ = END_Z - (reduced ? 0 : h.stretch);
    h.shadows.forEach(s => {
      if (s.phase === 'free') return;
      s.t += dt * pace;
      // The floor carries everyone toward the camera, like the hallway.
      s.z += CREEP * pace * dt;
      if (s.phase === 'waiting') {
        if (s.t >= 0) {
          s.phase = 'emerging';
          s.t = 0;
        }
        return;
      }
      if (s.phase === 'emerging') {
        const u = clamp01(s.t / EMERGE);
        s.x = s.side * (HALF_W + 0.7 - (0.95 * u));
        s.opacity = u;
        if (u >= 1) {
          s.phase = 'turning';
          s.t = 0;
        }
        return;
      }
      if (s.phase === 'turning') {
        const u = easeInOut(clamp01(s.t / TURN));
        s.x = s.side * (HALF_W - 0.25) + (s.lane - s.side * (HALF_W - 0.25)) * u;
        const along = s.dir < 0 ? Math.PI : 0;
        const out = s.side < 0 ? Math.PI / 2 : -Math.PI / 2;
        s.facing = out + (along - out) * u;
        if (u >= 1) {
          s.phase = 'walking';
          s.t = 0;
          s.facing = along;
        }
        return;
      }
      // walking
      s.z += s.dir * s.speed * pace * dt;
      if (s.dir < 0) {
        // Lost in the kitchen's light.
        s.lost = clamp01((kitchenZ + KITCHEN_FADE[0] - s.z) / KITCHEN_FADE[1]);
        s.opacity = 1 - s.lost;
        if (s.lost >= 1) {
          if (s.owned) keep('house');
          Object.assign(s, freeShadow());
        }
      } else {
        // Past you, never looking.
        s.opacity = 1 - clamp01((s.z - CAMERA_FADE[0]) / CAMERA_FADE[1]);
        if (s.opacity <= 0) Object.assign(s, freeShadow());
      }
    });
  });

  return house;
}

const HouseScene = ({ camera }) => {
  // Listening to the visitor only while this dream is on screen and settled.
  const live = useLive('house');
  // On a portrait screen the title block runs taller, and at eye level the
  // lit kitchen doorway lands right behind its tape label; looking a little
  // lower lifts the doorway above the copy.
  const portrait = useThree(state => state.viewport.aspect < 1);
  useCameraDrift({ position: camera.position, target: [0, portrait ? -2.4 : 0, -10], pivot: 'camera' });
  const house = useHouse(live);
  const colors = useMemo(() => {
    const tint = readTint('house');
    return {
      tint,
      wall: readToken('--line-strong'),
      door: readToken('--line'),
      floor: readToken('--line'),
      kitchen: `#${new Color(readToken('--ink')).lerp(new Color(tint), 0.35).getHexString()}`,
      silhouette: readToken('--surface'),
      surface: readToken('--surface')
    };
  }, []);
  const back = END_Z - STRETCH;
  const length = FIRST_Z - back + 2;
  const midZ = (FIRST_Z + back) / 2;
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
      <Hallway house={house} colors={colors} />
      <Kitchen house={house} colors={colors} />
      <Shadows house={house} colors={colors} />
    </>
  );
};

export default HouseScene;
