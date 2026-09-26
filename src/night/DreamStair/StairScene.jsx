import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { AdditiveBlending, CanvasTexture, Object3D, Quaternion, Vector3 } from 'three';

import { markTouched, subscribeAction } from '../../night/play';
import { keep } from '../../night/recording';
import Atmosphere from '../../three/Atmosphere';
import { FLAT, readTint, readToken } from '../../three/materials';
import { onHold } from '../../three/pointer';
import { useCameraDrift } from '../../three/useCameraDrift';
import { usePlayProgress } from '../../three/usePlayProgress';
import { REDUCED_SPEED, useReducedMotion } from '../../three/useReducedMotion';
import { useLive } from '../stage';

// Dream 01, The Staircase (PLAN-2.md 6.1). You climb without stopping and
// stay where you are: the stair turns and sinks like a screw at exactly the
// pace of your steps. Hold, and you stop — the stair doesn't, and carries you
// down. The scroll moves the moon around the stair; it's the only real light,
// and its shadows turn with it like a sundial's.

const STEPS = 120;
const PER_TURN = 24;
const RISE = 0.18;
const STEP_RADIUS = 1.25; // step center, from the axis
const BOTTOM = -4;
const WINDOW_EVERY = 12; // one landing: half a turn
const WINDOW_RADIUS = 2.45;
const TREAD = 0.06; // half a step's thickness: the tread's top

const STEP_ANGLE = (Math.PI * 2) / PER_TURN;
const stepAngle = i => i * STEP_ANGLE;
const stepY = i => BOTTOM + i * RISE;

// The screw: one step every T_STEP seconds. The geometry repeats every
// landing, so the stair's own turn wraps every WINDOW_EVERY steps unseen.
const T_STEP = 2;
// Where you are: the step at HOME_INDEX, turned to HOME_ANGLE (a little right
// of front, so the column doesn't hide you and you stand above the title).
const HOME_INDEX = 44;
const HOME_ANGLE = -Math.PI / 2 + 0.7;
const HOME_Y = stepY(HOME_INDEX) + TREAD;

// Stopping and catching up (PLAN-2.md 6.1): `s` is how many steps you are
// ahead of (+) or behind (−) your place, in the stair's own frame.
const CATCH_UP = 1.8; // cadence while climbing back
const CATCH_UP_FAR = 3; // ...when more than a landing behind
const S_FLOOR = -36; // three landings down: deep in the fog
// The fragment: stay stopped this long (user decision, Night 2 phase 6 — it
// used to wait for the figure to climb back after being carried 2 steps,
// which took too long and was easy to miss). Real seconds, not scene time.
const HOLD_FOR_S = 5;
// DreamAction: stop this long, then let go — just past HOLD_FOR_S.
const ACTION_HOLD_MS = 5500;

// The figure (you), in a stair-relative frame: x lateral (inward), y up, z
// along the climb. About 1.6 tall on 0.18 risers.
const HIP = 0.86;
const THIGH = 0.44;
const SHIN = 0.44;
const HIP_OFFSET = 0.1;
const FOOT_LIFT = 0.16;

// Where a point `rel` steps from your place sits in the world, at `radius`.
function onStair(rel, radius, out) {
  const a = HOME_ANGLE + rel * STEP_ANGLE;
  return out.set(Math.cos(a) * radius, HOME_Y + rel * RISE, -Math.sin(a) * radius);
}

// Feet over one stride (two steps), phase u in [0, 2): each foot is planted
// for one step and swings two steps ahead during the other. The even foot is
// planted on the stride's first step, then swings to its third; the odd one
// swings from the step behind to the second, then stays. Returns the foot's
// index relative to the stride start and how far into its swing it is.
function footAt(u, even) {
  if (even) return u < 1 ? { index: 0, swing: 0 } : { index: 2 * (u - 1), swing: u - 1 };
  return u < 1 ? { index: -1 + 2 * u, swing: u } : { index: 1, swing: 0 };
}

