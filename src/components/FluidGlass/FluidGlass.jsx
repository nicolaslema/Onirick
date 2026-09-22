/* eslint-disable react/no-unknown-property */
// Adapted from the React Bits FluidGlass component to run as a page-wide overlay
// without the .glb model assets: the lens/bar/cube glass shapes use native Three.js
// primitive geometry (sphere/box) instead of loaded GLTF models, and the scroll-driven
// gallery/ScrollControls were replaced with static content so it doesn't hijack page
// scrolling when rendered across the whole app.
import * as THREE from 'three';
import { useRef, useState, useEffect, useMemo, memo } from 'react';
import { Canvas, createPortal, useFrame, useThree } from '@react-three/fiber';
import { useFBO, Image, Preload, MeshTransmissionMaterial, Text } from '@react-three/drei';
import { easing } from 'maath';

import './FluidGlass.css';
import kingfisherImg from '../../assets/Slider/animals-birds-kingfisher-low-poly-wallpaper-790078ad012a3d8b1677f8bfe081d6dd.jpg';
import digitalArtImg from '../../assets/Slider/digital-digital-art-artwork-painting-drawing-hd-wallpaper-f4f3c52c24b9b5c33430781cded1b351.jpg';
import pixelArtImg from '../../assets/Slider/artistic-pixel-art-8-bit-wallpaper-5930082d711aed1bd6f7f82fd021962d.jpg';

const IMAGE_URLS = [kingfisherImg, digitalArtImg, pixelArtImg];

export default function FluidGlass({
  mode = 'lens',
  lensProps = {},
  barProps = {},
  cubeProps = {},
  backgroundColor = '#120F17',
  textColor = '#ffffff'
}) {
  const Wrapper = mode === 'bar' ? Bar : mode === 'cube' ? Cube : Lens;
  const rawOverrides = mode === 'bar' ? barProps : mode === 'cube' ? cubeProps : lensProps;

  const {
    navItems = [
      { label: 'Home', link: '' },
      { label: 'About', link: '' },
      { label: 'Contact', link: '' }
    ],
    ...modeProps
  } = rawOverrides;

  return (
    <div className="fluid-glass-page">
      <Canvas
        camera={{ position: [0, 0, 20], fov: 15 }}
        gl={{ alpha: true, toneMapping: THREE.NoToneMapping }}
        eventSource={typeof document !== 'undefined' ? document.body : undefined}
        eventPrefix="client"
      >
        {mode === 'bar' && <NavItems items={navItems} textColor={textColor} />}
        <Wrapper modeProps={modeProps} backgroundColor={backgroundColor}>
          <Typography textColor={textColor} />
          <Images />
        </Wrapper>
        <Preload />
      </Canvas>
    </div>
  );
}

const ModeWrapper = memo(function ModeWrapper({
  children,
  geometry,
  lockToBottom = false,
  followPointer = true,
  modeProps = {},
  backgroundColor = '#120F17',
  ...props
}) {
  const ref = useRef();
  const buffer = useFBO();
  const { viewport: vp } = useThree();
  const [scene] = useState(() => new THREE.Scene());
  const geoWidthRef = useRef(1);

  useEffect(() => {
    if (!geometry) return;
    geometry.computeBoundingBox();
    geoWidthRef.current = geometry.boundingBox.max.x - geometry.boundingBox.min.x || 1;
  }, [geometry]);

  useFrame((state, delta) => {
    const { gl, viewport, pointer, camera } = state;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);

    const destX = followPointer ? (pointer.x * v.width) / 2 : 0;
    const destY = lockToBottom ? -v.height / 2 + 0.2 : followPointer ? (pointer.y * v.height) / 2 : 0;
    easing.damp3(ref.current.position, [destX, destY, 15], 0.15, delta);

    if (modeProps.scale == null) {
      const maxWorld = v.width * 0.9;
      const desired = maxWorld / geoWidthRef.current;
      ref.current.scale.setScalar(Math.min(0.15, desired));
    }

    gl.setClearColor(0x000000, 0);
    gl.setRenderTarget(buffer);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    gl.setClearColor(0x000000, 0);
  });

  const { scale, ior, thickness, anisotropy, chromaticAberration, ...extraMat } = modeProps;

  return (
    <>
      {createPortal(
        <>
          <mesh position={[0, 0, -5]} scale={[vp.width * 2, vp.height * 2, 1]}>
            <planeGeometry />
            <meshBasicMaterial color={backgroundColor} toneMapped={false} />
          </mesh>
          {children}
        </>,
        scene
      )}
      <mesh
        ref={ref}
        scale={scale ?? 0.15}
        rotation-x={Math.PI / 2}
        geometry={geometry}
        {...props}
      >
        <MeshTransmissionMaterial
          buffer={buffer.texture}
          ior={ior ?? 1.15}
          thickness={thickness ?? 5}
          anisotropy={anisotropy ?? 0.01}
          chromaticAberration={chromaticAberration ?? 0.1}
          {...extraMat}
        />
      </mesh>
    </>
  );
});

