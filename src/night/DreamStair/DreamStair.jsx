import DreamFrame from '../DreamFrame';
import StairScene from './StairScene';

const CAMERA = { position: [0, -1.5, 6.5], fov: 50 };

const DreamStair = () => (
  <DreamFrame
    tint="stair"
    tape={1}
    time="02:47 AM"
    stage="REM 2"
    title="The Staircase"
    log="You are climbing. You have been climbing for a long time. Every landing has the same window, and the same moon in it. The handrail is warm, like someone just let go."
    camera={CAMERA}
  >
    <StairScene camera={CAMERA} />
  </DreamFrame>
);

export default DreamStair;
