import DreamFrame from '../DreamFrame';
import OceanScene from './OceanScene';

// Standing just inside the door, eyes above the high-water mark.
const CAMERA = { position: [0, 1.3, 3.6], fov: 55 };

const DreamOcean = () => (
  <DreamFrame
    tint="tide"
    tape={4}
    time="04:58 AM"
    stage="REM 4"
    title="The Ocean Indoors"
    log="The water comes in under the door without a sound. It's warm, and it keeps rising. The furniture floats up politely. You were never afraid of this."
    camera={CAMERA}
  >
    <OceanScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamOcean;
