import { lazy, Suspense, useRef, useState } from 'react';

import { HAS_WEBGL2 } from '../../lib/webgl';
import { useSectionId } from '../ScrollSections/ScrollSectionsContext';
import { useSectionPresence } from './useSectionPresence';
import './SceneCanvas.css';

const LiveCanvas = lazy(() => import('./LiveCanvas'));

// The section's still (public/posters/<id>.webp, made by scripts/posters.mjs)
// while there's no live scene to show: offstage, still loading or spinning
// up, or no WebGL2 at all. Hides itself if the file doesn't exist yet.
const Poster = ({ id }) => {
  const [missing, setMissing] = useState(false);
  if (!id || missing) return null;
  return <img className="scene-poster" src={`/posters/${id}.webp`} alt="" decoding="async" onError={() => setMissing(true)} />;
};

// A section's 3D scene, following PLAN.md's capture rules (3.1) and lazy
// mounting (3.2): one canvas per section, preserveDrawingBuffer so the melt
// can read it, and ready flags useSectionTextures waits on —
// `data-scene-ready` on this wrapper (present from the first commit, before
// the R3F chunk or its <canvas> exist) and `data-async-ready` on the canvas.
// Offstage sections unmount their scene entirely and show their poster.
// `shadows`: turn R3F's shadow maps on for this one scene (PLAN-2.md 6.1 —
// only the Staircase pays for them).
const SceneCanvas = ({ children, camera, shadows = false }) => {
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
      <Suspense fallback={null}>
        <LiveCanvas
          camera={camera}
          shadows={shadows}
          frameloop={presence === 'active' ? 'always' : 'demand'}
          onCreated={({ gl }) => {
            glRef.current = gl;
            gl.domElement.dataset.asyncReady = 'false';
          }}
          onReady={handleReady}
        >
          {children}
        </LiveCanvas>
      </Suspense>
    </div>
  );
};

export default SceneCanvas;
