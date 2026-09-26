import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { easing } from 'maath';

import { markTouched, subscribeAction, trigger } from '../../night/play';
import { isKept, keep, useRecording } from '../../night/recording';
import { readTint, readToken } from '../../three/materials';
import Atmosphere from '../../three/Atmosphere';
import { pointer, trackPointer } from '../../three/pointer';
import { seeded } from '../../three/random';
import { useCloudTexture } from '../../three/useCloudTexture';
import { usePlayProgress } from '../../three/usePlayProgress';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';
import { useLive } from '../stage';

// Dream 05, The Fall (PLAN-2.md 6.5). The scroll is depth: the fall speeds
// up, an alarm grows — red rings rising from below, and the HUD's REC dot
// racing — and a white light opens underneath until the last melt burns into
// it. You've been steering the whole way down. Let go — keep still — and the
// camera turns up: the whole night is above you, and what you kept of it
// glows.

// Falling forever (PLAN.md 6.6). Everything lives in a column H tall that
// scrolls upward past a camera looking down; each layer is drawn twice,
// stacked, and wraps every H, so the fall never runs out.
const H = 40;
const SPREAD = 14;
const SPEED = 5; // units/s at the top of the fall
const SPEED_GAIN = 1.5; // ...× (1 + gain·progress) at the bottom
const POINTS = 2000;
const CLOUDS = 26;
const LINES = 140;
const SHAKE = 0.002;
const STEER = 2.2; // how far the pointer pulls the camera, in units

// The alarm: a ring every 3 s at the top, three a second at the bottom; from
// 0.6 on each one also pulses the fog.
const RINGS = 12;
const RING_EVERY = [3, 1 / 3];
const RING_RISE = 14; // units/s
const RING_FROM = -38;
const PULSE_FROM = 0.6;

// The light below: a disc that grows until it nearly fills the frame.
const LIGHT_Y = -44;
// Capped (and set a little right) so even at the bottom it stays clear of the
// title and log in the lower left: bone on bone, they'd be unreadable.
const LIGHT_SCALE = [3, 34];
const LIGHT_X = 2.5;
// On a portrait screen the title and log span the whole width of the lower
// half: the light is smaller there, and pushed up the frame (looking down,
// −z is up on screen).
const LIGHT_PORTRAIT = { scale: [2, 15], x: 0, z: -15 };
// Looking up, +z is up on screen: on a portrait screen the night above moves
// up, off the title block.
const NIGHT_PORTRAIT_Z = 5;

// Letting go (PLAN-2.md 6.5).
const STILL_FOR_MS = 3000;
const LET_GO_BEFORE = 0.9; // no letting go right at the bottom
const UP_SMOOTH = 1.8; // s — the camera's turn up
const ACTION_UP_MS = 5000; // "Let go" from the keyboard

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

// One layer, tiled: `children` renders the column once; it's drawn at y=0
// and y=-H and the pair scrolls up with the fall, wrapping every H.
const Tiled = ({ fall, rate, children }) => {
  const ref = useRef(null);
  useFrame(() => {
    if (ref.current) ref.current.position.y = (fall.current.distance * rate) % H;
  });
  return (
    <group ref={ref}>
      <group>{children}</group>
      <group position-y={-H}>{children}</group>
    </group>
  );
};

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

// The alarm's rings, rising from below and widening as they come — out of the
// light below, wherever it sits on screen.
const Rings = ({ fall, color }) => {
  const meshes = useRef([]);
  const portrait = useThree(state => state.viewport.aspect < 1);
  const [cx, cz] = portrait ? [LIGHT_PORTRAIT.x, LIGHT_PORTRAIT.z] : [LIGHT_X, -2];
  useFrame(() => {
    fall.current.rings.forEach((ring, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.visible = ring.alive;
      if (!ring.alive) return;
      m.position.set(cx, ring.y, cz);
      const s = 3 + (ring.y - RING_FROM) * 0.08;
      m.scale.set(s, s, 1);
      m.material.opacity = 0.7 * Math.min(1, (-ring.y - 2) / 8);
    });
  });
  return Array.from({ length: RINGS }, (_, i) => (
    <mesh
      key={i}
      ref={m => {
        meshes.current[i] = m;
      }}
      rotation-x={-Math.PI / 2}
      visible={false}
    >
      <ringGeometry args={[0.96, 1, 48]} />
      <meshBasicMaterial color={color} transparent opacity={0} depthWrite={false} side={2} />
    </mesh>
  ));
};

