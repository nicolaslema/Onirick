import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, BackSide, CanvasTexture, Color, DoubleSide, Object3D, Plane, PlaneGeometry, Raycaster, RepeatWrapping, Vector2, Vector3 } from 'three';

import { setTarget, subscribeAction } from '../../night/play';
import { isKept, keep, useRecording } from '../../night/recording';
import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken, sceneBackground } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCameraDrift } from '../../three/useCameraDrift';
import { useCloudTexture } from '../../three/useCloudTexture';
import { usePlayProgress } from '../../three/usePlayProgress';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';
import { useLive } from '../stage';

// Dream 04, The Ocean Indoors (PLAN-2.md 6.4). The water comes in without a
// sound and keeps rising — one level per gesture, until you're under. The one
// thing this dream asks is to do nothing: stay under, unafraid, and the
// floating lamp lights up — the only warm light in the room.

// A room (inverted box) filling with water, one level per beat.
const ROOM_W = 8;
const ROOM_D = 9;
const FLOOR = -1.5;
const CEIL = 2.5;
const EYE = 1.3; // the camera's height (DreamOcean's CAMERA)

// The four levels: ankles, waist, just under your eyes, over your head. The
// breathing (±BREATH) plus the swell (±0.11) never carries the surface across
// your eyes on its own — only a beat does (0.2 of margin each side).
const LEVELS = [FLOOR + 0.3, -0.35, EYE - 0.25, EYE + 0.3];
const BREATH = 0.08;
const BREATH_PERIOD = 8; // s
const LEVEL_SMOOTH = 0.5; // s — each beat's rise takes about a beatDuration (1.6 s)
const REDUCED_LEVEL_SMOOTH = 0.15; // reduced motion: a quick change, not a slow rise
const levelAt = beat => {
  const b = Math.min(Math.max(beat, 0), LEVELS.length - 1);
  const i = Math.min(Math.floor(b), LEVELS.length - 2);
  return LEVELS[i] + (LEVELS[i + 1] - LEVELS[i]) * (b - i);
};

// Under the surface: denser fog, a deeper background — blended by the water's
// height across your eyes, not by time, so going back up undoes it the same.
const FOG = [0.045, 0.1];
const underBy = level => Math.min(Math.max((level - EYE + 0.05) / 0.2, 0), 1);

const STAY_UNDER_S = 6; // PLAN-2.md 6.4
const LAMP_ON_S = 1.2; // the lamp takes a moment, with a flicker

// Water surface: a height field the pointer disturbs (discrete wave
// equation on the grid, stepped at a fixed 60 Hz).
const SEGMENTS = 56;
const SIDE = SEGMENTS + 1;
const DAMPING = 0.985;
const RIPPLE_AMP = 0.14;
const STEP = 1 / 60;
const PUSH = 0.9; // how hard a passing ripple shoves floating furniture
const DRIFT_MAX = 1.4; // furniture stays within this of its spot

const BUBBLES = 40;

const swell = (x, z, t) => 0.06 * Math.sin(x * 1.3 + t * 1.1) + 0.05 * Math.sin(z * 1.7 - t * 0.9);
const gridIndex = (x, z) => {
  const gx = Math.round(((x + ROOM_W / 2) / ROOM_W) * SEGMENTS);
  const gz = Math.round(((z + ROOM_D / 2) / ROOM_D) * SEGMENTS);
  return gx > 1 && gx < SEGMENTS - 1 && gz > 1 && gz < SEGMENTS - 1 ? gz * SIDE + gx : -1;
};

function useClock() {
  const t = useRef(0);
  const reduced = useReducedMotion();
  useFrame((_, delta) => {
    t.current += delta * (reduced ? REDUCED_SPEED : 1);
  });
  return t;
}

