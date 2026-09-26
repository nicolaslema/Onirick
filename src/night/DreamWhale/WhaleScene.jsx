import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Object3D, Quaternion, Vector3 } from 'three';
import { easing } from 'maath';

import { getPlay, markTouched, subscribeAction, trigger } from '../../night/play';
import { keep } from '../../night/recording';
import Atmosphere from '../../three/Atmosphere';
import { createWaveDetector } from '../../three/gestures';
import { FLAT, readTint, readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCloudTexture } from '../../three/useCloudTexture';
import { useCameraDrift } from '../../three/useCameraDrift';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';
import { useLive } from '../stage';

// Dream 02, The Whale Above the City (PLAN-2.md 6.2). Nobody looks up. You
// wave — and the whale comes down, turns one eye to you, blinks; the windows
// under it light up in a wave, and on one rooftop, someone finally looks up.

const GRID_X = 12;
const GRID_Z = 12;
const SPACING = 2.3;
const LAP = 40; // s — the whale's route (PLAN.md 6.2)

// The first wave's reaction, in seconds (PLAN-2.md 6.2).
const LEAVE = 1.5; // off the route, down and closer
const LOOK = 3; // flank to the camera, one eye on you
const BLINK_AT = 1.4; // into LOOK
const BLINK = 0.2;
const RETURN = 2; // back up to the route
const GLANCE = 1.6; // later waves: the eye turns to you, and a blink
// The city's answer: a warm light sweeping the rooftops, side to side.
const SWEEP_TIME = 3;
const SWEEP_FROM = -14;
const SWEEP_TO = 14;
// In front of the first row, at roof height: the faces the camera sees are
// the fronts, so that's where the light has to land.
const SWEEP_Y = 3.5;
const SWEEP_Z = 5.5;
// Enough to light the fronts it passes; the whale above only catches a
// glow from below.
const SWEEP_INTENSITY = 70;
const SWEEP_REACH = 11;
const FIGURE_FADE = 0.6;
const WATCHER_SCALE = 1.8; // tiny next to the whale, but it has to read
const REDUCED_SLOWER = 1.6; // reduced motion: the same reaction, slower

const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = t => Math.min(Math.max(t, 0), 1);

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

// The city answers your wave with a sweep of warm light running along the
// rooftops under the whale, side to side (PLAN-2.md 6.2 asked for a wave of
// lit windows; from this camera almost no window is ever on screen — each
// row hides the fronts behind it, and the first row's sit below the frame —
// so the light goes where the eye actually is: the skyline). Under reduced
// motion it swells in place instead of travelling.
const CitySweep = ({ reaction, color }) => {
  const light = useRef(null);
  const reduced = useReducedMotion();
  useFrame(() => {
    const r = reaction.current;
    const l = light.current;
    if (!l) return;
    const k = r.cityAt < 0 ? 1 : (r.clock - r.cityAt) / (reduced ? SWEEP_TIME * 1.4 : SWEEP_TIME);
    if (k >= 1) {
      l.intensity = 0;
      return;
    }
    l.position.set(reduced ? r.cityFrom : r.cityFrom + SWEEP_FROM + (SWEEP_TO - SWEEP_FROM) * k, SWEEP_Y, SWEEP_Z);
    l.intensity = SWEEP_INTENSITY * Math.sin(Math.PI * Math.max(k, 0));
  });
  return <pointLight ref={light} color={color} intensity={0} distance={SWEEP_REACH} decay={1.2} />;
};

const Windows = ({ windows, color }) => {
  const ref = useRef(null);
  useInstances(ref, windows, (d, { x, y, z }) => d.position.set(x, y, z));
  return (
    <instancedMesh ref={ref} args={[null, null, windows.length]}>
      <planeGeometry args={[0.22, 0.32]} />
      <meshBasicMaterial color={color} />
    </instancedMesh>
  );
};

