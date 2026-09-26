import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';

import { getPlay, markTouched, setLocked, setTarget, subscribeAction, trigger } from '../../night/play';
import { isKept, keep, useRecording } from '../../night/recording';
import { readTint, readToken } from '../../three/materials';
import Atmosphere from '../../three/Atmosphere';
import { seeded } from '../../three/random';
import { useCloudTexture } from '../../three/useCloudTexture';
import { usePlayProgress } from '../../three/usePlayProgress';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';
import { requestNavigate, useLive } from '../stage';

// Dream 05, The Fall (PLAN-2.md 6.5). The scroll is depth, and the only thing
// you do: the fall speeds up, an alarm grows — red rings rising from below,
// and the HUD's REC dot racing — and a white light opens underneath until the
// last melt burns into it. The fall carries you on its own, weaving between
// the rings. Halfway down you're let go of: the camera turns up by itself and
// the whole night is above you, what you kept of it glowing — passing through
// that moment is the fragment.

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
// The fall's own path (no steering: scrolling is all you do — user decision,
// Night 2 phase 7): two slow waves per axis, driven by the distance fallen,
// so the deeper and faster you go, the quicker it weaves.
const WANDER = [
  [1.7, 0.045, 0],
  [0.7, 0.11, 1.3]
];
const WANDER_Z = [
  [1.5, 0.037, 0.6],
  [0.6, 0.093, 2.1]
];
const LOOK_AHEAD = 8; // units: look toward where the path is going
const BANK = 0.9; // roll into the curves, per unit of sideways drift per unit fallen
const BANK_MAX = 0.22; // rad

// The alarm: a ring every 3 s at the top, three a second at the bottom; from
// 0.6 on each one also pulses the fog.
const RINGS = 12;
const RING_EVERY = [3, 1 / 3];
const RING_RISE = 14; // units/s
const RING_FROM = -38;
const RING_PAST = 3; // units above your eyes where a ring you've fallen through is gone
const RING_SIZE = [2.2, 0.035]; // radius at the bottom, growth per unit risen (≈3.6 at your eyes)
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

// Letting go: a stretch of the scroll where the camera turns up by itself —
// in from 0.4 to 0.5, all the way up until 0.62, back down by 0.72. The
// arrow keys' 0.5 stop lands in it; a wheel passing through turns up on the
// way. The fragment is kept the first time the turn passes 0.9.
const UP_IN = [0.4, 0.5];
const UP_OUT = [0.62, 0.72];
const LET_GO_AT = 0.55; // "Let go" from the keyboard scrolls here

// Losing control (user decision, Night 2 phase 7): past the last stop the
// fall carries you to the bottom by itself — accelerating over AUTO_S — and,
// a beat later, into Wake.
const AUTO_FROM = 0.75;
const AUTO_S = 4;
const AUTO_HOLD_S = 0.3;
const smoothstep = (a, b, x) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};
const upAt = p => smoothstep(UP_IN[0], UP_IN[1], p) * (1 - smoothstep(UP_OUT[0], UP_OUT[1], p));

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

