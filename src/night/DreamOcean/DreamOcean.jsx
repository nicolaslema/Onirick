import { lazy } from 'react';

import { useScrollSections, useSectionIndex } from '../../components/ScrollSections/ScrollSectionsContext';
import DreamFrame from '../DreamFrame';

// Loaded with the 3D chunk, after the page has painted.
const OceanScene = lazy(() => import('./OceanScene'));

// Standing just inside the door, eyes above the high-water mark.
const CAMERA = { position: [0, 1.3, 3.6], fov: 55 };

const DreamOcean = () => {
  // Staying under only counts while this dream is on screen and settled —
  // its neighbours' scenes are mounted too.
  const { currentIndex, activeTransition } = useScrollSections();
  const live = useSectionIndex() === currentIndex && !activeTransition;
  return (
    <DreamFrame tint="tide" tape={4} time="04:58 AM" stage="REM 4" title="The Ocean Indoors" dream="ocean" camera={CAMERA}>
      <OceanScene camera={CAMERA} live={live} />
    </DreamFrame>
  );
};

export default DreamOcean;
