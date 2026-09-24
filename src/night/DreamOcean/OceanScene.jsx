import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, CanvasTexture, Plane, PlaneGeometry, Raycaster, RepeatWrapping, Vector2, Vector3 } from 'three';

import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCameraDrift } from '../../three/useCameraDrift';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';

// A room (inverted box) slowly filling and draining (PLAN.md 6.5).
const ROOM_W = 8;
const ROOM_D = 9;
const FLOOR = -1.5;
const CEIL = 2.5;
const LOW = FLOOR + 0.3;
const HIGH = FLOOR + 2; // stays under the camera and the window
const RISE = 12; // s up, 12 s back down

// Water surface: a height field the pointer disturbs (discrete wave
// equation on the grid, stepped at a fixed 60 Hz).
const SEGMENTS = 56;
const SIDE = SEGMENTS + 1;
const DAMPING = 0.985;
const RIPPLE_AMP = 0.14;
const STEP = 1 / 60;

const waterLevel = t => LOW + (HIGH - LOW) * (0.5 - 0.5 * Math.cos((Math.PI * t) / RISE));
const swell = (x, z, t) => 0.06 * Math.sin(x * 1.3 + t * 1.1) + 0.05 * Math.sin(z * 1.7 - t * 0.9);

function useClock() {
  const t = useRef(0);
  const reduced = useReducedMotion();
  useFrame((_, delta) => {
    t.current += delta * (reduced ? REDUCED_SPEED : 1);
  });
  return t;
}

const Water = ({ time, color }) => {
  const geometry = useMemo(() => new PlaneGeometry(ROOM_W, ROOM_D, SEGMENTS, SEGMENTS).rotateX(-Math.PI / 2), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mesh = useRef(null);
  // Per-frame mutable state: the two wave buffers plus scratch objects.
  const sim = useRef({
    cur: new Float32Array(SIDE * SIDE),
    prev: new Float32Array(SIDE * SIDE),
    acc: 0,
    last: null,
    ray: new Raycaster(),
    plane: new Plane(new Vector3(0, 1, 0), 0),
    hit: new Vector3(),
    ndc: new Vector2()
  });
  const reduced = useReducedMotion();
  useEffect(trackPointer, []);

  useFrame(({ camera }, delta) => {
    const s = sim.current;
    const { ray, plane, hit, ndc } = s;
    const t = time.current;
    const level = waterLevel(t);

    // Where the pointer's ray meets the water: a moving pointer drops a
    // small disturbance there.
    if (!reduced) {
      plane.constant = -level;
      ray.setFromCamera(ndc.set(pointer.x, pointer.y), camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        const gx = Math.round(((hit.x + ROOM_W / 2) / ROOM_W) * SEGMENTS);
        const gz = Math.round(((hit.z + ROOM_D / 2) / ROOM_D) * SEGMENTS);
        const moved = !s.last || Math.hypot(pointer.x - s.last.x, pointer.y - s.last.y) > 0.004;
        if (moved && gx > 1 && gx < SEGMENTS - 1 && gz > 1 && gz < SEGMENTS - 1) s.cur[gz * SIDE + gx] -= 0.9;
        s.last = { x: pointer.x, y: pointer.y };
      }
    }

    s.acc += Math.min(delta, 0.1);
    while (s.acc >= STEP) {
      s.acc -= STEP;
      const { cur, prev } = s;
      for (let z = 1; z < SEGMENTS; z++) {
        for (let x = 1; x < SEGMENTS; x++) {
          const i = z * SIDE + x;
          prev[i] = ((cur[i - 1] + cur[i + 1] + cur[i - SIDE] + cur[i + SIDE]) / 2 - prev[i]) * DAMPING;
        }
      }
      s.cur = prev;
      s.prev = cur;
    }

    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, level + swell(pos.getX(i), pos.getZ(i), t) + s.cur[i] * RIPPLE_AMP);
    }
    pos.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geometry}>
      <meshStandardMaterial {...FLAT} color={color} transparent opacity={0.9} />
    </mesh>
  );
};

