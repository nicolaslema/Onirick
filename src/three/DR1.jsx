import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';
import { easing } from 'maath';

import { FLAT, readToken } from './materials';
import { REDUCED_SPEED, useReducedMotion } from './useReducedMotion';

// The DR-1: 142 × 96 × 38 mm, 1 unit = 100 mm. Front (+z) carries the
// cassette window, the REC LED and the dial; the two keys sit on top.
const W = 1.42;
const H = 0.96;
const D = 0.38;
const FRONT = D / 2;

const WINDOW = { x: -0.14, y: 0.02, w: 0.9, h: 0.5 };
const REEL_OFFSET = 0.22;
const REEL_SPEED = 0.6; // rad/s — "carretes que giran lento"
const BLINK_HALF_PERIOD = 0.6; // s — same 1.2s steps(2) cycle as the HUD's REC dot
const KEY_TRAVEL = 0.025;

function useDeviceColors() {
  return useMemo(
    () => ({
      bone: readToken('--ink'),
      boneShade: readToken('--ink-muted'),
      dark: readToken('--surface-raised'),
      line: readToken('--line'),
      lineStrong: readToken('--line-strong'),
      rec: readToken('--rec'),
      surface: readToken('--surface')
    }),
    []
  );
}

const Reel = ({ x, spinning, colors }) => {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  useFrame((_, delta) => {
    if (!spinning || !ref.current) return;
    ref.current.rotation.z -= delta * REEL_SPEED * (reduced ? REDUCED_SPEED : 1);
  });
  return (
    <group ref={ref} position={[WINDOW.x + x, WINDOW.y, FRONT + 0.012]}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.13, 0.13, 0.012, 14]} />
        <meshStandardMaterial {...FLAT} color={colors.line} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position-z={0.01}>
        <cylinderGeometry args={[0.05, 0.05, 0.014, 6]} />
        <meshStandardMaterial {...FLAT} color={colors.bone} />
      </mesh>
      {[0, 1, 2].map(i => (
        <mesh key={i} rotation-z={(i * Math.PI) / 3} position-z={0.009}>
          <boxGeometry args={[0.22, 0.016, 0.008]} />
          <meshStandardMaterial {...FLAT} color={colors.boneShade} />
        </mesh>
      ))}
    </group>
  );
};

const RecLed = ({ blinking, colors }) => {
  const material = useRef(null);
  const reduced = useReducedMotion();
  useFrame(state => {
    if (!material.current) return;
    const on = !blinking || reduced || Math.floor(state.clock.elapsedTime / BLINK_HALF_PERIOD) % 2 === 0;
    material.current.emissiveIntensity = blinking ? (on ? 1.6 : 0.4) : 0;
  });
  return (
    <mesh position={[0.52, 0.3, FRONT + 0.01]}>
      <sphereGeometry args={[0.03, 8, 6]} />
      <meshStandardMaterial ref={material} {...FLAT} color={colors.rec} emissive={colors.rec} />
    </mesh>
  );
};

const Key = ({ x, colors }) => {
  const ref = useRef(null);
  const hovered = useRef(false);
  const restY = H / 2 + 0.03;
  useFrame((_, delta) => {
    if (ref.current) easing.damp(ref.current.position, 'y', hovered.current ? restY - KEY_TRAVEL : restY, 0.08, delta);
  });
  return (
    <mesh
      ref={ref}
      position={[x, restY, 0.03]}
      onPointerOver={e => {
        e.stopPropagation();
        hovered.current = true;
      }}
      onPointerOut={() => {
        hovered.current = false;
      }}
    >
      <boxGeometry args={[0.2, 0.06, 0.14]} />
      <meshStandardMaterial {...FLAT} color={colors.boneShade} />
    </mesh>
  );
};

function useTapeLabel(text, colors) {
  const invalidate = useThree(state => state.invalidate);
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);

  useEffect(() => {
    let alive = true;
    const font = '500 56px "JetBrains Mono"';
    document.fonts.load(font).then(() => {
      if (!alive) return;
      const ctx = texture.image.getContext('2d');
      ctx.fillStyle = colors.bone;
      ctx.fillRect(0, 0, 512, 128);
      ctx.font = font;
      ctx.letterSpacing = '0.12em';
      ctx.fillStyle = colors.surface;
      ctx.textBaseline = 'middle';
      ctx.fillText(text.toUpperCase(), 36, 68);
      texture.needsUpdate = true;
      invalidate();
    });
    return () => {
      alive = false;
    };
  }, [texture, text, colors, invalidate]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

// Half out of a slot on the top face — Wake's "cinta expulsada".
const EjectedCassette = ({ label, colors }) => {
  const labelTexture = useTapeLabel(label, colors);
  return (
    <group position={[WINDOW.x, H / 2 + 0.12, 0]} rotation-z={0.06}>
      <mesh>
        <boxGeometry args={[0.72, 0.44, 0.08]} />
        <meshStandardMaterial {...FLAT} color={colors.dark} />
      </mesh>
      <mesh position={[0, 0.1, 0.041]}>
        <planeGeometry args={[0.58, 0.145]} />
        <meshStandardMaterial map={labelTexture} roughness={0.9} metalness={0} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * 0.16, -0.08, 0.041]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.045, 0.045, 0.002, 6]} />
          <meshStandardMaterial {...FLAT} color={colors.line} />
        </mesh>
      ))}
    </group>
  );
};

const DR1 = ({ recording = true, ejected = false, tapeLabel = 'Tape 05', ...props }) => {
  const colors = useDeviceColors();
  return (
    <group {...props}>
      <RoundedBox args={[W, H, D]} radius={0.05} smoothness={2}>
        <meshStandardMaterial {...FLAT} color={colors.bone} />
      </RoundedBox>

      <mesh position={[WINDOW.x, WINDOW.y, FRONT + 0.002]}>
        <planeGeometry args={[WINDOW.w, WINDOW.h]} />
        <meshStandardMaterial {...FLAT} color={colors.dark} />
      </mesh>
      {!ejected && (
        <>
          <Reel x={-REEL_OFFSET} spinning={recording} colors={colors} />
          <Reel x={REEL_OFFSET} spinning={recording} colors={colors} />
        </>
      )}

      <RecLed blinking={recording} colors={colors} />

      <group position={[0.52, -0.12, FRONT + 0.025]}>
        <mesh rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.1, 0.1, 0.05, 12]} />
          <meshStandardMaterial {...FLAT} color={colors.lineStrong} />
        </mesh>
        <mesh position={[0, 0.065, 0.026]}>
          <boxGeometry args={[0.014, 0.05, 0.004]} />
          <meshStandardMaterial {...FLAT} color={colors.bone} />
        </mesh>
      </group>

      <Key x={0.2} colors={colors} />
      <Key x={0.46} colors={colors} />

      <mesh position={[WINDOW.x, H / 2 + 0.001, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[0.8, 0.1]} />
        <meshStandardMaterial {...FLAT} color={colors.dark} />
      </mesh>
      {ejected && <EjectedCassette label={tapeLabel} colors={colors} />}
    </group>
  );
};

export default DR1;
