import { Suspense, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';

import '../../three/console';
import { DPR_CAP } from '../../lib/dpr';

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

// The R3F half of SceneCanvas — three, R3F and the scenes live in this
// lazily loaded chunk, not the first one. `children` are the (lazy) scene;
// MarkReady sits in the same Suspense, so it only fires once that scene's
// code has arrived and rendered.
const LiveCanvas = ({ camera, frameloop, shadows = false, onCreated, onReady, children }) => (
  <Canvas
    gl={{ preserveDrawingBuffer: true, antialias: false }}
    dpr={[1, DPR_CAP]}
    frameloop={frameloop}
    flat
    shadows={shadows}
    camera={camera}
    onCreated={onCreated}
  >
    <Suspense fallback={null}>
      {children}
      <MarkReady onReady={onReady} />
    </Suspense>
  </Canvas>
);

export default LiveCanvas;
