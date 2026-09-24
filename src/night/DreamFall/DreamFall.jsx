import DreamFrame from '../DreamFrame';
import FallScene from './FallScene';

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
