import { lazy } from 'react';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const WhaleScene = lazy(() => import('./WhaleScene'));

// Rooftop level, looking up at the whale ("Nobody looks up").
const CAMERA = { position: [0, 4.6, 12], fov: 55 };

// The scene knows by itself when it's the dream on screen (night/stage.js).
const DreamWhale = () => (
  <DreamFrame tint="whale" tape={2} time="03:12 AM" stage="REM 3" title="The Whale Above the City" dream="whale" camera={CAMERA}>
    <WhaleScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamWhale;
