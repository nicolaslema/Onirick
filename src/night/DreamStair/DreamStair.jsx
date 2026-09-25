import { lazy } from 'react';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const StairScene = lazy(() => import('./StairScene'));

const CAMERA = { position: [0, -1.5, 6.5], fov: 50 };

const DreamStair = () => (
  <DreamFrame
    tint="stair"
    tape={1}
    time="02:47 AM"
    stage="REM 2"
    title="The Staircase"
    dream="stair"
    camera={CAMERA}
  >
    <StairScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamStair;