// The light below, growing with the fall.
const LightBelow = ({ progress, color }) => {
  const ref = useRef(null);
  const halo = useRef(null);
  const texture = useCloudTexture();
  const portrait = useThree(state => state.viewport.aspect < 1);
  const [from, to] = portrait ? LIGHT_PORTRAIT.scale : LIGHT_SCALE;
  useFrame(() => {
    const p = progress.current;
    const s = from + (to - from) * p * p;
    if (ref.current) ref.current.scale.setScalar(s);
    if (halo.current) halo.current.scale.setScalar(s * 2.2);
  });
  return (
    <group position={portrait ? [LIGHT_PORTRAIT.x, LIGHT_Y, LIGHT_PORTRAIT.z] : [LIGHT_X, LIGHT_Y, -2]} rotation-x={-Math.PI / 2}>
      <mesh ref={ref}>
        <circleGeometry args={[0.5, 48]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh ref={halo} position-z={-0.01}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} color={color} transparent opacity={0.8} depthWrite={false} blending={AdditiveBlending} fog={false} />
      </mesh>
    </group>
  );
};

// Above you: the night so far, far off — the spiral stair, the whale, a lit
// door, the lamp. What you kept glows in its dream's tint (the lamp lit, if
// you stayed under); the rest are dark cut-outs. Only drawn while you look.
const NIGHT_ABOVE = [
  { id: 'stair', at: [-2, 20, -6] },
  { id: 'whale', at: [5, 24, -9] },
  { id: 'house', at: [7, 17, -3] },
  { id: 'ocean', at: [1, 15, -1] }
];

const Silhouette = ({ id, kept, colors }) => {
  const color = kept ? colors.tints[id] : colors.dark;
  const opacity = kept ? 0.9 : 0.35;
  const m = <meshBasicMaterial color={color} transparent opacity={opacity} fog={false} depthWrite={false} />;
  if (id === 'stair') {
    return (
      <group scale={0.7}>
        <mesh>
          <cylinderGeometry args={[0.25, 0.25, 5, 8]} />
          {m}
        </mesh>
        {Array.from({ length: 16 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * 0.52) * 0.8, -2.2 + i * 0.3, -Math.sin(i * 0.52) * 0.8]} rotation-y={i * 0.52}>
            <boxGeometry args={[1, 0.08, 0.3]} />
            {m}
          </mesh>
        ))}
      </group>
    );
  }
  if (id === 'whale') {
    return (
      <group rotation={[0.3, 0.6, 0]}>
        <mesh scale={[0.9, 0.7, 2.4]}>
          <icosahedronGeometry args={[1, 1]} />
          {m}
        </mesh>
        <mesh position={[0, 0, -2.8]} rotation-x={-Math.PI / 2} scale={[0.9, 1, 0.3]}>
          <coneGeometry args={[0.6, 1, 4]} />
          {m}
        </mesh>
      </group>
    );
  }
  if (id === 'house') {
    return (
      <group>
        {[
          [-0.55, 0, 0.1, 2.2],
          [0.55, 0, 0.1, 2.2],
          [0, 1.05, 1.2, 0.1]
        ].map(([x, y, w, h]) => (
          <mesh key={`${x}${y}`} position={[x, y, 0]}>
            <boxGeometry args={[w, h, 0.1]} />
            {m}
          </mesh>
        ))}
        <mesh>
          <planeGeometry args={[1, 2]} />
          <meshBasicMaterial color={kept ? colors.tints.house : colors.dark} transparent opacity={kept ? 0.7 : 0.2} fog={false} depthWrite={false} side={2} />
        </mesh>
      </group>
    );
  }
  // ocean: the lamp
  return (
    <group scale={1.2}>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.18, 0.38, 0.4, 8, 1, true]} />
        <meshBasicMaterial color={kept ? colors.warm : colors.dark} transparent opacity={kept ? 0.95 : 0.35} fog={false} depthWrite={false} side={2} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[0.03, 0.03, 1.2, 5]} />
        {m}
      </mesh>
    </group>
  );
};

