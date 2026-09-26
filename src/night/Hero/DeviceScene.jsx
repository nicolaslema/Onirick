import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { easing } from 'maath';

import Atmosphere from '../../three/Atmosphere';
import DR1 from '../../three/DR1';
import { readToken } from '../../three/materials';
import { pointer, trackPointer } from '../../three/pointer';
import { useCameraDrift } from '../../three/useCameraDrift';
import { useReducedMotion } from '../../three/useReducedMotion';

// Landscape: center-right, ~20° turned toward the copy on the left —
// relative to the line of sight: sitting center-right, the camera already
// sees it from ~19° to its left, so -20° alone would read as square-on.
const LANDSCAPE_YAW = -0.68;
// Portrait: centered, so the plain ~20°.
const PORTRAIT_YAW = -0.35;
const TILT = 0.14; // ±8° with the pointer (PLAN.md 6.0)

// Portrait: the device sits in the band between the bottom of the HUD's top
// corners and the top of the copy (which Hero.css anchors to the bottom
// there), sized to fit it. Both edges are measured from the live DOM, so it
// holds on any phone height and after the web fonts reflow the copy. On a
// screen too short to leave a usable band it isn't drawn at all rather than
// overlap the HUD or the copy.
const BAND_GAP_PX = 8; // --space-2 clear of the HUD and of the copy
const DEVICE_HEIGHT = 1.25; // body + keys + tilt, in device units
const DEVICE_WIDTH = 1.5;
const MIN_SCALE = 0.15; // any smaller and it no longer reads as the DR-1

function useBand(enabled) {
  const gl = useThree(state => state.gl);
  const [band, setBand] = useState(null);
  useLayoutEffect(() => {
    if (!enabled) return undefined;
    const content = gl.domElement.closest('section')?.querySelector('.night-hero-content');
    if (!content) return undefined;
    // Both top corners: the left one also holds the sound toggle (PLAN-3.md
    // 3.6), 44px tall on a phone, so it can end lower than the right one.
    const corners = [...document.querySelectorAll('.onk-hud-tl, .onk-hud-tr')];
    const measure = () => {
      const hud = corners.length ? Math.max(...corners.map(corner => corner.getBoundingClientRect().bottom)) : 70;
      // offsetTop: layout position, unaffected by the copy's entrance transform
      setBand({ top: hud + BAND_GAP_PX, bottom: content.offsetTop - BAND_GAP_PX });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(content);
    corners.forEach(corner => ro.observe(corner));
    return () => ro.disconnect();
  }, [enabled, gl]);
  return band;
}

function useDeviceLayout() {
  const viewport = useThree(state => state.viewport);
  const size = useThree(state => state.size);
  const portrait = viewport.aspect < 1;
  const band = useBand(portrait);
  if (!portrait) return { position: [Math.min(viewport.width * 0.2, 1.6), -0.05, 0], scale: 1, yaw: LANDSCAPE_YAW };
  // not measured yet (first frame): hidden rather than drawn somewhere wrong
  if (!band) return { position: [0, 0, 0], scale: 0, yaw: PORTRAIT_YAW };

  const unitsPerPx = viewport.height / size.height;
  const bandPx = Math.max(band.bottom - band.top, 0);
  const centerPx = band.top + bandPx / 2;
  const fitHeight = (bandPx * unitsPerPx) / DEVICE_HEIGHT;
  const fitWidth = (viewport.width * 0.8) / DEVICE_WIDTH;
  const scale = Math.min(fitHeight, fitWidth, 0.75);
  return {
    position: [0, (size.height / 2 - centerPx) * unitsPerPx, 0],
    scale: scale < MIN_SCALE ? 0 : scale,
    yaw: PORTRAIT_YAW
  };
}

const TiltingDevice = () => {
  const ref = useRef(null);
  const reduced = useReducedMotion();
  const layout = useDeviceLayout();
  useEffect(trackPointer, []);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const yaw = layout.yaw;
    const goal = reduced ? [0.12, yaw, 0] : [0.12 - pointer.y * TILT, yaw + pointer.x * TILT, 0];
    easing.dampE(ref.current.rotation, goal, 0.35, delta);
  });
  return (
    <group position={layout.position} scale={layout.scale}>
      <group ref={ref} rotation={[0.12, layout.yaw, 0]}>
        <DR1 recording />
      </group>
    </group>
  );
};

const DeviceScene = ({ camera }) => {
  useCameraDrift({ position: camera.position });
  const light = useMemo(() => readToken('--ink'), []);
  const ground = useMemo(() => readToken('--surface'), []);
  return (
    <>
      <Atmosphere density={0.06} />
      <hemisphereLight args={[light, ground, 0.35]} />
      <directionalLight position={[2.5, 3, 4]} intensity={2} color={light} />
      <TiltingDevice />
    </>
  );
};

export default DeviceScene;
