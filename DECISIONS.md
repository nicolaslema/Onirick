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
  **Resolved in Phase 1** (see below).

## Phase 1

- **`phase-1-engine` branches off `phase-0-foundation`**, not `develop` again — same reasoning as
  Phase 0's base-branch call, one step later.

- **Split `basePropsRef`/`optsRef` in `ScrollSections.jsx`** rather than the plan's literal
  "mezclar en optsRef antes de prepareTransition" read as one ref. The component's original code
  reassigned that ref from props on every render; a per-transition merge written into the *same*
  ref could get clobbered by an unrelated re-render landing mid-transition (React state changes
  don't fire mid-morph in this component's own code today, but nothing guarantees a parent
  never re-renders it for its own reasons). `basePropsRef` mirrors props every render, harmless;
  `optsRef` (what `MorphEngine.getOptions()` actually reads) is now *only* ever written
  imperatively — once per transition start, and reset to `basePropsRef` in `settle()`. Same
  outcome the plan describes, safer against that one edge case.

- **`ScrollSectionsContext` is provided by `ScrollSections` for its own children**, not lifted to
  wrap it from outside (which isn't actually possible — the context's value depends on state that
  lives *inside* `ScrollSections`, so a `Provider` wrapping it from `App.jsx` would have nothing
  to pass in). A sibling that isn't inside `ScrollSections`'s own subtree — the `Hud`, in
  `App.jsx` — can't reach the context, so `ScrollSections` also takes a plain `onStateChange`
  callback prop mirroring `{ currentIndex, activeTransition }` out to `App.jsx`, which resolves
  that against `NIGHT` and passes the Hud what it needs as ordinary props. Standard "lift state
  to share between siblings" — Hero/Manual/Wake's buttons, which genuinely are rendered inside
  `ScrollSections`, use the real context and its `goTo()` directly.