const NightAbove = ({ fall, colors }) => {
  const group = useRef(null);
  const halos = useRef([]);
  const texture = useCloudTexture();
  const recording = useRecording();
  const portrait = useThree(state => state.viewport.aspect < 1);
  useFrame(({ camera }) => {
    const up = fall.current.up;
    if (group.current) group.current.visible = up > 0.01;
    halos.current.forEach(h => h && h.quaternion.copy(camera.quaternion));
  });
  return (
    <group ref={group} visible={false} position-z={portrait ? NIGHT_PORTRAIT_Z : 0}>
      {NIGHT_ABOVE.map(({ id, at }, i) => {
        const kept = isKept(id, recording);
        return (
          <group key={id} position={at}>
            {kept && (
              <mesh
                ref={h => {
                  halos.current[i] = h;
                }}
                scale={7}
              >
                <planeGeometry args={[1, 1]} />
                <meshBasicMaterial map={texture} color={id === 'ocean' ? colors.warm : colors.tints[id]} transparent opacity={0.35} depthWrite={false} blending={AdditiveBlending} fog={false} />
              </mesh>
            )}
            <Silhouette id={id} kept={kept} colors={colors} />
          </group>
        );
      })}
    </group>
  );
};

// Looking down the fall; the pointer steers (moves the camera across X/Z,
// eased) and a tiny tremor keeps it from ever feeling still. Letting go turns
// it up toward the night above, and calms the tremor.
const FallCamera = ({ position, fall }) => {
  const reduced = useReducedMotion();
  const s = useRef({ offset: { x: 0, z: 0 }, down: new Vector3(), upDir: new Vector3(0, 1, -0.35).normalize(), look: new Vector3() });
  useEffect(trackPointer, []);
  useFrame((state, delta) => {
    const k = s.current;
    const up = fall.current.up;
    const o = k.offset;
    const steer = reduced ? 0 : 1 - up;
    easing.damp(o, 'x', pointer.x * STEER * steer, 0.6, delta);
    easing.damp(o, 'z', -pointer.y * STEER * steer, 0.6, delta);
    const t = state.clock.elapsedTime;
    const shake = reduced ? 0 : SHAKE * (1 - up);
    const cam = state.camera;
    cam.position.set(position[0] + o.x + Math.sin(t * 47.3) * shake, position[1] + Math.sin(t * 53.1 + 1.3) * shake, position[2] + o.z);
    k.down.set(o.x * 0.6, -12, o.z * 0.6 - 2).sub(cam.position).normalize();
    k.look.copy(k.down).lerp(k.upDir, up).normalize().add(cam.position);
    cam.lookAt(k.look);
  });
  return null;
};