// The ripples: a discrete wave equation on the surface grid, stepped at a
// fixed 60 Hz, and the pointer's touch where its ray meets the water (from
// above or below). Owned by the scene, which steps it; Water draws it and the
// furniture reads it.
function useRipples(level) {
  const reduced = useReducedMotion();
  const sim = useRef({ cur: new Float32Array(SIDE * SIDE), prev: new Float32Array(SIDE * SIDE), acc: 0 });
  const scratch = useRef(null);
  useEffect(trackPointer, []);
  useFrame(({ camera }, delta) => {
    const s = sim.current;
    scratch.current ??= { last: null, ray: new Raycaster(), plane: new Plane(new Vector3(0, 1, 0), 0), hit: new Vector3(), ndc: new Vector2() };
    const k = scratch.current;
    if (!reduced) {
      k.plane.constant = -level.current;
      k.ray.setFromCamera(k.ndc.set(pointer.x, pointer.y), camera);
      if (k.ray.ray.intersectPlane(k.plane, k.hit)) {
        const i = gridIndex(k.hit.x, k.hit.z);
        const moved = !k.last || Math.hypot(pointer.x - k.last.x, pointer.y - k.last.y) > 0.004;
        if (moved && i >= 0) s.cur[i] -= 0.9;
        k.last = { x: pointer.x, y: pointer.y };
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
  });
  return sim;
}

// The surface — seen from below once you're under (double-sided).
const Water = ({ time, level: levelRef, sim, color }) => {
  const geometry = useMemo(() => new PlaneGeometry(ROOM_W, ROOM_D, SEGMENTS, SEGMENTS).rotateX(-Math.PI / 2), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const mesh = useRef(null);
  useFrame(() => {
    if (!mesh.current) return;
    const t = time.current;
    const level = levelRef.current;
    const { cur } = sim.current;
    const pos = mesh.current.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, level + swell(pos.getX(i), pos.getZ(i), t) + cur[i] * RIPPLE_AMP);
    }
    pos.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geometry}>
      <meshStandardMaterial {...FLAT} color={color} transparent opacity={0.9} side={DoubleSide} />
    </mesh>
  );
};

// Faint caustics: a light web texture on a band hugging the waterline of
// each wall, drifting slowly — and, once you're under, on the floor.
function useCausticTexture(repeat) {
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
    tex.repeat.set(...repeat);
    return tex;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const Caustics = ({ time, level, under, color }) => {
  const texture = useCausticTexture([7, 2]);
  const floorTexture = useCausticTexture([4, 4]);
  const group = useRef(null);
  const floor = useRef(null);
  useFrame(() => {
    texture.offset.set(time.current * 0.02, time.current * 0.013);
    floorTexture.offset.set(time.current * 0.015, -time.current * 0.01);
    if (group.current) group.current.position.y = level.current + 0.6;
    if (floor.current) floor.current.opacity = 0.045 * under.current;
  });
  const walls = [
    { position: [0, 0, -ROOM_D / 2 + 0.01], rotation: [0, 0, 0], width: ROOM_W },
    { position: [-ROOM_W / 2 + 0.01, 0, 0], rotation: [0, Math.PI / 2, 0], width: ROOM_D },
    { position: [ROOM_W / 2 - 0.01, 0, 0], rotation: [0, -Math.PI / 2, 0], width: ROOM_D }
  ];
  return (
    <>
      <group ref={group}>
        {walls.map(w => (
          <mesh key={w.position.join()} position={w.position} rotation={w.rotation}>
            <planeGeometry args={[w.width, 1.2]} />
            <meshBasicMaterial map={texture} color={color} transparent opacity={0.06} blending={AdditiveBlending} depthWrite={false} />
          </mesh>
        ))}
      </group>
      <mesh position={[0, FLOOR + 0.01, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshBasicMaterial ref={floor} map={floorTexture} color={color} transparent opacity={0} blending={AdditiveBlending} depthWrite={false} />
      </mesh>
    </>
  );
};

// Under the surface, the window's light falls into the room in a few faint
// shafts.
const SHAFTS = [
  [-0.2, 0.25, 0.9],
  [0.45, -0.1, 1.1],
  [1.0, 0.3, 0.8]
];
const Shafts = ({ under, color }) => {
  const materials = useRef([]);
  const texture = useCloudTexture();
  useFrame(() => {
    materials.current.forEach(m => m && (m.opacity = 0.07 * under.current));
  });
  return SHAFTS.map(([x, tilt, width], i) => (
    <mesh key={x} position={[x + 0.4, 0.2, -ROOM_D / 2 + 1.6]} rotation={[-0.75, tilt, 0]} scale={[width, 4.2, 1]}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        ref={m => {
          materials.current[i] = m;
        }}
        map={texture}
        color={color}
        transparent
        opacity={0}
        blending={AdditiveBlending}
        depthWrite={false}
        side={DoubleSide}
        fog={false}
      />
    </mesh>
  ));
};

// Under the surface, a moving pointer lets out bubbles that rise to it.
const Bubbles = ({ level, under, color }) => {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const pool = useRef(Array.from({ length: BUBBLES }, () => ({ alive: false, x: 0, y: 0, z: 0, speed: 0, phase: 0 })));
  const next = useRef(0);
  const spawn = useRef(0);
  const scratch = useRef(null);
  const rand = useMemo(() => seeded(29), []);
  useFrame(({ camera }, delta) => {
    scratch.current ??= { dummy: new Object3D(), dir: new Vector3(), at: new Vector3(), last: { x: 0, y: 0 } };
    const s = scratch.current;
    const dt = Math.min(delta, 0.1);
    const moving = Math.hypot(pointer.x - s.last.x, pointer.y - s.last.y) > 0.002;
    s.last.x = pointer.x;
    s.last.y = pointer.y;
    if (!reduced && under.current > 0.9 && moving) {
      spawn.current += dt * 18;
      while (spawn.current >= 1) {
        spawn.current -= 1;
        const b = pool.current[next.current];
        next.current = (next.current + 1) % BUBBLES;
        s.dir.set(pointer.x, pointer.y, 0.5).unproject(camera).sub(camera.position).normalize();
        s.at.copy(camera.position).addScaledVector(s.dir, 1.6 + rand() * 1.4);
        Object.assign(b, { alive: true, x: s.at.x + (rand() - 0.5) * 0.2, y: s.at.y, z: s.at.z, speed: 0.4 + rand() * 0.4, phase: rand() * 6 });
      }
    }
    pool.current.forEach((b, i) => {
      if (b.alive) {
        b.y += b.speed * dt;
        b.phase += dt * 3;
        if (b.y > level.current) b.alive = false;
      }
      s.dummy.position.set(b.x + Math.sin(b.phase) * 0.03, b.y, b.z);
      s.dummy.scale.setScalar(b.alive ? 1 : 0);
      s.dummy.updateMatrix();
      ref.current.setMatrixAt(i, s.dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[null, null, BUBBLES]}>
      <icosahedronGeometry args={[0.03, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.6} />
    </instancedMesh>
  );
};

// Chair, lamp and book. Each rests on the floor until the water reaches it,
// then rides the surface with a slow rock ("floats up politely") — and drifts
// when a ripple reaches it.
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

// The lamp — and, once you've stayed under, its light: warm amber, the only
// warm light in the room, with the shade glowing.
const Lamp = ({ color, shade, warm, glow }) => {
  const shades = useRef([]);
  const light = useRef(null);
  const warmColor = useMemo(() => new Color(warm), [warm]);
  useFrame(() => {
    const g = glow.current;
    shades.current.forEach(m => {
      if (!m) return;
      m.emissive.copy(warmColor);
      m.emissiveIntensity = g * 0.9;
    });
    if (light.current) light.current.intensity = g * 18;
  });
  return (
    <>
      <mesh position={[0, -0.55, 0]}>
        <cylinderGeometry args={[0.2, 0.24, 0.08, 8]} />
        <meshStandardMaterial {...FLAT} color={color} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.025, 0.025, 1.1, 5]} />
        <meshStandardMaterial {...FLAT} color={color} />
      </mesh>
      {[BackSide, undefined].map((side, i) => (
        <mesh key={i} position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.16, 0.34, 0.36, 8, 1, true]} />
          <meshStandardMaterial
            ref={m => {
              shades.current[i] = m;
            }}
            {...FLAT}
            color={shade}
            side={side}
          />
        </mesh>
      ))}
      <pointLight ref={light} position={[0, 0.5, 0]} color={warm} intensity={0} distance={8} decay={1.3} />
    </>
  );
};

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

const Floating = ({ item, time, level, sim, glow, colors }) => {
  const ref = useRef(null);
  const drift = useRef({ x: 0, z: 0, vx: 0, vz: 0 });
  useFrame((_, delta) => {
    if (!ref.current) return;
    const t = time.current;
    const d = drift.current;
    const onFloor = FLOOR + item.rest;
    const afloat = level.current + swell(item.x, item.z, t) - item.draft + item.rest;
    const lift = Math.min(1, Math.max(0, (afloat - onFloor) / 0.25));
    // A ripple passing under something afloat shoves it downhill.
    const cur = sim.current.cur;
    const i = gridIndex(item.x + d.x, item.z + d.z);
    if (lift > 0.5 && i >= 0) {
      d.vx += -(cur[i + 1] - cur[i - 1]) * PUSH * delta;
      d.vz += -(cur[i + SIDE] - cur[i - SIDE]) * PUSH * delta;
    }
    d.vx *= 0.97;
    d.vz *= 0.97;
    d.x = Math.max(-DRIFT_MAX, Math.min(DRIFT_MAX, d.x + d.vx * delta));
    d.z = Math.max(-DRIFT_MAX, Math.min(DRIFT_MAX, d.z + d.vz * delta));
    ref.current.position.set(item.x + d.x + Math.sin(t * 0.13 + item.phase) * 0.25 * lift, Math.max(onFloor, afloat), item.z + d.z);
    ref.current.rotation.set(Math.sin(t * 0.7 + item.phase) * 0.08 * lift, item.phase + t * 0.03 * lift, Math.cos(t * 0.6 + item.phase) * 0.07 * lift);
  });
  return (
    <group ref={ref}>
      {item.kind === 'chair' && <Chair color={colors.furniture} />}
      {item.kind === 'lamp' && <Lamp color={colors.furniture} shade={colors.shade} warm={colors.warm} glow={glow} />}
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

// The fog and background follow the water across your eyes.
// Under the surface it gets deeper, not paler: the fog thickens and turns
// from the tint to the deep background's blue, so the title and log keep
// their contrast.
const Depth = ({ under, tint }) => {
  const shallow = useMemo(() => sceneBackground(tint), [tint]);
  const deep = useMemo(() => sceneBackground(tint, 0.3), [tint]);
  const tintColor = useMemo(() => new Color(tint), [tint]);
  useFrame(({ scene }) => {
    const u = under.current;
    if (scene.fog) {
      scene.fog.density = FOG[0] + (FOG[1] - FOG[0]) * u;
      scene.fog.color.copy(tintColor).lerp(deep, u);
    }
    if (scene.background?.isColor) scene.background.copy(shallow).lerp(deep, u);
  });
  return null;
};

const OceanScene = ({ camera }) => {
  // Listening to the visitor only while this dream is on screen and settled.
  const live = useLive('ocean');
  const reduced = useReducedMotion();
  const beat = usePlayProgress('ocean', reduced ? REDUCED_LEVEL_SMOOTH : LEVEL_SMOOTH);
  const time = useClock();
  // The water height every piece below reads: the (smoothed) beat's level,
  // breathing slowly; and how far under the surface your eyes are (0-1).
  // (Both are set on the first frame, before anything draws.)
  const level = useRef(LEVELS[0]);
  const under = useRef(0);
  const recording = useRecording();
  const kept = isKept('ocean', recording);
  // The lamp: 0 off → 1 on; `stayed` counts the seconds under.
  const glow = useRef(kept ? 1 : 0);
  const stayed = useRef(0);
  const litAt = useRef(kept ? -Infinity : null);

  useFrame((_, delta) => {
    const breath = BREATH * Math.sin((Math.PI * 2 * time.current) / BREATH_PERIOD);
    level.current = levelAt(beat.current) + breath;
    under.current = underBy(level.current);

    // Staying under (the last beat, eyes fully below the surface) for
    // STAY_UNDER_S: the fragment. Coming up, or leaving, starts it over.
    const settledUnder = live && Math.round(beat.current) === LEVELS.length - 1 && under.current >= 1;
    stayed.current = settledUnder ? stayed.current + delta : 0;
    if (stayed.current >= STAY_UNDER_S && litAt.current === null) {
      keep('ocean');
      litAt.current = time.current;
    }
    // Lighting up takes a moment, flickering like an old lamp.
    if (litAt.current !== null) {
      const t = time.current - litAt.current;
      glow.current = t >= LAMP_ON_S ? 1 : (t / LAMP_ON_S) * (0.55 + 0.45 * Math.abs(Math.sin(t * 23)));
    }
  });
  // After the level's own frame, so the ripples sit on this frame's surface.
  const sim = useRipples(level);

  // Kept earlier tonight (you're coming back): already lit. A new night
  // (REPLAY, or ?debug's reset): dark again.
  useEffect(() => {
    if (kept && litAt.current === null) litAt.current = -Infinity;
    if (!kept) {
      litAt.current = null;
      glow.current = 0;
    }
  }, [kept]);

  // "Stay under" from the keyboard: take the water all the way up.
  useEffect(() => {
    if (!live) return undefined;
    return subscribeAction(id => id === 'ocean' && setTarget('ocean', LEVELS.length - 1));
  }, [live]);

  useCameraDrift({ position: camera.position, target: [0, -0.3, -4], pivot: 'camera' });
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
      warm: readToken('--dream-stair'),
      bubble: readToken('--ink'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={FOG[0]} />
      <Depth under={under} tint={colors.tint} />
      <hemisphereLight args={[colors.tint, colors.surface, 0.35]} />
      <directionalLight position={[0.4, 3, -6]} intensity={2} color={colors.tint} />
      <Room colors={colors} />
      <Water time={time} level={level} sim={sim} color={colors.water} />
      <Caustics time={time} level={level} under={under} color={colors.tint} />
      <Shafts under={under} color={colors.tint} />
      <Bubbles level={level} under={under} color={colors.bubble} />
      {FURNITURE.map(item => (
        <Floating key={item.kind} item={item} time={time} level={level} sim={sim} glow={glow} colors={colors} />
      ))}
    </>
  );
};

export default OceanScene;
