import DreamFrame from '../DreamFrame';
import WhaleScene from './WhaleScene';

// Rooftop level, looking up at the whale ("Nobody looks up").
const CAMERA = { position: [0, 4.6, 12], fov: 55 };

const DreamWhale = () => (
  <DreamFrame
    tint="whale"
    tape={2}
    time="03:12 AM"
    stage="REM 3"
    title="The Whale Above the City"
    log="It swims slowly between the rooftops. Nobody looks up. You wave, and it turns one eye toward you."
    camera={CAMERA}
  >
    <WhaleScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamWhale;