const Steps = ({ color }) => {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    for (let i = 0; i < STEPS; i++) {
      dummy.position.set(0, stepY(i), 0);
      dummy.rotation.set(0, stepAngle(i), 0);
      dummy.translateX(STEP_RADIUS);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={ref} args={[null, null, STEPS]} castShadow receiveShadow>
      <boxGeometry args={[1.6, 0.12, 0.42]} />
      <meshStandardMaterial {...FLAT} color={color} />
    </instancedMesh>
  );
};

// "Every landing has the same window" — an empty frame now: the moon is its
// own light, orbiting the stair (the Moon below), seen through them.
const LandingWindow = ({ index, frameColor }) => {
  const a = stepAngle(index);
  const position = [Math.cos(a) * WINDOW_RADIUS, stepY(index) + 0.9, -Math.sin(a) * WINDOW_RADIUS];
  const bar = (w, h, x, y) => (
    <mesh position={[x, y, 0]} castShadow>
      <boxGeometry args={[w, h, 0.08]} />
      <meshStandardMaterial {...FLAT} color={frameColor} />
    </mesh>
  );
  return (
    <group position={position} rotation-y={a + Math.PI / 2}>
      {bar(0.9, 0.08, 0, 0.6)}
      {bar(0.9, 0.08, 0, -0.6)}
      {bar(0.08, 1.28, -0.45, 0)}
      {bar(0.08, 1.28, 0.45, 0)}
      {bar(0.04, 1.2, 0, 0)}
    </group>
  );
};

const Staircase = ({ climb, colors }) => {
  const ref = useRef(null);
  const windows = useMemo(() => Array.from({ length: STEPS / WINDOW_EVERY }, (_, k) => k * WINDOW_EVERY + WINDOW_EVERY / 2), []);
  useFrame(() => {
    if (!ref.current) return;
    const wrapped = climb.current.n % WINDOW_EVERY;
    // Step HOME_INDEX + wrapped sits at your place: same angle, same height.
    ref.current.rotation.y = HOME_ANGLE - (HOME_INDEX + wrapped) * STEP_ANGLE;
    ref.current.position.y = -wrapped * RISE;
  });
  return (
    <group ref={ref}>
      <mesh position={[0, BOTTOM + (STEPS * RISE) / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, STEPS * RISE + 2, 10]} />
        <meshStandardMaterial {...FLAT} color={colors.column} />
      </mesh>
      <Steps color={colors.step} />
      {windows.map(i => (
        <LandingWindow key={i} index={i} frameColor={colors.frame} />
      ))}
    </group>
  );
};

const Y = new Vector3(0, 1, 0);

// One bone (a box) between two points in the figure's frame.
function placeBone(mesh, from, to, mid, dir, q) {
  dir.subVectors(to, from);
  const length = dir.length();
  mid.addVectors(from, to).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.copy(q.setFromUnitVectors(Y, dir.normalize()));
  mesh.scale.set(1, length, 1);
}

