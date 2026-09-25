import { lazy } from 'react';

import { useScrollSections, useSectionIndex } from '../../components/ScrollSections/ScrollSectionsContext';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const HouseScene = lazy(() => import('./HouseScene'));

const CAMERA = { position: [0, 0.15, 3.2], fov: 55 };

const DreamHouse = () => {
  // Doors only open for the dream on screen and settled — its neighbours'
  // scenes are mounted too.
  const { currentIndex, activeTransition } = useScrollSections();
  const live = useSectionIndex() === currentIndex && !activeTransition;
  return (
    <DreamFrame tint="house" tape={3} time="03:31 AM" stage="REM 3" title="The House You Grew Up In" dream="house" camera={CAMERA}>
      <HouseScene camera={CAMERA} live={live} />
    </DreamFrame>
  );
};

export default DreamHouse;
