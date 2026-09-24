import { lazy } from 'react';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const FallScene = lazy(() => import('./FallScene'));

// Above the column, looking down into it (FallScene aims the camera).
const CAMERA = { position: [0, 2, 3], fov: 60 };

const DreamFall = () => (
  <DreamFrame
    tint="fall"
    tape={5}
    time="06:41 AM"
    stage="REM 4"
    title="The Fall"
    log="There's no ground yet. The clouds go past in the wrong direction. You're not falling so much as being let go of. Somewhere below, an alarm is starting."
    camera={CAMERA}
  >
    <FallScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamFall;