function Lens({ modeProps, ...p }) {
  const geometry = useMemo(() => new THREE.SphereGeometry(1, 64, 64), []);
  return <ModeWrapper geometry={geometry} followPointer modeProps={modeProps} {...p} />;
}

function Cube({ modeProps, ...p }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(1.4, 1.4, 1.4), []);
  return <ModeWrapper geometry={geometry} followPointer modeProps={modeProps} {...p} />;
}

function Bar({ modeProps = {}, ...p }) {
  const geometry = useMemo(() => new THREE.BoxGeometry(6, 0.7, 0.7), []);
  const defaultMat = {
    transmission: 1,
    roughness: 0,
    thickness: 10,
    ior: 1.15,
    color: '#ffffff',
    attenuationColor: '#ffffff',
    attenuationDistance: 0.25
  };

  return (
    <ModeWrapper
      geometry={geometry}
      lockToBottom
      followPointer={false}
      modeProps={{ ...defaultMat, ...modeProps }}
      {...p}
    />
  );
}

function NavItems({ items, textColor }) {
  const group = useRef();
  const { viewport, camera } = useThree();

  const DEVICE = {
    mobile: { max: 639, spacing: 0.2, fontSize: 0.035 },
    tablet: { max: 1023, spacing: 0.24, fontSize: 0.035 },
    desktop: { max: Infinity, spacing: 0.3, fontSize: 0.035 }
  };
  const getDevice = () => {
    const w = window.innerWidth;
    return w <= DEVICE.mobile.max ? 'mobile' : w <= DEVICE.tablet.max ? 'tablet' : 'desktop';
  };

  const [device, setDevice] = useState(getDevice());

  useEffect(() => {
    const onResize = () => setDevice(getDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { spacing, fontSize } = DEVICE[device];

  useFrame(() => {
    if (!group.current) return;
    const v = viewport.getCurrentViewport(camera, [0, 0, 15]);
    group.current.position.set(0, -v.height / 2 + 0.2, 15.1);

    group.current.children.forEach((child, i) => {
      child.position.x = (i - (items.length - 1) / 2) * spacing;
    });
  });

  const handleNavigate = link => {
    if (!link) return;
    if (link.startsWith('#')) {
      window.location.hash = link;
    } else {
      window.location.href = link;
    }
  };

  return (
    <group ref={group} renderOrder={10}>
      {items.map(({ label, link }) => (
        <Text
          key={label}
          fontSize={fontSize}
          color={textColor}
          anchorX="center"
          anchorY="middle"
          depthWrite={false}
          outlineWidth={0}
          outlineBlur="20%"
          outlineColor="#000"
          outlineOpacity={0.5}
          depthTest={false}
          renderOrder={10}
          onClick={e => {
            e.stopPropagation();
            handleNavigate(link);
          }}
          onPointerOver={() => (document.body.style.cursor = 'pointer')}
          onPointerOut={() => (document.body.style.cursor = 'auto')}
        >
          {label}
        </Text>
      ))}
    </group>
  );
}

function Images() {
  const group = useRef();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    group.current.children.forEach((child, i) => {
      if (child.material) child.material.zoom = 1 + Math.sin(t * 0.3 + i) * 0.05;
    });
  });

  return (
    <group ref={group}>
      <Image position={[-1.4, 0.6, 0]} scale={[1.6, 1.1, 1]} url={IMAGE_URLS[0]} />
      <Image position={[1.3, -0.3, 1]} scale={[1.4, 1.4, 1]} url={IMAGE_URLS[1]} />
      <Image position={[-0.6, -1, 2]} scale={[1.2, 1.6, 1]} url={IMAGE_URLS[2]} />
    </group>
  );
}

function Typography({ textColor }) {
  const DEVICE = {
    mobile: { fontSize: 0.2 },
    tablet: { fontSize: 0.4 },
    desktop: { fontSize: 0.6 }
  };
  const getDevice = () => {
    const w = window.innerWidth;
    return w <= 639 ? 'mobile' : w <= 1023 ? 'tablet' : 'desktop';
  };

  const [device, setDevice] = useState(getDevice());

  useEffect(() => {
    const onResize = () => setDevice(getDevice());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const { fontSize } = DEVICE[device];

  return (
    <Text
      position={[0, 0, 1]}
      fontSize={fontSize}
      letterSpacing={-0.05}
      outlineWidth={0}
      outlineBlur="20%"
      outlineColor="#000"
      outlineOpacity={0.5}
      color={textColor}
      anchorX="center"
      anchorY="middle"
    >
      Zotonic
    </Text>
  );
}
