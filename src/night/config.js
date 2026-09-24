import Hero from './Hero/Hero';
import DreamStair from './DreamStair/DreamStair';
import DreamWhale from './DreamWhale/DreamWhale';
import DreamHouse from './DreamHouse/DreamHouse';
import Manual from './Manual/Manual';
import DreamOcean from './DreamOcean/DreamOcean';
import DreamFall from './DreamFall/DreamFall';
import Wake from './Wake/Wake';

// The night, section by section. `melt`/`plainDuration` are read by
// ScrollSections (PLAN.md section 7.1): transition i (between sections i-1
// and i) always uses section i's own override, in both directions — so an
// entry's `melt`/`plainDuration` lives on whichever section is the
// numerically later of a pair, matching PLAN.md's table in section 5.1.
// `tape`/`title` (the 5 dream sections only) feed the Hud's aria-live
// announcement on section change — the same title text each DreamX.jsx
// hardcodes in its own DreamTitle usage; a future pass could have each
// export it instead of repeating it here.
export const NIGHT = [
  {
    id: 'hero',
    Component: Hero,
    title: 'Onirick DR-1',
    hud: { state: 'standby', clock: '11:58 PM', counter: '00:00:00' },
    // Not a melt neighbour's override — this is the crossfade for
    // REPLAY THE NIGHT jumping back here from Wake (PLAN.md 6.7: "una sola
    // transición, crossfade de 1.2s").
    plainDuration: 1.2
  },
  {
    id: 'stair',
    Component: DreamStair,
    tint: 'stair',
    tape: 1,
    title: 'The Staircase',
    hud: { state: 'rec', clock: '02:47 AM', counter: '00:06:31' },
    melt: { duration: 1.6, ease: 'power2.inOut', intensity: 0.45, scale: 4, aberration: 0.15, drift: 0.3, overlayColor: '#000000' }
  },
  {
    id: 'whale',
    Component: DreamWhale,
    tint: 'whale',
    tape: 2,
    title: 'The Whale Above the City',
    hud: { state: 'rec', clock: '03:12 AM', counter: '00:14:22' },
    melt: { duration: 1.5, intensity: 0.65, scale: 5, aberration: 0.25, drift: 0.4 }
  },
  {
    id: 'house',
    Component: DreamHouse,
    tint: 'house',
    tape: 3,
    title: 'The House You Grew Up In',
    hud: { state: 'rec', clock: '03:31 AM', counter: '00:21:48' },
    melt: { duration: 1.5, intensity: 0.85, scale: 5, aberration: 0.35, drift: 0.4 }
  },
  {
    id: 'manual',
    Component: Manual,
    kind: 'scroll',
    theme: 'paper',
    title: 'The manual',
    plainDuration: 0.45,
    hud: { state: 'standby', clock: '03:40 AM', counter: '00:21:48' }
  },
  {
    id: 'ocean',
    Component: DreamOcean,
    tint: 'tide',
    tape: 4,
    title: 'The Ocean Indoors',
    plainDuration: 1.2,
    hud: { state: 'rec', clock: '04:58 AM', counter: '00:38:05' }
  },
  {
    id: 'fall',
    Component: DreamFall,
    tint: 'fall',
    tape: 5,
    title: 'The Fall',
    hud: { state: 'rec', clock: '06:41 AM', counter: '00:52:17' },
    melt: { duration: 1.7, ease: 'power3.inOut', intensity: 1.05, scale: 6, aberration: 0.5, drift: 0.55 }
  },
  {
    id: 'wake',
    Component: Wake,
    title: 'Wake',
    hud: { state: 'stop', clock: '07:02 AM', counter: '00:58:40' },
    melt: { duration: 2.2, ease: 'power3.inOut', intensity: 1.25, scale: 7, aberration: 0.7, drift: 0.6, overlayColor: '#f2efe8' }
  }
];
