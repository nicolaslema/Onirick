# DECISIONS.md

Minor calls made while executing PLAN.md that weren't pinned down by the plan or the design
system, per section 0.5 ("para detalles menores, elegí lo más simple y dejalo anotado acá").

## Phase 0

- **Base branch:** `phase-0-foundation` branches off `develop` (not off the earlier
  `worktree-lexical-swinging-zephyr` branch), since `develop` is what the user merged to and is
  the current, already-pruned integration point — it already matches the file layout PLAN.md's
  Phase 0 assumes (confirmed by listing `src/components`/`src/assets` there before branching).

- **`TapeLabel` takes raw `children` text + a `live` boolean**, not the structured
  `{ tape, time, stage }` triple `index.d.ts` sketches. The actual copy in PLAN.md section 6
  doesn't always fit that shape (`DR-1 · Dream recorder · 1986` on the hero, `03:40 AM · You woke
  up` on the manual, `07:02 AM · Recording saved` on Wake — none are "tape N · time · stage").
  `DreamTitle` (which only ever wraps a real numbered dream) still builds that exact string
  itself and passes it as `TapeLabel`'s children, so the five dream screens match the spec
  format exactly; Hero/Manual/Wake pass their own literal text.

- **Hero's own layout** (device 3D scene aside, not built yet) isn't pinned down beyond "DR-1
  center-right, tilted ~20°" — the design system's README doesn't say where the text block sits.
  Went with left-aligned, vertically centered (a conventional complement to a right-anchored
  scene), not bottom-anchored like the dream screens, since Hero isn't a dream. Revisit once the
  3D scene (Phase 2) is actually in the frame and can be judged together.

- **Wake's body copy** names an author ("Nicolás Lema") and its secondary button links to
  `github.com/nicolaslema/Onirick` — inferred from the git author on this repo's commits and the
  repository path PLAN.md's own header names, not confirmed by the user. PLAN.md itself flags
  this exact gap ("pedirle al usuario el nombre y los links") — **needs the user's confirmation**,
  called out again in the phase-0 report.

- **`SECTION_BG` in `useSectionTextures.js`** stays at its current value rather than moving to
  `#07080d` yet. That change is listed under PLAN.md section 7 (the Phase 1 motor changes), and
  in Phase 0 no section has a `<canvas>` at all, so the constant (only used as a `domToCanvas`
  fallback for a genuinely transparent capture) has no visible effect either way. Bundling it
  into Phase 1 with the rest of section 7 instead of doing it early.

- **Hud is static** (fixed at the hero's `hud` entry, always `data-theme="night"`), not synced to
  the actual current section — following which section is current, and flipping the Hud itself
  into the paper theme while the manual is current, needs `NightContext` (PLAN.md section 7.4),
  which is explicitly Phase 1 scope. One real, visible consequence: while scrolled into the
  manual, the Hud's ink-colored text is the same hex as the manual's own paper surface
  (`#ece6d8` both ways), so it's effectively invisible there until Phase 1 wires the Hud to
  follow the current section. Flagged in the phase-0 report, not silently left for later.