// The fall's state, stepped once per frame: distance fallen, the rings, the
// fog's pulse, and how far the camera has turned up (`up`, 0-1).
function useFall(progress, live, colors) {
  const reduced = useReducedMotion();
  const fall = useRef({
    distance: 0,
    rings: Array.from({ length: RINGS }, () => ({ alive: false, y: RING_FROM })),
    nextRing: 0,
    sinceRing: 0,
    pulse: 0,
    up: 0,
    upUntil: 0, // DreamAction: looking up until this performance.now()
    lookedUp: false
  });
  const fogBase = useMemo(() => new Color(colors.tint), [colors.tint]);
  const fogAlarm = useMemo(() => new Color(colors.rec), [colors.rec]);

  useEffect(() => {
    if (!live) return undefined;
    return subscribeAction(id => {
      if (id !== 'fall') return;
      markTouched('fall');
      fall.current.upUntil = performance.now() + ACTION_UP_MS;
    });
  }, [live]);

  useFrame(({ scene }, delta) => {
    const f = fall.current;
    const dt = Math.min(delta, 0.1);
    const pace = reduced ? REDUCED_SPEED : 1;
    const p = progress.current;

    // Letting go: still for a while (or the keyboard's "Let go").
    const now = performance.now();
    const still = !pointer.down && now - pointer.stillSince > STILL_FOR_MS;
    const wantUp = live && p < LET_GO_BEFORE && (still || now < f.upUntil);
    easing.damp(f, 'up', wantUp ? 1 : 0, UP_SMOOTH, dt);
    // Turned up far enough to see the night (0.9: the last tenth of the eased
    // turn takes over a second more and changes nothing you see).
    if (!f.lookedUp && f.up > 0.9) {
      f.lookedUp = true;
      trigger('fall', 'let-go');
      keep('fall');
    }

    // The fall itself: faster the deeper, calmer while you look up.
    f.distance += dt * pace * SPEED * (1 + SPEED_GAIN * p) * (1 - 0.6 * f.up);

    // The alarm.
    const every = (RING_EVERY[0] + (RING_EVERY[1] - RING_EVERY[0]) * p) * (reduced ? 4 : 1);
    f.sinceRing += dt;
    if (f.sinceRing >= every) {
      f.sinceRing = 0;
      const ring = f.rings[f.nextRing];
      f.nextRing = (f.nextRing + 1) % RINGS;
      ring.alive = true;
      ring.y = RING_FROM;
      if (p > PULSE_FROM && !reduced) f.pulse = 1;
    }
    f.rings.forEach(ring => {
      if (!ring.alive) return;
      ring.y += RING_RISE * pace * dt;
      if (ring.y > -2) ring.alive = false;
    });
    f.pulse = Math.max(0, f.pulse - dt * 2.5);
    if (scene.fog) {
      const strength = f.pulse * 0.18 * Math.min(1, Math.max(0, (p - PULSE_FROM) / (1 - PULSE_FROM)));
      scene.fog.color.copy(fogBase).lerp(fogAlarm, strength);
    }
  });

  return fall;
}

const FallScene = ({ camera }) => {
  // Listening to the visitor only while this dream is on screen and settled.
  const live = useLive('fall');
  const progress = usePlayProgress('fall');
  const texture = useCloudTexture();
  const points = useColumnPoints(POINTS, 5);
  const lines = useSpeedLines();
  const colors = useMemo(
    () => ({
      tint: readTint('fall'),
      ink: readToken('--ink'),
      rec: readToken('--rec'),
      dark: readToken('--line-strong'),
      warm: readToken('--dream-stair'),
      tints: { stair: readTint('stair'), whale: readTint('whale'), house: readTint('house'), ocean: readTint('tide') },
      surface: readToken('--surface')
    }),
    []
  );
  const fall = useFall(progress, live, colors);
  const lineMaterial = useRef(null);
  useFrame(() => {
    if (lineMaterial.current) lineMaterial.current.opacity = 0.35 + 0.25 * progress.current;
  });
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.05} />
      <FallCamera position={camera.position} fall={fall} />
      <LightBelow progress={progress} color={colors.tint} />
      <Rings fall={fall} color={colors.rec} />
      <Tiled fall={fall} rate={1}>
        <points geometry={points}>
          {/* soft round dots — bare points render as squares, very visibly up close */}
          <pointsMaterial map={texture} color={colors.ink} size={0.09} sizeAttenuation transparent opacity={0.85} depthWrite={false} />
        </points>
      </Tiled>
      <Tiled fall={fall} rate={0.7}>
        <CloudColumn texture={texture} color={colors.ink} />
      </Tiled>
      <Tiled fall={fall} rate={1.6}>
        <lineSegments geometry={lines}>
          <lineBasicMaterial ref={lineMaterial} color={colors.ink} transparent opacity={0.35} depthWrite={false} />
        </lineSegments>
      </Tiled>
      <NightAbove fall={fall} colors={colors} />
    </>
  );
};

export default FallScene;
