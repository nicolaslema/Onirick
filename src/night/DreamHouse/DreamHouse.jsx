import { lazy } from 'react';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const HouseScene = lazy(() => import('./HouseScene'));

const CAMERA = { position: [0, 0.15, 3.2], fov: 55 };

const DreamHouse = () => (
  <DreamFrame
    tint="house"
    tape={3}
    time="03:31 AM"
    stage="REM 3"
    title="The House You Grew Up In"
    log="The hallway is longer than it was. Every door opens onto the same kitchen, and someone is always just leaving it. You can smell toast. You never find out whose."
    camera={CAMERA}
  >
    <HouseScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamHouse;
