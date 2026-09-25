import { lazy } from 'react';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const StairScene = lazy(() => import('./StairScene'));

// Nearly level with the climber (PLAN-2.md 6.1): from below, the treads hid
// whoever stands on them.
const CAMERA = { position: [0, 2.6, 8], fov: 50 };

// The scene knows by itself when it's the dream on screen (night/stage.js).
const DreamStair = () => (
  <DreamFrame tint="stair" tape={1} time="02:47 AM" stage="REM 2" title="The Staircase" dream="stair" camera={CAMERA} shadows="percentage">
    <StairScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamStair;