// Someone on a rooftop, looking up — the city's one answer to your wave.
// Tiny: a body and a head tipped back. Fades in while the whale looks at
// you, and stays.
const Watcher = ({ at, reaction, color }) => {
  const group = useRef(null);
  const materials = useRef([]);
  const opacity = useRef(reaction.current.watcher ? 1 : 0);
  useFrame((_, delta) => {
    const dir = reaction.current.watcher ? 1 : -1;
    opacity.current = clamp01(opacity.current + (dir * delta) / FIGURE_FADE);
    materials.current.forEach(m => m && (m.opacity = opacity.current));
    if (group.current) group.current.visible = opacity.current > 0.01;
  });
  const material = i => (
    <meshStandardMaterial
      ref={m => {
        materials.current[i] = m;
      }}
      {...FLAT}
      color={color}
      transparent
    />
  );
  return (
    <group ref={group} position={at} scale={WATCHER_SCALE}>
      <mesh position={[0, 0.2, 0]}>
        <capsuleGeometry args={[0.07, 0.24, 2, 6]} />
        {material(0)}
      </mesh>
      <mesh position={[0, 0.44, -0.03]}>
        <icosahedronGeometry args={[0.07, 0]} />
        {material(1)}
      </mesh>
    </group>
  );
};

// The rooftop the watcher stands on: a tall one near where the rooftops
// show below the copy — toward the right on a wide screen (the title and
// log fill the left), near the middle on a narrow one.
function pickRooftop(buildings, portrait) {
  const want = portrait ? { x: 1.2, z: -3 } : { x: 5, z: -4 };
  let best = buildings[0];
  let score = Infinity;
  for (const b of buildings) {
    const s = Math.hypot(b.x - want.x, b.z - want.z) * 2 - b.h;
    if (s < score) {
      score = s;
      best = b;
    }
  }
  return [best.x, best.h, best.z];
}

const City = ({ reaction, colors }) => {
  const city = useCity();
  const { buildings, tanks, antennas, windows } = city;
  const portrait = useThree(state => state.viewport.aspect < 1);
  const rooftop = useMemo(() => pickRooftop(buildings, portrait), [buildings, portrait]);
  const b = useRef(null);
  const t = useRef(null);
  const a = useRef(null);
  useInstances(b, buildings, (d, { x, z, w: bw, d: bd, h }) => {
    d.position.set(x, h / 2, z);
    d.scale.set(bw, h, bd);
  });
  useInstances(t, tanks, (d, { x, y, z }) => d.position.set(x, y + 0.3, z));
  useInstances(a, antennas, (d, { x, y, z, h }) => {
    d.position.set(x, y + h / 2, z);
    d.scale.set(1, h, 1);
  });
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
      <Windows windows={windows} color={colors.tint} />
      <CitySweep reaction={reaction} color={colors.ink} />
      <Watcher at={rooftop} reaction={reaction} color={colors.ink} />
    </>
  );
};

// Procedural low-poly whale (PLAN.md 6.2): a stretched icosahedron body,
// cone fins and flukes, nose toward +z so lookAt() steers it along its path.
// `eyes` gets the two eye meshes, for blinking.
const WhaleBody = ({ colors, eyes }) => (
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
    {[-1, 1].map((side, i) => (
      <mesh
        key={`eye${side}`}
        ref={m => {
          eyes.current[i] = m;
        }}
        position={[side * 0.86, 0.12, 1.7]}
      >
        <sphereGeometry args={[0.09, 6, 4]} />
        <meshBasicMaterial color={colors.eye} />
      </mesh>
    ))}
  </>
);

// A wide ellipse over the rooftops. A portrait screen sees only ~4 units to
// either side at that depth, so there the loop narrows and runs mostly
// toward and away from the camera instead, keeping the whale in frame.
// `attention`: where it comes down to look at you; `lookScale`: its size
// there (a portrait screen can't fit its whole flank at full size).
const ROUTE = {
  landscape: { rx: 8, rz: 5, scale: 1, attention: [0, 8.6, 1.5], lookScale: 1 },
  portrait: { rx: 2.2, rz: 7, scale: 0.75, attention: [0, 9.4, -2], lookScale: 0.55 }
};

