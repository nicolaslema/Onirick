import Hero from './Hero/Hero';
import DreamStair from './DreamStair/DreamStair';
import DreamWhale from './DreamWhale/DreamWhale';
import DreamHouse from './DreamHouse/DreamHouse';
import Manual from './Manual/Manual';
import DreamOcean from './DreamOcean/DreamOcean';
import DreamFall from './DreamFall/DreamFall';
import Wake from './Wake/Wake';

// The night, section by section. `melt`/`plainDuration` here are read by
// ScrollSections starting Phase 1 (PLAN.md section 7.1) — in Phase 0 every
// transition still uses ScrollSections' own global defaults, so these
// entries are present but not yet consumed.
export const NIGHT = [
  {
    id: 'hero',
    Component: Hero,
    hud: { state: 'standby', clock: '11:58 PM', counter: '00:00:00' }
  },
  {
    id: 'stair',
    Component: DreamStair,
    tint: 'stair',
    hud: { state: 'rec', clock: '02:47 AM', counter: '00:06:31' },
    melt: { duration: 1.6, ease: 'power2.inOut', intensity: 0.45, scale: 4, aberration: 0.15, drift: 0.3, overlayColor: '#000000' }
  },
  {
    id: 'whale',
    Component: DreamWhale,
    tint: 'whale',
    hud: { state: 'rec', clock: '03:12 AM', counter: '00:14:22' },
    melt: { duration: 1.5, intensity: 0.65, scale: 5, aberration: 0.25, drift: 0.4 }
  },
  {
    id: 'house',
    Component: DreamHouse,
    tint: 'house',
    hud: { state: 'rec', clock: '03:31 AM', counter: '00:21:48' },
    melt: { duration: 1.5, intensity: 0.85, scale: 5, aberration: 0.35, drift: 0.4 }
  },
  {
    id: 'manual',
    Component: Manual,
    kind: 'scroll',
    theme: 'paper',
    plainDuration: 0.45,
    hud: { state: 'standby', clock: '03:40 AM', counter: '00:21:48' }
  },
  {
    id: 'ocean',
    Component: DreamOcean,
    tint: 'tide',
    plainDuration: 1.2,
    hud: { state: 'rec', clock: '04:58 AM', counter: '00:38:05' }
  },
  {
    id: 'fall',
    Component: DreamFall,
    tint: 'fall',
    hud: { state: 'rec', clock: '06:41 AM', counter: '00:52:17' },
    melt: { duration: 1.7, ease: 'power3.inOut', intensity: 1.05, scale: 6, aberration: 0.5, drift: 0.55 }
  },
  {
    id: 'wake',
    Component: Wake,
    hud: { state: 'stop', clock: '07:02 AM', counter: '00:58:40' },
    melt: { duration: 2.2, ease: 'power3.inOut', intensity: 1.25, scale: 7, aberration: 0.7, drift: 0.6, overlayColor: '#f2efe8' }
  }
];
