import { lazy } from 'react';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const HouseScene = lazy(() => import('./HouseScene'));

const CAMERA = { position: [0, 0.15, 3.2], fov: 55 };

// The scene knows by itself when it's the dream on screen (night/stage.js).
const DreamHouse = () => (
  <DreamFrame tint="house" tape={3} time="03:31 AM" stage="REM 3" title="The House You Grew Up In" dream="house" camera={CAMERA}>
    <HouseScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamHouse;
