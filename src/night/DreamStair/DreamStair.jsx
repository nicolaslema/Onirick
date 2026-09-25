import { lazy } from 'react';

import { useScrollSections, useSectionIndex } from '../../components/ScrollSections/ScrollSectionsContext';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const StairScene = lazy(() => import('./StairScene'));

// Nearly level with the climber (PLAN-2.md 6.1): from below, the treads hid
// whoever stands on them.
const CAMERA = { position: [0, 2.6, 8], fov: 50 };

const DreamStair = () => {
  // Holding to stop only means something while this dream is the one on
  // screen and settled — its neighbours' scenes are mounted too.
  const { currentIndex, activeTransition } = useScrollSections();
  const live = useSectionIndex() === currentIndex && !activeTransition;
  return (
    <DreamFrame tint="stair" tape={1} time="02:47 AM" stage="REM 2" title="The Staircase" dream="stair" camera={CAMERA} shadows="percentage">
      <StairScene camera={CAMERA} live={live} />
    </DreamFrame>
  );
};

export default DreamStair;