// You. Legs are thigh + shin with a knee (two-bone IK toward each foot's spot
// on the stair); arms swing against the legs.
const Figure = ({ climb, color }) => {
  const root = useRef(null);
  const torso = useRef(null);
  const armL = useRef(null);
  const armR = useRef(null);
  const legs = useRef([]); // thigh, shin, thigh, shin
  const scratch = useMemo(
    () => ({
      body: new Vector3(),
      foot: new Vector3(),
      hip: new Vector3(),
      knee: new Vector3(),
      u: new Vector3(),
      n: new Vector3(),
      fwd: new Vector3(0, 0, 1),
      mid: new Vector3(),
      dir: new Vector3(),
      q: new Quaternion()
    }),
    []
  );

  useFrame(() => {
    const r = root.current;
    if (!r) return;
    const { s, u } = climb.current;
    const { body, foot, hip, knee, n, fwd, mid, dir, q } = scratch;

    // The body stands half a step behind the stride's lead.
    const bodyRel = s - 0.5;
    onStair(bodyRel, STEP_RADIUS, body);
    r.position.copy(body);
    r.rotation.set(0, HOME_ANGLE + bodyRel * STEP_ANGLE + Math.PI, 0);
    r.updateMatrixWorld();

    const bob = 0.025 * Math.abs(Math.sin(Math.PI * u));
    torso.current.position.y = HIP + 0.3 + bob;
    const swing = Math.sin(Math.PI * u) * 0.35;
    armL.current.rotation.x = swing;
    armR.current.rotation.x = -swing;

    [true, false].forEach((even, k) => {
      const f = footAt(u, even);
      // The stride started at s - u; the foot's own spot, on the stair.
      const rel = s - u + f.index;
      const side = even ? 1 : -1;
      onStair(rel, STEP_RADIUS + side * -HIP_OFFSET, foot);
      foot.y += Math.sin(Math.PI * f.swing) * FOOT_LIFT;
      r.worldToLocal(foot);
      hip.set(side * HIP_OFFSET, HIP + bob, 0);
      // Two-bone IK: the knee bends forward.
      const d = Math.min(Math.max(hip.distanceTo(foot), 0.05), THIGH + SHIN - 1e-3);
      scratch.u.subVectors(foot, hip).normalize();
      const along = (THIGH * THIGH - SHIN * SHIN + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(THIGH * THIGH - along * along, 0));
      n.copy(fwd).addScaledVector(scratch.u, -fwd.dot(scratch.u)).normalize();
      knee.copy(hip).addScaledVector(scratch.u, along).addScaledVector(n, h);
      foot.copy(hip).addScaledVector(scratch.u, d);
      placeBone(legs.current[k * 2], hip, knee, mid, dir, q);
      placeBone(legs.current[k * 2 + 1], knee, foot, mid, dir, q);
    });
  });

  const material = <meshStandardMaterial {...FLAT} color={color} />;
  const limb = w => <boxGeometry args={[w, 1, w]} />;
  return (
    <group ref={root}>
      <group ref={torso}>
        <mesh castShadow>
          <boxGeometry args={[0.34, 0.56, 0.2]} />
          {material}
        </mesh>
        <mesh position={[0, 0.44, 0]} castShadow>
          <icosahedronGeometry args={[0.13, 0]} />
          {material}
        </mesh>
        {[
          [armL, 0.22],
          [armR, -0.22]
        ].map(([ref, x]) => (
          <group key={x} ref={ref} position={[x, 0.24, 0]}>
            <mesh position={[0, -0.26, 0]} castShadow>
              <boxGeometry args={[0.08, 0.52, 0.08]} />
              {material}
            </mesh>
          </group>
        ))}
      </group>
      {[0, 1, 2, 3].map(i => (
        <mesh
          key={i}
          ref={el => {
            legs.current[i] = el;
          }}
          castShadow
        >
          {limb(i % 2 ? 0.09 : 0.11)}
          {material}
        </mesh>
      ))}
    </group>
  );
};

// The moon: a disc of light with a halo, on an ellipse wider than the frame
// so it leaves it at the sides. It's the scene's one real light, and casts
// the shadows (PLAN-2.md 6.1).
const MOON_TURNS = 1.25;
// Back-right and high on entry: in view, and clear of the title and log,
// which fill the lower left.
const MOON_START = Math.PI * 1.75;
const MOON_Y = [4.5, 7];
const MOON_RX = 7;
const MOON_RZ = 4.5;

