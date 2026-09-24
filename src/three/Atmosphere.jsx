import { useMemo } from 'react';
import { Color } from 'three';

import { readToken, sceneBackground } from './materials';

// Opaque background + FogExp2 for a scene (PLAN.md 4.4). With a dream tint
// the fog takes the tint and the background is surface mixed 15% with it;
// without one (hero, wake) both are the plain night surface.
const Atmosphere = ({ tint, density = 0.06 }) => {
  const background = useMemo(() => sceneBackground(tint), [tint]);
  const fog = useMemo(() => new Color(tint ?? readToken('--surface')), [tint]);
  return (
    <>
      <color attach="background" args={[background]} />
      <fogExp2 attach="fog" args={[fog, density]} />
    </>
  );
};

export default Atmosphere;
