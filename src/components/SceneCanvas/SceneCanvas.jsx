import { Suspense, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

import { HAS_WEBGL2 } from '../../lib/webgl';
import { useSectionId } from '../ScrollSections/ScrollSectionsContext';
import { useSectionPresence } from './useSectionPresence';
import './SceneCanvas.css';

// Flips the ready flags once the scene has actually drawn a frame: on the
// first frame it asks for another (a 'demand' loop wouldn't produce one on
// its own), and by the second one the first is guaranteed to be in the
// (preserved) drawing buffer that the melt capture reads.
function MarkReady({ onReady }) {
  const frames = useRef(0);
  const invalidate = useThree(state => state.invalidate);
  useFrame(() => {
    frames.current += 1;
    if (frames.current === 1) invalidate();
    else if (frames.current === 2) onReady();
  });
  return null;
}

// The section's still (public/posters/<id>.webp, made by scripts/posters.mjs)
// while there's no live scene to show: offstage, still spinning up, or no
// WebGL2 at all. Hides itself if the file doesn't exist yet.
const Poster = ({ id }) => {
  const [missing, setMissing] = useState(false);
  if (!id || missing) return null;
  return <img className="scene-poster" src={`/posters/${id}.webp`} alt="" decoding="async" onError={() => setMissing(true)} />;
};

// R3F <Canvas> following PLAN.md's capture rules (3.1) and lazy mounting
// (3.2): one canvas per section, preserveDrawingBuffer so domToCanvas and
// refresh() can read it, and ready flags that useSectionTextures waits on —
// `data-scene-ready` on the wrapper (present from the first commit, before
// the <canvas> exists) and `data-async-ready` on the canvas itself.
// Offstage sections unmount their scene entirely and show their poster.
const SceneCanvas = ({ children, camera }) => {
  const presence = useSectionPresence();
  const id = useSectionId();
  const wrapRef = useRef(null);
  const glRef = useRef(null);
  const [ready, setReady] = useState(false);

  const handleReady = () => {
    if (wrapRef.current) wrapRef.current.dataset.sceneReady = 'true';
    if (glRef.current) glRef.current.domElement.dataset.asyncReady = 'true';
    setReady(true);
  };

  if (!HAS_WEBGL2 || presence === 'offstage') {
    return (
      <div className="scene-canvas" aria-hidden="true">
        <Poster id={id} />
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="scene-canvas" data-scene-ready="false" aria-hidden="true">
      {!ready && <Poster id={id} />}
      <Canvas
        gl={{ preserveDrawingBuffer: true, antialias: false }}
        dpr={[1, 1.75]}
        frameloop={presence === 'active' ? 'always' : 'demand'}
        flat
        camera={camera}
        onCreated={({ gl }) => {
          glRef.current = gl;
          gl.domElement.dataset.asyncReady = 'false';
        }}
      >
        <Suspense fallback={null}>
          {children}
          <MarkReady onReady={handleReady} />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default SceneCanvas;