// Faint caustics: a light web texture on a band hugging the waterline of
// each wall, drifting slowly.
function useCausticTexture() {
  const texture = useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const rand = seeded(11);
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let k = 0; k < 70; k++) {
      const x = rand() * size;
      const y = rand() * size;
      const r = 10 + rand() * 26;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.4 + rand() * 0.5), rand() * Math.PI, 0, Math.PI * 2);
      ctx.stroke();
    }
    const tex = new CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(7, 2);
    return tex;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const Caustics = ({ time, color }) => {
  const texture = useCausticTexture();
  const group = useRef(null);
  useFrame(() => {
    texture.offset.set(time.current * 0.02, time.current * 0.013);
    if (group.current) group.current.position.y = waterLevel(time.current) + 0.6;
  });
  const walls = [
    { position: [0, 0, -ROOM_D / 2 + 0.01], rotation: [0, 0, 0], width: ROOM_W },
    { position: [-ROOM_W / 2 + 0.01, 0, 0], rotation: [0, Math.PI / 2, 0], width: ROOM_D },
    { position: [ROOM_W / 2 - 0.01, 0, 0], rotation: [0, -Math.PI / 2, 0], width: ROOM_D }
  ];
  return (
    <group ref={group}>
      {walls.map(w => (
        <mesh key={w.position.join()} position={w.position} rotation={w.rotation}>
          <planeGeometry args={[w.width, 1.2]} />
          <meshBasicMaterial map={texture} color={color} transparent opacity={0.06} blending={AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
};

// Chair, lamp and book. Each rests on the floor until the water reaches it,
// then rides the surface with a slow rock ("floats up politely").
const FURNITURE = [
  { kind: 'chair', x: -1.6, z: -1.8, rest: 0.45, draft: 0.2, phase: 0 },
  { kind: 'lamp', x: 2, z: -2.6, rest: 0.6, draft: 0.45, phase: 1.7 },
  { kind: 'book', x: 0.6, z: -0.6, rest: 0.03, draft: 0.01, phase: 3.1 }
];

const Chair = ({ color }) => (
  <>
    <mesh>
      <boxGeometry args={[0.7, 0.08, 0.7]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </mesh>
    <mesh position={[0, 0.4, -0.31]}>
      <boxGeometry args={[0.7, 0.8, 0.08]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </mesh>
    {[
      [-0.3, -0.3],
      [0.3, -0.3],
      [-0.3, 0.3],
      [0.3, 0.3]
    ].map(([x, z]) => (
      <mesh key={`${x}${z}`} position={[x, -0.22, z]}>
        <boxGeometry args={[0.06, 0.45, 0.06]} />
        <meshStandardMaterial {...FLAT} color={color} />
      </mesh>
    ))}
  </>
);

const Lamp = ({ color, shade }) => (
  <>
    <mesh position={[0, -0.55, 0]}>
      <cylinderGeometry args={[0.2, 0.24, 0.08, 8]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </mesh>
    <mesh>
      <cylinderGeometry args={[0.025, 0.025, 1.1, 5]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </mesh>
    <mesh position={[0, 0.55, 0]}>
      <cylinderGeometry args={[0.16, 0.34, 0.36, 8, 1, true]} />
      <meshStandardMaterial {...FLAT} color={shade} side={BackSide} />
    </mesh>
    <mesh position={[0, 0.55, 0]}>
      <cylinderGeometry args={[0.16, 0.34, 0.36, 8, 1, true]} />
      <meshStandardMaterial {...FLAT} color={shade} />
    </mesh>
  </>
);

const Book = ({ color, pages }) => (
  <>
    <mesh>
      <boxGeometry args={[0.42, 0.06, 0.3]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </mesh>
    <mesh position={[0.012, 0, 0]}>
      <boxGeometry args={[0.4, 0.045, 0.285]} />
      <meshStandardMaterial {...FLAT} color={pages} />
    </mesh>
  </>
);

const Floating = ({ item, time, colors }) => {
  const ref = useRef(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = time.current;
    const onFloor = FLOOR + item.rest;
    const afloat = waterLevel(t) + swell(item.x, item.z, t) - item.draft + item.rest;
    const lift = Math.min(1, Math.max(0, (afloat - onFloor) / 0.25));
    ref.current.position.set(item.x + Math.sin(t * 0.13 + item.phase) * 0.25 * lift, Math.max(onFloor, afloat), item.z);
    ref.current.rotation.set(Math.sin(t * 0.7 + item.phase) * 0.08 * lift, item.phase + t * 0.03 * lift, Math.cos(t * 0.6 + item.phase) * 0.07 * lift);
  });
  return (
    <group ref={ref}>
      {item.kind === 'chair' && <Chair color={colors.furniture} />}
      {item.kind === 'lamp' && <Lamp color={colors.furniture} shade={colors.shade} />}
      {item.kind === 'book' && <Book color={colors.book} pages={colors.shade} />}
    </group>
  );
};

const Room = ({ colors }) => (
  <>
    <mesh position={[0, (FLOOR + CEIL) / 2, 0]}>
      <boxGeometry args={[ROOM_W, CEIL - FLOOR, ROOM_D]} />
      <meshStandardMaterial {...FLAT} color={colors.wall} side={BackSide} />
    </mesh>
    {/* The window on the back wall: night outside, moonlit. */}
    <group position={[0.4, 1.15, -ROOM_D / 2 + 0.02]}>
      <mesh>
        <planeGeometry args={[1.6, 1.3]} />
        <meshBasicMaterial color={colors.night} />
      </mesh>
      {[
        [0, 0.65, 1.7, 0.08],
        [0, -0.65, 1.7, 0.08],
        [-0.8, 0, 0.08, 1.38],
        [0.8, 0, 0.08, 1.38],
        [0, 0, 0.05, 1.3],
        [0, 0, 1.6, 0.05]
      ].map(([x, y, w, h]) => (
        <mesh key={`${x}${y}${w}`} position={[x, y, 0.03]}>
          <boxGeometry args={[w, h, 0.06]} />
          <meshStandardMaterial {...FLAT} color={colors.frame} />
        </mesh>
      ))}
    </group>
  </>
);

const OceanScene = ({ camera }) => {
  useCameraDrift({ position: camera.position, target: [0, -0.3, -4], pivot: 'camera' });
  const time = useClock();
  const colors = useMemo(
    () => ({
      tint: readTint('tide'),
      wall: readToken('--line'),
      frame: readToken('--line-strong'),
      night: readToken('--surface-raised'),
      water: readToken('--surface-raised'),
      furniture: readToken('--ink-muted'),
      shade: readToken('--ink'),
      book: readToken('--line-strong'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.045} />
      <hemisphereLight args={[colors.tint, colors.surface, 0.35]} />
      <directionalLight position={[0.4, 3, -6]} intensity={2} color={colors.tint} />
      <Room colors={colors} />
      <Water time={time} color={colors.water} />
      <Caustics time={time} color={colors.tint} />
      {FURNITURE.map(item => (
        <Floating key={item.kind} item={item} time={time} colors={colors} />
      ))}
    </>
  );
};

export default OceanScene;
