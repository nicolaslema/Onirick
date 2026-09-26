import { lazy, useEffect } from 'react';

import { useScrollSections } from '../../components/ScrollSections/ScrollSectionsContext';
import DreamFrame from '../DreamFrame';
import { subscribeNavigate } from '../stage';

// Loaded with the 3D chunk, after the page has painted.
const FallScene = lazy(() => import('./FallScene'));

// Above the column, looking down into it (FallScene aims the camera).
const CAMERA = { position: [0, 2, 3], fov: 60 };

// The scene carries you into Wake by itself at the very end (you lose
// control, PLAN-2.md 6.5): it asks through night/stage.js, and this section —
// which has ScrollSections' goTo — does it.
const DreamFall = () => {
  const { goTo } = useScrollSections();
  useEffect(() => subscribeNavigate(id => goTo(id)), [goTo]);
  return (
    <DreamFrame tint="fall" tape={5} time="06:41 AM" stage="REM 4" title="The Fall" dream="fall" camera={CAMERA}>
      <FallScene camera={CAMERA} />
    </DreamFrame>
  );
};

export default DreamFall;