function useHaloTexture() {
  const texture = useMemo(() => {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

const Moon = ({ progress, color }) => {
  const group = useRef(null);
  const halo = useRef(null);
  const light = useRef(null);
  const texture = useHaloTexture();
  const mapSize = useThree(state => (state.size.width < 700 ? 512 : 1024));
  useLayoutEffect(() => {
    const l = light.current;
    l.target.position.set(0, HOME_Y + 0.8, 0);
    l.target.updateMatrixWorld();
    l.shadow.mapSize.set(mapSize, mapSize);
    l.shadow.map?.dispose();
    l.shadow.map = null;
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.03;
    l.shadow.camera.near = 1;
    l.shadow.camera.far = 22;
  }, [mapSize]);
  useFrame(({ camera }) => {
    const p = progress.current;
    const a = MOON_START + p * MOON_TURNS * Math.PI * 2;
    group.current.position.set(Math.cos(a) * MOON_RX, MOON_Y[0] + p * (MOON_Y[1] - MOON_Y[0]), Math.sin(a) * MOON_RZ);
    halo.current.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[0.35, 16, 12]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh ref={halo} scale={2.6}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={texture} color={color} transparent depthWrite={false} blending={AdditiveBlending} fog={false} />
      </mesh>
      <spotLight ref={light} color={color} intensity={42} distance={0} decay={1.4} angle={0.95} penumbra={0.5} castShadow />
    </group>
  );
};

// The climb's clock: `n` steps the stair has turned, `s` where you are
// relative to your place, `u` your stride phase (0-2). Stop, carry, catch up.
// `held`: seconds stopped in a row — HOLD_FOR_S of them keeps the fragment.
function useClimb(live) {
  const reduced = useReducedMotion();
  const climb = useRef({ n: 0, s: 0, u: 0, cadence: 1, stopping: false, held: 0 });
  const stopTimer = useRef(0);

  useEffect(() => {
    if (!live) return undefined;
    const c = climb.current;
    const stop = () => {
      markTouched('stair');
      c.stopping = true;
    };
    const go = () => {
      c.stopping = false;
      c.held = 0;
    };
    const offHold = onHold({ delay: 250, tolerance: 10 }, { start: stop, end: go });
    const offAction = subscribeAction(id => {
      if (id !== 'stair') return;
      stop();
      clearTimeout(stopTimer.current);
      stopTimer.current = setTimeout(go, ACTION_HOLD_MS);
    });
    return () => {
      offHold();
      offAction();
      clearTimeout(stopTimer.current);
      go();
    };
  }, [live]);

  useFrame((_, delta) => {
    const c = climb.current;
    const dt = (Math.min(delta, 0.1) * (reduced ? REDUCED_SPEED : 1)) / T_STEP;
    c.n += dt;

    if (c.stopping) {
      // Stopped long enough, and the stairs kept going: that's the fragment.
      c.held += Math.min(delta, 0.1);
      if (c.held >= HOLD_FOR_S) keep('stair');
      // Finish the step under way, then stand.
      if (c.cadence > 0) {
        const next = c.u + dt * c.cadence;
        if (Math.floor(next) > Math.floor(c.u)) {
          c.u = Math.floor(next) % 2;
          c.cadence = 0;
        } else c.u = next;
        c.s += dt * (c.cadence - 1);
      } else c.s += -dt;
    } else {
      // Behind your place at all: climbing back, until you're there.
      const catchingUp = c.s < 0;
      c.cadence = catchingUp ? (c.s < -12 ? CATCH_UP_FAR : CATCH_UP) : 1;
      c.u = (c.u + dt * c.cadence) % 2;
      c.s += dt * (c.cadence - 1);
      if (catchingUp && c.s >= -1e-4) {
        c.s = 0;
        c.cadence = 1;
      }
    }
    c.s = Math.max(c.s, S_FLOOR);
  });

  return climb;
}

const StairScene = ({ camera }) => {
  // Listening to the visitor only while this dream is on screen and settled.
  const live = useLive('stair');
  const progress = usePlayProgress('stair');
  useCameraDrift({ position: camera.position, target: [0, 4.4, 0] });
  const climb = useClimb(live);
  const colors = useMemo(
    () => ({
      tint: readTint('stair'),
      step: readToken('--ink-muted'),
      column: readToken('--line-strong'),
      frame: readToken('--line-strong'),
      moon: readToken('--ink'),
      figure: readToken('--ink-muted'),
      surface: readToken('--surface')
    }),
    []
  );
  return (
    <>
      <Atmosphere tint={colors.tint} density={0.07} />
      {/* The tint's light is only a remnant now: the moon lights the stair. */}
      <hemisphereLight args={[colors.tint, colors.surface, 0.07]} />
      <directionalLight position={[3, 10, 4]} intensity={0.35} color={colors.tint} />
      <Staircase climb={climb} colors={colors} />
      <Figure climb={climb} color={colors.figure} />
      <Moon progress={progress} color={colors.moon} />
    </>
  );
};

export default StairScene;