const pathPoint = (t, out, route) => {
  const a = (t / LAP) * Math.PI * 2;
  return out.set(Math.cos(a) * route.rx, 11.5 + Math.sin(a * 2) * 0.6, -6 + Math.sin(a) * route.rz);
};

// How far off its route the whale is (0-1), from the reaction's phase.
function attentionWeight(r) {
  if (r.phase === 'leaving') return easeInOut(clamp01(r.t / (LEAVE * r.slow)));
  if (r.phase === 'looking') return 1;
  if (r.phase === 'returning') return 1 - easeInOut(clamp01(r.t / (RETURN * r.slow)));
  return 0;
}

// Eye scale during a blink started `since` seconds ago.
const blinkScale = since => (since >= 0 && since < BLINK ? 1 - 0.9 * Math.sin((Math.PI * since) / BLINK) : 1);

const Whale = ({ reaction, colors }) => {
  const portrait = useThree(state => state.viewport.aspect < 1);
  const route = portrait ? ROUTE.portrait : ROUTE.landscape;
  const outer = useRef(null);
  const inner = useRef(null);
  const eyes = useRef([]);
  const time = useRef(LAP * 0.3);
  const glance = useRef(0);
  const reduced = useReducedMotion();
  const s = useMemo(
    () => ({
      here: new Vector3(),
      ahead: new Vector3(),
      attention: new Vector3(),
      pos: new Vector3(),
      toCam: new Vector3(),
      side: new Vector3(),
      up: new Vector3(0, 1, 0),
      local: new Vector3(),
      dummy: new Object3D(),
      qPath: new Quaternion(),
      qFlank: new Quaternion()
    }),
    []
  );
  useEffect(trackPointer, []);
  useFrame(({ camera }, delta) => {
    if (!outer.current) return;
    const r = reaction.current;
    const w = attentionWeight(r);
    // The route's clock slows while it's away, so it picks up where it left.
    time.current += delta * (reduced ? REDUCED_SPEED : 1) * (1 - w);

    pathPoint(time.current, s.here, route);
    pathPoint(time.current + 0.5, s.ahead, route);
    s.attention.fromArray(route.attention);
    s.pos.copy(s.here).lerp(s.attention, w);

    // Along its path: nose toward where it's going.
    s.dummy.position.copy(s.here);
    s.dummy.lookAt(s.ahead);
    s.qPath.copy(s.dummy.quaternion);
    // Looking at you: its right flank (and right eye) toward the camera.
    s.toCam.subVectors(camera.position, s.pos).setY(0).normalize();
    s.side.crossVectors(s.toCam, s.up).normalize();
    s.dummy.position.copy(s.pos);
    s.dummy.lookAt(s.local.copy(s.pos).add(s.side));
    s.qFlank.copy(s.dummy.quaternion);

    outer.current.position.copy(s.pos);
    outer.current.quaternion.slerpQuaternions(s.qPath, s.qFlank, w);
    const scale = route.scale + (route.lookScale - route.scale) * w;
    inner.current.scale.setScalar(scale);

    // Later waves: the eye turns toward you for a moment.
    const glanceGoal = r.glance > 0 ? 1 : 0;
    glance.current += (glanceGoal - glance.current) * Math.min(1, delta * 4);
    outer.current.updateMatrixWorld();
    outer.current.worldToLocal(s.local.copy(camera.position));
    const yawToCam = Math.max(-0.9, Math.min(0.9, Math.atan2(s.local.x, s.local.z)));
    // "it turns one eye toward you": a small yaw/roll toward the cursor,
    // held still while it's looking at you.
    const follow = reduced ? 0 : 1 - w;
    const goal = [-pointer.y * 0.12 * follow, pointer.x * 0.3 * follow + glance.current * yawToCam * 0.8, -pointer.x * 0.15 * follow];
    easing.dampE(inner.current.rotation, goal, 0.6, delta);

    const eyeY = blinkScale(r.blinkSince);
    eyes.current.forEach(e => e && (e.scale.y = eyeY));
  });
  return (
    <group ref={outer}>
      <group ref={inner} scale={route.scale}>
        <WhaleBody colors={colors} eyes={eyes} />
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

// The wave, and what it sets off. `reaction` is shared by the whale, the
// windows and the watcher; `clock` is its own time (seconds).
function useReaction(live) {
  const reduced = useReducedMotion();
  const waved = getPlay('whale').events.has('wave');
  const reaction = useRef({ clock: 0, phase: 'route', t: 0, slow: 1, glance: 0, blinkSince: -1, cityAt: -1, cityFrom: 0, watcher: waved });
  const detector = useMemo(() => createWaveDetector(), []);

  const wave = useCallback(() => {
    const r = reaction.current;
    markTouched('whale');
    if (!getPlay('whale').events.has('wave')) {
      // The first wave: the whole answer, and the fragment.
      trigger('whale', 'wave');
      keep('whale');
      r.phase = 'leaving';
      r.t = 0;
      r.blinkSince = -1;
      return;
    }
    // "I saw you": only the eye, if it isn't already busy looking at you.
    if (r.phase === 'route' && r.glance <= 0) {
      r.glance = GLANCE;
      r.blinkSince = -0.5;
    }
  }, []);

  useEffect(() => {
    if (!live) return undefined;
    return subscribeAction(id => id === 'whale' && wave());
  }, [live, wave]);

  useFrame((_, delta) => {
    const r = reaction.current;
    const dt = Math.min(delta, 0.1);
    r.clock += dt;
    r.slow = reduced ? REDUCED_SLOWER : 1;
    if (live && detector(pointer.x, performance.now())) wave();

    if (r.blinkSince > -1) r.blinkSince += dt;
    if (r.glance > 0) r.glance -= dt;
    if (r.phase === 'route') return;
    r.t += dt;
    if (r.phase === 'leaving' && r.t >= LEAVE * r.slow) {
      r.phase = 'looking';
      r.t = 0;
      r.watcher = true;
      // The windows flare from under where it came down.
      r.cityAt = r.clock;
      r.cityFrom = 0;
    } else if (r.phase === 'looking') {
      if (r.blinkSince < 0 && r.t >= BLINK_AT * r.slow) r.blinkSince = 0;
      if (r.t >= LOOK * r.slow) {
        r.phase = 'returning';
        r.t = 0;
      }
    } else if (r.phase === 'returning' && r.t >= RETURN * r.slow) {
      r.phase = 'route';
      r.t = 0;
    }
  });

  return reaction;
}

const WhaleScene = ({ camera }) => {
  // Listening to the visitor only while this dream is on screen and settled.
  const live = useLive('whale');
  // Looking up steeply: the rooftops stay in the bottom strip, below the
  // title, since distant roofs take the fog's tint (= the title's color).
  useCameraDrift({ position: camera.position, target: [0, 12, -6] });
  const reaction = useReaction(live);
  const colors = useMemo(
    () => ({
      tint: readTint('whale'),
      building: readToken('--line-strong'),
      detail: readToken('--line'),
      whale: readToken('--ink-muted'),
      eye: readToken('--surface'),
      cloud: readToken('--ink'),
      ink: readToken('--ink'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.05} />
      <hemisphereLight args={[colors.tint, colors.surface, 0.4]} />
      <directionalLight position={[-6, 14, 6]} intensity={2} color={colors.tint} />
      <City reaction={reaction} colors={colors} />
      <Whale reaction={reaction} colors={colors} />
      <Clouds color={colors.cloud} />
    </>
  );
};

export default WhaleScene;