- **`activeTransition` is `{ from, to } | null`, no live `progress` value.** The plan's own
  sketch for `NightContext` includes `transition: {from, to, progress}`; a real per-frame
  `progress` would mean a React state update every animation frame during every transition
  (the whole point of running the melt outside React's render cycle in the first place), so this
  only tracks the coarse "is a transition between these two sections in flight" state, which is
  what Phase 2's `SceneCanvas` actually needs to decide active/neighbour/offstage per PLAN.md
  section 3.2. Revisit if something later genuinely needs frame-accurate progress.

- **`goTo()`'s non-adjacent-jump `plainDuration` resolves against the jump's actual target**,
  not `Math.max(from, target)` the way an adjacent step's melt/plainDuration override does. The
  `Math.max` convention exists specifically because "transition i" (an adjacent pair) has one
  unambiguous owning section regardless of direction (PLAN.md 5.1's own "se usan igual en las dos
  direcciones"); a jump has no such pair, so "the entrance to the destination" can only sensibly
  mean the literal target. Concretely: `hero`'s config entry now carries `plainDuration: 1.2`
  (PLAN.md 6.7's documented "crossfade de 1.2s" for REPLAY THE NIGHT jumping back from Wake) —
  under the `Math.max` rule that value would never be reached for that specific jump (`Math.max(7,
  0)` is Wake, not Hero), so the target-based rule is what actually realizes the plan's own
  stated duration.

- **`tape`/`title` fields added to each dream's `NIGHT` entry** (plus `title` on hero/manual/wake)
  purely to feed the Hud's aria-live announcement ("Tape 02, The Whale Above the City") — these
  duplicate the same title string each `DreamX.jsx` already hardcodes via `DreamTitle`. A later
  pass could have each section export its own title/tape and have `config.js` re-export them
  instead of repeating five short strings by hand; not worth the indirection for Phase 1.

- **Sections still use `aria-label` rather than `aria-labelledby`+`id`** (PLAN.md section 7.7's
  literal suggestion) — same call as Phase 0's, an equally valid way to give a landmark region an
  accessible name, already in place since Phase 0 and left unchanged.

- **Verified live except transition 7's exact whiteout.** Confirmed live in-browser: the
  non-adjacent jumps (Hero→Manual, Wake→Hero) both crossfade with the right per-target duration;
  the Hud follows the current section (including flipping into the paper theme on the manual —
  the exact gap Phase 0 flagged); Manual's native scroll auto-advances into Ocean at its bottom
  edge with Ocean's own tint/hud correctly applied; `End` jumps straight to Wake; zero console
  errors across the whole sequence. Didn't get a clean look at the actual melt *into* Wake
  (transition 7, the one that should visibly burn out to `melt-whiteout`) — reaching it needs a
  real adjacent step from Fall, and the one attempt at an adjacent step elsewhere in this session
  landed on the same `document.hidden`-pauses-`requestAnimationFrame` environment quirk hit
  several times earlier in this project (not a code defect — reproduced, traced to the tab losing
  OS-level foreground focus, and already documented earlier in this session). The underlying
  mechanism (per-transition option merging via `optsRef` + explicit `engine.syncOptions()`) is
  the same code path already exercised successfully for Ocean's tint and Hero's/Manual's
  `plainDuration`, so this is a coverage gap in this session's testing, not a known-broken path —
  worth a direct look before calling Phase 1 fully signed off.

## Phase 2

- **`phase-2-scene` branches off `develop`** (which the user fast-forwarded to Phase 1 plus its two
  post-review fixes), same one-step-later convention as Phase 1.

- **Neighbour pre-capture moved out of `settle()`** into an effect keyed on `currentIndex` in
  `ScrollSections.jsx`. `settle()` runs before React commits the new index, so a neighbour's
  `SceneCanvas` (mounted only once it becomes a neighbour, PLAN.md 3.2) didn't exist yet when it was
  captured, and the scene-less snapshot stayed cached forever. The effect also pre-builds each
  neighbour's text-only overlay so a melt never waits on `domToCanvas` at its start.

- **`prepareOverlay()` no longer touches the live DOM.** It used to hide the section's real canvas
  and clear its root background while capturing — harmless with no 3D, but with a live R3F scene it
  would flash the visible scene off at the start of every melt. It now uses modern-screenshot's
  `filter` (drop `<canvas>` nodes) and `onCloneNode` (transparent root) so only the captured clone
  changes. `refresh()` also skips until that overlay exists, instead of blitting the live canvas
  over the section's text.

- **`waitForCanvasesReady` readiness check** now means "left the 300×150 default" instead of
  "pixel width within 50% of CSS width" — the old check never passed on a HiDPI screen (the backing
  store is dpr × wider), so every capture sat out the full 2.5 s timeout. It also waits on
  `[data-scene-ready="false"]`, which `SceneCanvas` puts on its wrapper from the first commit (before
  R3F has even created the `<canvas>`).

- **Lazy mounting (`useSectionPresence`)**: current ± 1 are live, as PLAN.md 3.2 says; during a
  non-adjacent `goTo()` jump only its two ends stay live, so the jump target never pushes the count
  to 4 R3F contexts + the melt's own. Sections on either side of an in-flight transition run
  `frameloop="always"` (not "demand" + an 80 ms `invalidate`, the plan's alternative) — same result,
  one less timer.

- **Each section learns its index through `SectionIndexContext`**, provided by `ScrollSections`
  around every section component, instead of each section looking itself up in `NIGHT`.

- **Pointer tracking is window-wide** (`three/pointer.js`), not R3F's `state.pointer`: every
  section's copy sits on top of its canvas, so R3F's own pointer would freeze whenever the cursor is
  over text. Hover raycasts (the DR-1's keys) still use R3F events on the canvas.

- **Scene colors are read from `tokens.css` at runtime** (`readToken`) instead of repeated as hex
  in JS. Device body = `--ink` (the "hueso" of PLAN.md 6.0 — the only bone-colored token), window
  and cassette = `--surface-raised`, reels/table = `--line`, dial = `--line-strong`, LED = `--rec`.
  Keys stay neutral (`--ink-muted`) so `rec` stays the single accent (PLAN.md 4.1). Wake's dawn key
  light uses `--dream-stair` (the warm amber token) — PLAN.md only says "luz cálida".

- **`<Canvas flat>`** (no tone mapping), so token colors render as their hex instead of being
  shifted by ACES.

- **Wake's copy moved to the upper part of the frame** (`padding-top: var(--space-32)`), with the
  DR-1 + nightstand below it. PLAN.md 6.7 says both the copy and the composition are centered; with
  both centered the device sits behind the display type.

- **Hero on a portrait screen**: the DR-1 moves above the copy and scales to 0.75 — "center-right"
  has no room there.

- **Bundle is now ~1.28 MB minified (three + drei)**; Vite warns about the chunk size.
  Code-splitting belongs with the Phase 6 performance pass.

- **Hero yaw is -0.68 rad, not -0.35.** Sitting center-right, the camera already sees the DR-1 from
  ~19° to its left, so a literal -20° made it read square-on. -0.68 turns it ~20° toward the copy
  *relative to the line of sight*, which is what "girado unos 20°" looks like.

- **Wake camera pulled back** (`[0, 1.1, 7.6]`, looking at `y = 1.05`) so the DR-1 + ejected tape
  fit in the bottom ~30% of the frame under the copy; the copy's top padding is `--space-24`.

- **Two Phase 1 bugs found while verifying Phase 2, fixed here:**
  - After navigating with a button (BEGIN RECORDING, REPLAY THE NIGHT, …) the button ends up inside
    an inert section and the browser drops focus to `<body>`, so arrow keys stopped working until a
    click. The layout effect on `currentIndex` now hands focus to the stage when it was inside a
    no-longer-current section.
  - A window resize invalidated every capture but only re-captured the current section, so the
    first gesture toward a neighbour after any resize was silently dropped. A `captureEpoch` bump
    now re-runs the neighbour pre-capture effect.

- **Verified live (Chrome, dpr 1):** hero renders the DR-1 (reels spinning, LED blinking, keys sink
  on hover, tilt + camera parallax); the Hero ↔ Dream 01 melt samples 189 frames with mean
  luminance never below 11 (no black frame) while `refresh()` blits the live R3F canvas every 80 ms
  for the whole transition; max 3 `<canvas>` (hero + wake + melt) during the Hero → Wake jump, 2
  otherwise. Console: `THREE.Clock` deprecation warnings come from R3F 9 itself with three 0.186,
  and "Context Lost" logs are R3F disposing an offstage scene — both informational; worth a look in
  the Phase 6 "no console warnings" pass.

## Phase 3

- **Worktree:** Phase 3 lives in `.claude/worktrees/phase-3-dreams` on `phase-3-dreams`, branched off
  `develop` after Phase 2 was merged. (The previous worktree lost its git link mid-session; the user
  recreated this one.)

- **`DreamPlaceholder` → `DreamFrame`**: same markup, plus an optional R3F scene (`children`) mounted
  full-bleed through `SceneCanvas`. Ocean and Fall use it without a scene until Phase 5.

- **`sceneBackground` mixes in sRGB.** `Color.lerp` works in linear space, where 15% of a bright tint
  came out as a mid brown instead of a near-black and broke the log text's AA contrast. The mix now
  matches the tokens' own (sRGB) space, as PLAN.md 4.4's "mezclado 15%" intends.

- **Fog = full tint, background = surface + 15% tint** (both literal PLAN.md 4.4). Distant geometry
  therefore glows in the dream's color. Since the title is that same color, each camera is framed so
  far-off (fogged) geometry stays out from behind the title block: the whale scene looks up steeply
  so the rooftops sit in the bottom strip; the staircase and hallway converge toward screen center.

- **`useCameraDrift` gained `pivot: 'camera'`** — the eye stays put and only the look direction
  turns. The default ('target') orbits a point ahead of the camera; in the hallway that point is
  13 units away, so 0.15 rad of yaw carried the camera ~2 units sideways, straight through a wall
  (reported by the user). Staircase and whale keep orbiting.

- **Staircase:** 120 instanced steps, 24 per turn, rising 0.18 each around a central column; the
  "same window, same moon" repeats every 12 steps facing outward. Spins 0.02 rad/s; the pointer adds
  up to ±0.5 rad on top, eased.

- **Whale:** a 12×12 seeded rooftop grid (`three/random.js`, so the city is identical on every load
  and in every melt capture) with instanced tanks, antennas and ~1-in-6 lit windows in the tint.
  The whale loops an elliptical 40 s route above the roofs; "turns one eye toward you" is a small
  eased yaw/roll toward the cursor. Clouds are radial-gradient alpha planes the pointer pushes.

- **Hallway:** 22 instanced doors in wall bays that scroll toward the camera and wrap every bay, so
  the hallway never ends while the kitchen doorway (a lit plane behind the far wall, unfogged) stays
  at a fixed distance. Sodium light is a glow plane behind each door (visible through the edge gaps
  and when ajar) plus a floor spill. Doors ease up to 0.55 rad ajar as the pointer nears their
  on-screen position. The kitchen is just its lit doorway: a table silhouette and an open door leaf
  in front of the glow read as a black line through it (reported by the user) and were removed.

- **Verified live (Chrome, 144 Hz display):** all three scenes plus hero render at the display's
  144 fps cap. All six transitions Hero ↔ Stair ↔ Whale ↔ House, both directions, advance on the
  first key; each melt samples 193–230 frames with mean luminance ≥ 17.9 (no black frame). Max 4
  `<canvas>` (3 scenes + melt). Titles take their tint (amber / teal / sodium orange).