// The alarm's rings, rising from below — each centred on where the camera
// will be when it reaches its height, so you fall straight through the middle
// of every one, and it sweeps past the edges of the view as you do.
const Rings = ({ fall, position, color }) => {
  const meshes = useRef([]);
  useFrame(() => {
    const { distance, speed, amp, rings } = fall.current;
    rings.forEach((ring, i) => {
      const m = meshes.current[i];
      if (!m) return;
      m.visible = ring.alive;
      if (!ring.alive) return;
      // Where you'll have fallen to when this ring reaches your eyes.
      const arrive = distance + (speed * (position[1] - ring.y)) / RING_RISE;
      m.position.set(position[0] + wave(WANDER, arrive) * amp, ring.y, position[2] + wave(WANDER_Z, arrive) * amp);
      const s = RING_SIZE[0] + (ring.y - RING_FROM) * RING_SIZE[1];
      m.scale.set(s, s, 1);
      const fadeIn = Math.min(1, (ring.y - RING_FROM) / 6);
      const fadeOut = 1 - Math.min(1, Math.max(0, (ring.y - (position[1] - 1)) / 4));
      m.material.opacity = 0.7 * fadeIn * fadeOut;
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

// Where the fall's own path is, `d` units down.
const wave = (terms, d) => terms.reduce((sum, [amp, freq, phase]) => sum + amp * Math.sin(freq * d + phase), 0);

// Looking down the fall, carried along a path that weaves between the rings
// and leans into its curves, with a tiny tremor so it never feels still.
// Letting go turns it up toward the night above, and calms it all.
const FallCamera = ({ position, fall }) => {
  const reduced = useReducedMotion();
  const s = useRef({ down: new Vector3(), upDir: new Vector3(0, 1, -0.35).normalize(), look: new Vector3(), roll: 0 });
  useFrame((state, delta) => {
    const k = s.current;
    const { up, distance: d, amp } = fall.current;
    const calm = 1 - up;
    const x = wave(WANDER, d) * amp;
    const z = wave(WANDER_Z, d) * amp;
    const aheadX = wave(WANDER, d + LOOK_AHEAD) * amp;
    const aheadZ = wave(WANDER_Z, d + LOOK_AHEAD) * amp;
    const t = state.clock.elapsedTime;
    const shake = reduced ? 0 : SHAKE * calm;
    const cam = state.camera;
    cam.position.set(position[0] + x + Math.sin(t * 47.3) * shake, position[1] + Math.sin(t * 53.1 + 1.3) * shake, position[2] + z);
    // Nearly straight down your own column (leaning toward where the path
    // goes), so the rings below you sit in the middle of the view.
    k.down.set(position[0] + aheadX, position[1] - 14, position[2] + aheadZ - 1.5).sub(cam.position).normalize();
    k.look.copy(k.down).lerp(k.upDir, up).normalize().add(cam.position);
    cam.lookAt(k.look);
    // Bank into the curve: roll with the path's sideways drift ahead.
    const goal = reduced ? 0 : Math.max(-BANK_MAX, Math.min(BANK_MAX, ((aheadX - x) / LOOK_AHEAD) * BANK)) * calm;
    k.roll += (goal - k.roll) * Math.min(1, delta * 2);
    cam.rotateZ(k.roll);
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
    speed: SPEED, // units/s the fall is going now (the rings need it)
    amp: 1, // how wide the path weaves now (the camera and the rings share it)
    last: null, // the fall's target last frame, to see it cross AUTO_FROM
    auto: null // { t, from, sent } while the fall carries you in by itself
  });
  const fogBase = useMemo(() => new Color(colors.tint), [colors.tint]);
  const fogAlarm = useMemo(() => new Color(colors.rec), [colors.rec]);

  // "Let go" from the keyboard: scroll to the moment it happens.
  useEffect(() => {
    if (!live) return undefined;
    return subscribeAction(id => {
      if (id !== 'fall') return;
      markTouched('fall');
      setTarget('fall', LET_GO_AT);
    });
  }, [live]);

  useFrame(({ scene }, delta) => {
    const f = fall.current;
    const dt = Math.min(delta, 0.1);
    const pace = reduced ? REDUCED_SPEED : 1;
    const p = progress.current;

    // Letting go: the camera turns up by itself in the middle of the fall.
    f.up = upAt(p);
    // Asked of the recording, not a local flag, so a new night (REPLAY, or
    // ?debug's reset) can keep it again without remounting the scene.
    if (live && f.up > 0.9 && !isKept('fall')) {
      trigger('fall', 'let-go');
      keep('fall');
    }

    // The fall itself: faster the deeper, calmer while you look up; the path
    // weaves less while you look up, and far less under reduced motion.
    f.speed = pace * SPEED * (1 + SPEED_GAIN * p) * (1 - 0.6 * f.up);
    f.distance += dt * f.speed;
    f.amp = (reduced ? 0.3 : 1) * (1 - f.up);

    // The last stretch: cross AUTO_FROM going down and you lose control —
    // the fall takes the scroll, speeds you to the bottom and on into Wake.
    // (Not when you arrive already past it, coming back from Wake.)
    const entry = getPlay('fall');
    if (!live) {
      f.last = null;
      f.auto = null;
      if (entry.locked) setLocked('fall', false);
    } else {
      if (!f.auto && f.last !== null && f.last < AUTO_FROM - 1e-3 && entry.target >= AUTO_FROM - 1e-3) {
        f.auto = { t: 0, from: entry.target, sent: false };
        setLocked('fall', true);
      }
      f.last = entry.target;
      if (f.auto) {
        const a = f.auto;
        a.t += dt;
        const k = Math.min(1, a.t / AUTO_S);
        setTarget('fall', a.from + (1 - a.from) * k * k);
        f.last = entry.target;
        if (k >= 1 && !a.sent && a.t >= AUTO_S + AUTO_HOLD_S) {
          a.sent = true;
          requestNavigate('wake');
        }
      }
    }

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
      // Gone once you've fallen through it (the camera's eyes are at y 2).
      if (ring.y > 2 + RING_PAST) ring.alive = false;
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
      <Rings fall={fall} position={camera.position} color={colors.rec} />
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
