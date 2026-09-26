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

## Phase 4

- **`Reveal` is a shared component** (`components/Reveal`), lifted from the old `Proof.jsx` (still in
  `legacy/`, untouched): same fade + 16px, 0.5s, 35% threshold, reduced motion shows everything at
  once. It takes `as` so each `SpecTable` row reveals on its own (`as="tr"`).

- **Keyboard inside a 'scroll' section scrolls it first.** The stage holds focus, not the scroller,
  so the browser never scrolled the manual on arrow keys and `ArrowDown` jumped straight to Dream 04.
  Arrows step 80px, PageUp/PageDown 85% of the viewport (smooth, instant under reduced motion); only
  at the edge do they change section.

- **The gesture that reaches the edge doesn't also leave.** Wheel events less than 200 ms apart are
  one gesture (a trackpad's momentum tail included); if that gesture scrolled the manual, hitting its
  edge is consumed and a fresh gesture is needed to cross into Dream 03/04. Same rule per touch
  swipe. Without it, every flick to the bottom of the manual fired straight into the next dream.

- **Verified live (Chrome, visible tab), from the real Web Animations on the section hosts:**
  entering crossfade 450 ms (House ↔ Manual, both directions; also the READ THE MANUAL jump),
  leaving 1200 ms (Manual ↔ Ocean, both directions). Arrow keys scroll 80px per press, PageDown
  85%; the manual's full 955px is consumed before Ocean, and arriving from Ocean lands at its bottom
  and is consumed back to the top before House. HUD reads `STANDBY · 03:40 AM` on the paper theme
  in the manual. All 10 reveal blocks end visible after one pass. Momentum-tail rule checked with
  synthetic wheel events. **Not verified:** native touch scroll on a real iOS device (PLAN.md risk
  table) — the swipe edge logic is shared with the wheel's; worth a pass on hardware in Phase 7.

## Phase 5

- **Transition 7's white-out is a new melt parameter, `burn`** (0 by default, `burn: 1` on Wake's
  `melt`). The shader only ever used `overlayColor` as an edge vignette (≤ 28%), so the Fall → Wake
  melt measured at most 55/255 mean luminance — it never burned to white, which PLAN.md 1 and 5.1
  require (also Phase 1's one unverified criterion). `burn` mixes the whole frame into the overlay
  color along the melt's own envelope (full at p = 0.5, gone at both ends), so the frame goes to
  `#f2efe8` and Wake emerges from it. Same in both directions, like every other melt parameter.

- **Ocean:** a room (inverted box) whose water rises for 12 s and drains for 12 s, between 0.3 and
  2 units above the floor (below the camera and the window). The surface is a 56×56 height field
  running the discrete wave equation at a fixed 60 Hz; the pointer's ray meeting the water drops a
  disturbance as it moves (PLAN.md's "buffer de ondas", on the CPU rather than a shader — ~3k
  vertices, flat shading derives normals itself). Caustics are a faint additive web texture on a band
  hugging the waterline. Chair, lamp and book rest on the floor until the water reaches them, then
  ride and rock on it. Camera pivots on the eye, as in the hallway. The book uses `--line-strong`,
  not `--rec` (the single accent is reserved for REC, PLAN.md 4.1).

- **Fall:** looking down a 40-unit column that scrolls up forever: 2000 soft points, 26 alpha cloud
  planes and 140 speed lines, each layer drawn twice and wrapping every 40 units, at different
  speeds for depth. The pointer steers (camera X/Z, eased); a 0.002 tremor. Points use the cloud
  texture as a sprite — bare `Points` render as squares, glaringly so up close.

- **Fall is not "casi blanca".** Its title is `--dream-fall` (#f2efe8), so a near-white frame would
  make the title and log unreadable (PLAN.md 4.1's AA rule). The frame stays the tinted night surface
  with white clouds, points and streaks rushing past; the actual white comes from the burn of
  transition 7 right after it.

- **Verified live (Chrome, visible tab):** Ocean 144 fps, Fall 136 fps (with 4 `<canvas>`: fall,
  ocean, wake, melt — at PLAN.md 3.2's cap). Melt 7 peaks at 238/255 mean luminance at p = 0.5 and
  settles into Wake (■ STOP · 07:02 AM). Melt 6 vs melt 3 compared side by side at p ≈ 0.5: visibly
  stronger split and fragmentation (its params are higher across the board). REPLAY THE NIGHT
  crossfades Wake → Hero in 1200 ms, and arrow keys keep working afterwards. No console errors.

- **Melt textures refresh every frame, not every 80 ms** (user-reported: entering Fall looked
  laggy until it "stabilized"). During a melt, both scenes are seen only through their melt
  textures, which `refresh()` re-composited from the live canvases every 80 ms — ~12 fps. Slow
  scenes hid it; the fall, the one fast-moving scene, visibly stuttered for the whole melt into it
  and then jumped to full rate once the real canvas took over (less visible going out, where it's
  being warped away). PLAN.md 3.1 names the 80 ms figure, but it dates from when each refresh
  re-rasterized the DOM; a refresh is now a GPU canvas-to-canvas draw plus a texture upload,
  measured at ~0.2 ms. It now runs on `requestAnimationFrame` for the melt's duration. Measured on
  Ocean → Fall: 288 uploads/s (2 textures × 144 Hz), no frame over 25 ms.

## Phase 6

- **Tape counter scramble** (`Hud/ScrambleCounter`): each digit shows random values for 0.4 s,
  settling left to right 30 ms apart (PLAN.md 5.2); colons stay put; instant under reduced motion.
  The HUD's REC state reuses TapeLabel's `.onk-rec` dot, so both blink the same way.

- **Grain:** `public/noise.png` (256×256 seeded gray noise, generated once with a zlib-only Node
  script — no dependency) tiled over the page at 7% `overlay`, z-index 1000: above the sections and
  the melt canvas (never captured or melted), below the HUD (1100) and the loader (1200).

- **Loader** (PLAN.md 5.2): a static first frame is inlined in `index.html` (painted before any JS),
  then React's `Loader` takes over with the same markup; its counter is real time since navigation
  start (MM:SS:hundredths), written straight to the DOM rather than re-rendering React every frame.
  It lifts (0.8 s) when `ScrollSections` calls the new `onReady`: fonts loaded + sections 0 and 1
  captured. The hero's copy stays at rest until then — the melt's first capture of the hero is taken
  under the loader — and only then enters (fade + 12 px, 0.6 s power2.out, 80 ms stagger, gsap).
  Loader copy is just the counter: PLAN.md names nothing else.

- **Posters** (`pnpm posters`, `scripts/posters.mjs`): PLAN.md asks for Playwright; `playwright-core`
  (new devDependency) drives the installed Chrome, so no browser download. It walks the night with
  the arrow key and saves each 3D section's *scene canvas* (not the page: the copy is live DOM drawn
  over the poster) as a 1600 px webp. 7 posters, 5–35 KB each. A section shows its poster while its
  scene is offstage or still loading/spinning up, and always without WebGL2.

- **No WebGL2** (`lib/webgl.js`, PLAN.md 6): a context is actually requested, not just the
  constructor checked. No melt engine is created, every transition is a crossfade (the base 0.6 s,
  or a section's own `plainDuration`), every section shows its poster, and the loader lifts as soon
  as fonts are in. Verified headless with `--disable-webgl --disable-3d-apis`: 0 canvases, 7
  posters, 600 ms crossfades, no console errors.

- **DPR cap** (`lib/dpr.js`): 1.75, or 1.25 on a coarse pointer, applied to the R3F canvases, the
  melt canvas and the melt's captures alike.

- **Performance — Lighthouse mobile went from 49 to 82–83** (Accessibility 100 throughout):
  - Google Fonts CSS no longer blocks render (`media=print` + onload). Since `document.fonts.ready`
    can then resolve before the sheet has declared any face, `lib/fonts.js` waits for the sheet and
    for each face actually used — otherwise a capture could draw fallback fonts again (the Phase 1
    "snap" bug).
  - Code splitting: the first chunk is React + the page DOM (224 KB, 72 KB gzip, was 1.3 MB).
    three + R3F (`SceneCanvas` → lazy `LiveCanvas`), each scene, the melt engine (ogl), gsap and
    modern-screenshot load on demand.
  - A section capture that has a scene is now composed (live canvas + text overlay — exactly what
    `refresh()` draws every frame) instead of a second full `domToCanvas`, which also re-embedded the
    web fonts every time. The text overlay is captured on a transparent background, so the
    full-canvas chroma-key pass (millions of pixels in JS) now early-outs on one pixel.
  - The melt engine only renders between `start()` and `stop()` (new `autoRun: false`), i.e. while
    its canvas is shown; it used to draw its full-screen shader every frame, hidden, forever.
  - The engine itself (WebGL context + shader compile, ~1 s on Lighthouse's software GL) is built on
    the first sign of intent — pointermove/pointerdown/touchstart/wheel/keydown, caught on `window`
    in the capture phase, so it exists before the same event reaches ScrollSections' handler. Its
    code is prefetched right after the reveal. Verified: the first ArrowDown both builds it and melts.
  - Measured (vite preview, Lighthouse 12 mobile, 2 runs): FCP 1.4 s, LCP 4.0 s, TBT 210–250 ms,
    SI 2.5–2.6 s, CLS 0.001. LCP is the hero heading, which only paints when the loader lifts —
    kept, since PLAN.md 5.2 asks the loader to wait for the first two captures.

- **Console:** R3F 9 (up to 9.8, the latest) builds its clock with `THREE.Clock`, which three r183+
  warns about on every canvas. `three/console.js` routes three's logging through
  `setConsoleFunction` and drops only that message. Headless runs of the whole night (normal and
  reduced motion) and of the no-WebGL path log no errors or warnings.

- **Metadata:** description, Open Graph (title, description, `og:image` = the hero poster,
  1600×900), `twitter:card`, `theme-color` #07080d. `og:image` is a relative URL until there's a
  deploy domain (Phase 7).

- **Not done here:** the `charset` and `robots.txt` Lighthouse notes (`vite preview` serves HTML
  without a charset header; no robots.txt) belong with the deploy in Phase 7.

- **Dream titles wrap on phones** (user-reported: "The Whale Above the City" and "The House You Grew
  Up In" ran off a phone screen). `components.css` keeps `.onk-dream-title` on one line; at the
  56 px floor of its clamp those two measured 463 / 485 px against 358 px available at 390 px wide.
  Below 640 px the title now wraps between words (never inside one, PLAN.md 9) with
  `text-wrap: balance`; all five fit (two lines for Whale, House and Ocean).

- **Hallway looks a bit lower on portrait screens.** With the title on two lines, the lit kitchen
  doorway sat right behind the tape label; the camera now aims at y = -2.4 instead of 0 when the
  viewport is portrait, lifting the doorway above the copy. Landscape is unchanged.

- **Whale route on portrait screens** (user request): the landscape loop is an 8 × 5 ellipse, but a
  portrait phone sees only ~4 units to either side at that depth, so the whale was in frame ~25% of
  its 40 s lap. In portrait it now swims a 2.2 × 7 ellipse (mostly toward and away from the camera)
  at 0.75 scale: 100% of the lap in frame at 390 × 844 (projected against the same camera). The
  landscape route is unchanged.

- **Hero on portrait screens** (user-reported: the DR-1 sat under the HUD and over the tape label).
  It was placed at a fixed 28% of the view height at 0.75 scale while the copy was vertically
  centered. In portrait the copy is now anchored to the bottom (just above the scroll hint), and
  `DeviceScene` measures the live DOM — the bottom of the HUD's top corners and the top of the copy
  (`offsetTop`, so the entrance transform doesn't skew it) — and fits the DR-1 into that band,
  re-measuring on resize and font reflow. Centered, it turns the plain ~20° (-0.35 rad) instead of
  the landscape -0.68. On short phones (≤ 720 px tall) the copy's gap tightens to `--space-4` to
  leave a usable band; if a band is ever too small for the device to read (< 0.15 scale) it isn't
  drawn rather than overlap the HUD or the copy. Checked at 390 × 844 and 375 × 667; landscape is
  unchanged.

## Phase 7

- **Deploy target: Vercel** (user's choice). `vercel.json` pins the framework, pnpm install/build and
  `dist/`, and adds `immutable` caching for hashed `/assets/*` (1-day for posters). The deploy itself
  runs from the user's Vercel account; `og:image` stays relative until the domain exists (README says
  where to make it absolute). `public/robots.txt` allows everything. Wake's author line and
  VIEW SOURCE link (inferred in Phase 0) confirmed by the user as-is.

- **README** rewritten: what it is, how to run it, how the melt works (PLAN.md 3.1 and 7 condensed),
  deploy and credits. All 3D is procedural, so there's no `CREDITS.md` of external models; typefaces
  (OFL) and libraries are credited in the README.

- **QA (PLAN.md 9) found three bugs, all fixed here:**
  - React registers `onWheel`/`onTouchMove` as *passive* listeners, so every `preventDefault()` in the
    wheel and swipe handlers was ignored and Chrome logged an error per event (41 in one pass —
    earlier console checks only used synthetic key events). Both are now native listeners with
    `{ passive: false }`; a touchmove the browser no longer allows cancelling is left alone.
  - Arrow/Page/Home/End keys were heard on the stage, which only has focus after a click: arriving
    by keyboard, or after only using the wheel, the keys did nothing. They're now heard on `window`
    (ignoring modified keys, i.e. browser shortcuts).
  - Buttons were 39 px tall; on touch devices / narrow screens they now have a 44 px minimum
    (PLAN.md 9). `components.css` stays verbatim — the rule lives in `global.css`.

- **QA results, Chrome (headless, production build):** a 40-event wheel burst (trackpad momentum) =
  one section; one arrow press = one section; one touch swipe on a 390 × 844 touch viewport = one
  section; no HUD corner overlaps any copy in any section at 390 px; all dream titles fit; all
  buttons 44 px; all 14 adjacent transitions (forward and back) without a black frame (min mean
  luminance 14.9/255, on the white-burning melt 7); a resize mid-melt resets cleanly to the settled
  section and the next gesture works; the manual scrolls natively to its bottom under a long
  flick and only a fresh gesture leaves it; reduced motion and no-WebGL2 walk the whole night; no
  console errors or warnings anywhere.

- **Not verifiable here:** Safari (desktop and iOS), Firefox and Chrome Android on real hardware —
  this machine has Chrome only, and no devices. Most worth checking on them: `backdrop-filter` in the
  GradualBlur bands on Safari (PLAN.md risk table), native scroll + swipe edges inside the manual on
  iOS, and WebGL2 availability/performance on mid-range phones.

## After release

- **The manual as a detour** (user request). READ THE MANUAL jumped from the hero straight to 03:40,
  skipping the first three dreams, and from there the only ways on were into the hallway or the
  ocean — the night could no longer be walked from its start. A section can now be marked
  `detour: true` (the manual is): reached by a forward `goTo()` jump that skips sections, leaving it
  by either edge crossfades back to where the jump came from (the hero), after which the night runs
  in order. Reached normally (from the hallway or the ocean) it behaves exactly as before. While in a
  detour its closing line reads "Back to the device ↑" instead of "Go back to sleep ↓" (user
  approved the copy change), since leaving no longer leads to the next dream. Home/End still jump
  and end the detour. Verified headless: detour in, long flick stays in the manual, a fresh gesture
  or ArrowUp at the top returns to the hero, the next step from there is Dream 01; the normal walk
  and its label are unchanged; no console errors.

## Night 2 — Phase 0

- **Branch:** `n2-phase-0-state` branches off `plan-2` rather than `develop` (PLAN-2.md 0.3), so
  `Docs/PLAN-2.md` travels with the code that implements it. `plan-2` is `develop` plus that one
  document.

- **Copy moved to `night/dreams.js`** and each dream section now passes `dream="<id>"` instead of
  its own `log` string; `DreamFrame` joins the lines for `DreamTitle`, which stays static until the
  transcript lands (phase 2). Four logs are word-for-word what they were. The Staircase's last line
  is now "If you stop, the stairs keep going." — decided with the user (PLAN-2.md 13.7) — so that
  one screen does differ from before.

- **`play` added to the dream entries in `config.js`** (PLAN-2.md 8) but nothing reads it yet: the
  gate that uses it is phase 1. `play.js` doesn't need it either — a line is revealed when
  `target >= at`, which works the same for free (target stays 0), beats and scrub — so `play.js`
  imports only `dreams.js` and there's no import cycle through `config.js` and the sections.

- **Scene events persist in sessionStorage (`onirick.events`)**, next to the recording, not only in
  memory. PLAN-2.md 3.3 has events last the night; without persisting them, a reload would keep the
  whale's fragment (recording.js is persisted) but lose its 'wave' event, and its log would wait for
  a wave that was already given.

- **The fragment announcement has its own `aria-live` region** in the Hud, beside the section one,
  rather than sharing it — two polite regions never overwrite each other's message.

- **`pointer.vx`/`vy` are getters** that fade the last measured velocity toward 0 (120 ms time
  constant) once moves stop — pointermove doesn't fire when the pointer is still, so a plain field
  would keep the last move's velocity forever. `pointerdown/up/cancel` listeners were added next to
  `pointermove` (still one set for the whole page); a window `blur` counts as a release, so a hold
  never gets stuck on alt-tab.

- **`pnpm test`** runs `node --test` (built into Node, no dependency) over `*.test.js`; the only
  suite so far is `three/gestures.test.js` for `createWaveDetector` (a quick shake fires once, a
  single sweep, a too-slow shake and sub-`minAmp` jitter don't, and it restarts after firing).
  Thresholds are still the plan's starting values; phase 4 tunes them on real input.

- **Debug panel** (`?debug`, dev only): the lazy import sits behind `import.meta.env.DEV`, and the
  production build was checked to contain no trace of it. It re-renders on a 100 ms timer and reads
  the live `target` on every render, so it never lags the `reveal` React already shows.

- **Verified** (headless Chrome, dev server): the arrow key walks all 8 sections as before; the four
  unchanged logs match and the Staircase shows its new line; no panel without `?debug`; with it, the
  panel shows section, play state and lucidity, keeping a fragment updates lucidity and is announced,
  survives a reload, is absent in a new tab, and "reset night" clears fragments and play state;
  setting a scrub stop updates `target` and `reveal`; no console errors. `pnpm lint`, `pnpm build`
  and `pnpm test` clean.

## Night 2 — Phase 1

- **The gate lives in `night/gate.js`**, not in `play.js` as PLAN-2.md 3.2 sketches: it needs the
  NIGHT config (each dream's `play`), and `config.js` imports the sections, whose scenes import
  `play.js` — putting it in `play.js` would close that cycle. `App.jsx` builds it once
  (`createNightGate(NIGHT)`) and passes it only when WebGL2 exists; without it every gesture changes
  section, exactly as before (verified with WebGL disabled).

- **`ScrollSections` stays generic**: one optional `gate` prop, four methods by index (`canLeave`,
  `consume`, `prepare`, `reset`). `consume` gets a `step` flag — the start of a wheel gesture, a
  touch crossing the 40 px swipe threshold, a key press — so beats advance once per gesture while a
  scrub follows every delta. The edge rule is the manual's: the gesture that brings a gated dream to
  its end never also melts it; a fresh one does (a 60-event trackpad-style flick past the end stays
  put, verified).

- **Beats swallow gestures while a beat plays** (`beatDuration`, 150 ms under reduced motion), and
  keys in a scrub tween to the next stop over 0.8 s with power2.inOut. PageUp/PageDown behave like the
  arrows in a gated dream (one step / one stop); only the manual pages by a screen.

- **Touch needed its own flag.** The first cut marked the touch `consumed` when it crossed the swipe
  threshold, and `handleTouchMove` returns early on `consumed` — so a scrub stopped following the
  finger after 40 px (a 300 px swipe moved the stair 0.046 instead of 0.278). A gated beat now sets
  `stepped`; `consumed` keeps meaning "this touch changed section".

- **`snap` became a counter (`snaps`)**, not a boolean: a scene may read the entry from more than one
  place, and the first reader clearing a flag would hide the snap from the rest. Scenes use the new
  `three/usePlayProgress(id, smoothTime)`, which eases toward the target, jumps on a snap, and calls
  R3F's `invalidate()` on every change — a neighbour's canvas renders on demand, and it must draw its
  prepared state before the melt samples it.

- **Neighbours are prepared before they're captured** (the pre-capture effect), and a prepare that
  changed state invalidates that section's capture. Entering backward therefore shows the end state
  from the melt's first frame: screenshots mid-melt Fall → Ocean show the room already at its last
  water level, matching the settled frame. Consequence worth knowing: coming back from Wake you
  enter the Fall at its end and walk its stops back to 0 before it lets you leave — as designed
  (PLAN-2.md 3.3), but it's four gestures, not one.

- **Captures carry a generation per section**: `invalidate(index)` bumps it, and a capture or
  overlay still in flight from before won't land in the cache afterwards. `recapture(index)` (on the
  ScrollSections context) is in place — debounced 250 ms, deferred while anything moves, run in idle
  time — but nothing calls it until the transcript (phase 2).

- **A gesture that arrives before its captures is held, not dropped** (600 ms). In headless software
  GL, a key pressed the instant Whale settled — House only just mounted and still capturing — went
  through 3/3 times.

- **Provisional scenes, to be replaced:** the Staircase shows a bare sphere on the moon's orbit
  (phase 3 makes it the real moon), and the Ocean's water no longer rises and falls on a 12 s cycle —
  it rises one level per beat, with the last level still just under the camera (phase 6 takes it
  under the surface, adds the breathing). The Ocean's poster still shows the old cyclic level; posters
  are regenerated in phase 9.

- **Verified** (headless Chrome, dev server, ?debug panel for state): wheel scrubs the stair (900 px
  ≈ 1/3); the gesture reaching the end doesn't melt, a fresh one does; backward entry lands at the
  end, forward at 0; arrows tween between stops and leave at the ends; a 300 px touch swipe moves the
  stair by the ×2.5 gain; the ocean takes one beat per long wheel gesture, swallows gestures during a
  beat, stops at beat 3, melts on the next fresh gesture, and is entered backward at beat 3; the
  fall's first key stop is 0.25; the manual detour still returns to the hero; no WebGL2 → no gate;
  no console errors. `pnpm lint`, `pnpm build`, `pnpm test` clean. Not verified: real touch hardware
  and Safari/Firefox.

## Night 2 — Phase 2

- **The transcript lays out the whole log, not only the revealed lines** (PLAN-2.md 4.1 says
  "revealed"): everything not typed yet — unrevealed lines included — is transparent text in place.
  The title slot is anchored to the bottom of the screen, so a log that grew line by line would push
  the dream's title upward every time the scrub revealed a sentence. Laid out whole, nothing moves.

- **What was typed lasts the night** (`typed` on the play entry): coming back to a dream shows its
  log as far as it got, without retyping. The section above the current one — the one you'd enter
  moving back — is filled in at once, so a backward melt shows the whole log (the plan's "entering
  backward, everything is revealed and typed"). A dream reset to its start by a jump keeps what was
  typed but only shows up to its revealed lines. REPLAY THE NIGHT zeroes it.

- **Every time the visible text settles** (a batch typed, a line waiting for an event, a neighbour
  filled in) the transcript calls `recapture(index)` from phase 1, so the next melt out of that
  dream shows exactly what's on screen. On arrival the capture shows the log blank and typing starts
  after the melt: no flicker (verified: the stair's log reads '' as it arrives).

- **The glitch is decided once per dream per night**, the first time its transcript types, from the
  lucidity at that moment (100/80/60/40/20/0 % for 0-5). It mistypes, holds 350 ms, erases, carries
  on; the screen-reader copy never has it.

- **The caret has zero net width** (`▍` with `margin-right: -1ch` in the monospaced log), so it can
  appear and vanish without reflowing a line. It lingers 1.5 s after typing, and stays for good while
  the next line waits for an event (the whale's "You wave,").

- **DreamAction fires the dream's `'action'` event** (and marks the dream as touched) — what that
  means is each scene's business in its own phase. It's excluded from every melt capture by its class
  (`dream-action`), so even a recapture taken while it has focus doesn't show it (verified mid-melt).

- **Prompts** show 6 s into a dream with a `hint` (stair, whale, house) while its fragment isn't kept
  and the visitor hasn't `markTouched()` it (scenes call that from phase 3 on), for 5 s, once per
  dream per night.

- **Tape progress and the scrubbed clock stay out of React's frame loop**: the bar's fill is written
  to the DOM each frame; the clock re-renders only when its minute (or the counter's second)
  changes. `ScrambleCounter` takes a `group` (the section index) and only scrambles when the group
  changed — a scrub moving the counter just updates it. Clocks: the Staircase goes 02:47 → 03:04,
  the Fall 06:41 → 07:01 (counter 00:52:17 → 00:58:31).

- **Verified** (headless Chrome, dev server, ?debug): no lucidity on hero/manual, shown in dreams and
  Wake; stair blank on arrival, types only line 1 at progress 0, lines 2-3 at 0.66 with "noon"
  typed and corrected; screen-reader text complete and unglitched; HUD clock 02:58 at 0.66 and the
  tape filled to 0.66, full at the end; the whale waits at "You wave," with the caret, shows its
  prompt at 6 s, finishes the line on the wave event; keeping a fragment fills a segment that
  blinks; Tab from the stage reveals "Wave at the whale", and a melt taken with it focused doesn't
  show it; a re-entered dream isn't retyped; at lucidity 5 no glitch and no prompt; reduced motion
  shows revealed lines at once; no console errors. `pnpm lint` (no warnings), `pnpm build`,
  `pnpm test` clean.

- **After review — the glitch is gone, and the title can't move** (user request). In the Ocean,
  "politely" typed first as "quietly" (shorter) changed where the line broke; the title slot is
  anchored to the bottom, so the log gaining or losing a line pushed "The Ocean Indoors" up and
  down. The glitch was removed entirely (code, `glitches` in dreams.js, the lucidity odds —
  PLAN-2.md 4.1, 4.2 and 13.4 updated), and the transcript's layout was made independent of its
  typing: an invisible copy of the whole log (`visibility: hidden`) sets the block's size, and the
  typed text is an absolutely positioned overlay on top of it — still with the not-yet-typed rest
  in place, transparent, so no word jumps lines as it completes. Nothing the typing does can
  change the block's height now. The phase 2 notes above about the glitch describe what was built
  first; this entry supersedes them. Verified: the title's top measured every 40 ms stayed within
  0.00 px from arrival through all four Ocean beats and across the Staircase scrub, at 1440 × 900
  and 390 × 844; the phase 2 checks still all pass.

## Night 2 — Phase 3

- **The camera moved up** (`[0, -1.5, 6.5]` → `[0, 2.6, 8]`, looking at `[0, 4.4, 0]` instead of
  `[0, 3.5, 0]`). From the old low angle the camera saw the treads from underneath, and the figure
  standing on them was hidden by its own step and the ones in front — a first screenshot showed
  barely a head. Nearly level with the climber, the treads are almost edge-on and the whole figure
  reads, still with the spiral rising above. The climber stands on step 44 at `-π/2 + 0.7` (front,
  right of the column), above the title and clear of its last letters; on a 390 px phone it's large
  and above the title too. PLAN-2.md 6.1 updated.

- **No foot slip, by construction.** Everything about the figure is computed relative to your place
  on the stair: `n` (steps the stair has turned), `s` (where you are relative to your place) and `u`
  (stride phase, 0-2). A planted foot's stair index is always a whole step, so it rides its tread
  whether you walk (cadence 1), stand (0) or catch up (1.8 / 3). Legs are thigh + shin with a
  forward-bending knee (two-bone IK to each foot's spot); arms swing against them. The stair's own
  turn wraps every 12 steps (one landing), invisibly.

- **Stopping finishes the step under way**, then stands; the stair carries you down (`s` falls a
  step every 2 s, floored three landings down). Releasing climbs back at 1.8× (3× past a landing).
  Back in place after being carried 2+ steps keeps the fragment. Holding is `onHold` (250 ms, 10 px
  tolerance) — a swipe that scrubs never counts (verified with four touch swipes). Only the current,
  settled Staircase listens (`live`, passed from the section, since its neighbours' scenes are
  mounted too).

- **DreamAction needed a repeatable signal.** Its first version fired a play event, and events
  happen once a night — a second "Stop climbing" would have done nothing. `play.js` now has
  `act(id)` / `subscribeAction()`; DreamAction calls `act`. The button stops the climber for 6.5 s
  (PLAN-2.md said 4 s, which can't carry you the 2 steps the fragment needs once finishing the step
  under way is counted).

- **The moon starts back-right and high** (y 4.5 → 7 over the scrub; the plan had front-left, y 1 →
  6): with the new camera, front-left put it on top of the title and the log. It's a sphere, an
  additive halo and a `SpotLight` with shadows aimed at your place; the tint's own light drops to a
  remnant (hemisphere 0.07, directional 0.35).

- **Shadows only here**: `shadows` threads DreamFrame → SceneCanvas → LiveCanvas → `<Canvas>`.
  Casters: column, steps, window frames, figure; receivers: steps, column. Shadow map 1024 (512 under
  700 px wide), bias −0.0006 / normalBias 0.03. Measured on this machine's GPU (RTX 5080, D3D11):
  144 fps in the Staircase with shadows, 142 in the Whale without — both at the display's refresh.
  Not measured: a laptop iGPU or a phone; the fallback (shadows off on small screens) is one line if
  needed.

- **Posters are stale for the Staircase** (new camera). They're regenerated in phase 9 — and
  `scripts/posters.mjs` will need to step through the gated dreams' stops, since one arrow press no
  longer leaves the Staircase.

- **Verified** (headless Chrome, ?debug): screenshots at progress 0 / 0.33 / 0.66 / 1, held and
  released, at 1440 × 900 and 390 × 844; a 2 s hold doesn't earn the fragment, an 8 s hold and the
  climb back does, and the prompt is gone after holding; the keyboard "Stop climbing" earns it; touch
  swipes scrub to 0.89 without ever stopping the climber; the stair still melts into the whale; no
  console errors. `pnpm lint` (no warnings), `pnpm build`, `pnpm test` clean.

- **After review — the windows are empty frames** (user request): each landing's window used to
  hold its own painted moon disc; now that the moon is a real, moving light, those copies
  competed with it. The frames stay; the only moon is the one orbiting the stair. The log still
  reads "…and the same moon in it", which now points at the one moon seen through them — part of
  the narrative pass the user plans anyway.

## Night 2 — Phase 4

- **The wave**: `createWaveDetector` fed `pointer.x` every frame while the Whale is current and
  settled (`live`, as in the Staircase). A long scripted session of ordinary movement — sweeps,
  pauses, hesitations — never fired it; a quick side-to-side shake at 12% of the screen width does,
  with the mouse and on a 390 px screen. The keyboard "Wave at the whale" goes through the same
  function via `act()`.

- **The first wave** triggers the `wave` event (the log's last line types), keeps the fragment,
  and plays the reaction: 1.5 s off the route toward a point lower and closer (landscape
  `[0, 8.6, 1.5]`; portrait `[0, 9.4, -2]` at 0.55 scale so the flank fits), the right flank and eye
  turned to the camera (slerp from the path orientation), 3 s looking with a blink at 1.4 s, 2 s back.
  The route's own clock slows by the same weight, so the whale picks up where it left — no jump.
  Later waves only turn the eye toward you (a yaw toward the camera in the whale's own frame) and
  blink. Reduced motion: the same reaction, 1.6× slower.

- **The windows' wave became a sweep of light** (PLAN-2.md 6.2 updated). Built as specified, the
  lit windows never showed: from this camera each row hides the fronts behind it and the first row's
  sit below the frame — screenshots mid-wave looked exactly like rest. Moving windows up the facades
  and out of the fog didn't help either. What the eye does see is the skyline's front faces, so a warm
  point light now runs side to side in front of the first row (3 s, intensity 70, reach 11): the
  fronts flare as it passes and the whale above catches a glow from below. Tuned by screenshots
  (110 washed the whale white; reach 8 never reached the fronts). The windows are back to exactly
  what they were.

- **The watcher** (a capsule and a tipped-back head, bone) stands on the tallest rooftop near
  `(5, -4)` on a wide screen — right of the copy — or near `(1.2, -3)` on a narrow one; at 1.8× it
  reads next to the skyline without competing with the whale. It fades in when the whale starts
  looking, and is there from the start if the night already has the `wave` event.

- **Shadows warning**: `shadows` (true) asks R3F for PCFSoftShadowMap, which three r186 removed — it
  logged "PCFSoftShadowMap has been removed" every frame in the Staircase. The Staircase now asks for
  `shadows="percentage"` (PCFShadowMap) directly. (A warning, not an error: phase 3's console check
  only counted errors.)

- **Verified** (headless Chrome, ?debug): normal movement ≠ wave; a wave keeps the fragment and
  finishes the log's line; a second wave adds nothing; coming back from the House the log is already
  complete; the keyboard action keeps it; a narrow-screen wave works; screenshots of the whale
  looking (desktop and phone), the light sweep mid-way and after; no console errors or warnings.
  `pnpm lint`, `pnpm build`, `pnpm test` clean.

- **After review — a reload is a new night** (user report: after reloading, waving did nothing but
  glance, and the light sweep could never be seen again). Phase 0 persisted the recording and the
  scene events in sessionStorage, so a reload kept "you already waved" — and the Whale's first
  reaction, which happens once a night by design (PLAN-2.md 6.2), was gone for the rest of the tab's
  life. The night now lives in memory only (`recording.js` and `play.js` events), so reloading
  starts over; within one visit the full reaction still plays once, and the ?debug "reset night"
  replays it without reloading. PLAN-2.md 3.5 and phase 0 updated. Verified: wave → fragment and full
  log; reload → blank recording, log waiting at "You wave,", no events; wave again → the whole
  reaction and the fragment again; reset night clears it; no console errors or warnings.

- **A test-reading bug, caught while checking this**: the phase 4 script read the whale's log as the
  whole overlay's text, which includes the transparent, not-yet-typed rest — so "the log finishes its
  line" and "coming back, the log is already complete" would have passed with nothing typed. Fixed
  to subtract the rest; both still pass.

## Night 2 — Phase 5

- **One shared hallway state**, written by a single frame loop in the scene (`useHouse`) and read by
  the doors, the floor spills, the kitchen and the shadows: the creep offset, each door's angle and
  "open until", the kitchen's stretch, and a fixed pool of 10 shadows. No React re-renders per frame.

- **The wrap carries the doors along.** The hallway group jumps back one bay when its offset wraps;
  the door that stood at a spot is then two indices closer (`i → i − 2`). Door angles and open timers
  are shifted with `copyWithin(0, 2)` at that moment, so an open door never pops a bay away. Shadows
  live in world space (PLAN-2.md 6.3) and add the creep to their own z, so they never jump either.

- **Clicks**: `onTap` + the projected centre of every door, nearest within 0.15 NDC (no raycast
  against the instanced leaves — the projection the hover already used is enough and cheaper). The
  kitchen doorway is checked first, against its projected rectangle as currently drawn (stretched
  or not). Only the current, settled House listens (`live`).

- **A shadow's life**: waits 0.4 s after its door swings (1.35 rad), steps out of the room 0.6 s,
  turns into a lane 0.4 s, walks 0.6-0.9 u/s with a 2 Hz bob. 60 % walk to the kitchen and fade into
  its light over the last 3 → 0.8 units before it (colour toward the kitchen's, opacity to 0, a
  touch taller); the rest walk toward you and fade out past z 1.2. Lanes ±0.35 with 30 % mixing. A
  door closes on its own after 6 s. Spontaneous doors open every 7-12 s between z −7 and −16.

- **The fragment** is kept when a shadow you released (click, tap or "Open a door") is lost in the
  kitchen's light; spontaneous shadows never count (verified: 30 s of watching, nothing). "Open a
  door" picks the closed door nearest 4.5 units ahead and always sends its shadow to the kitchen.

- **The stretch**: the kitchen draws back 6 units in 0.8 s (ease-out) and comes home over 6 s; the
  hallway grew from 11 to 14 bays (floor and ceiling with it) so its end never shows. Under reduced
  motion the kitchen's light dims and recovers instead of moving.

- **The open door's spill of light** reaches up to 4× further into the hallway as the door opens
  (the spills are no longer static instances).

- **Verified** (headless Chrome, ?debug): screenshots at rest, a door opening with its shadow
  stepping out, shadows walking into the light, the kitchen stretched — desktop and phone; clicking
  three doors → one of your shadows reaches the kitchen and keeps the fragment; the keyboard "Open a
  door" does too; the prompt is gone after a click; the house still leaves for the manual; no console
  errors or warnings. `pnpm lint`, `pnpm build`, `pnpm test` clean. Not verified: that a button
  click never opens a door (onTap ignores interactive targets by construction; not observable from
  the test without exposing state).

## Night 2 — Phase 6

- **Four levels, never crossing the surface on their own**: ankles, waist, 0.25 under your eyes,
  0.3 over them (the camera sits at 1.3). The breathing (±0.08 over 8 s) plus the swell (±0.11)
  stays inside those margins, so only a beat takes you under or back up. Each beat's rise eases over
  ~1.6 s (0.15 s under reduced motion, where it reads as a quick change).

- **Under the surface gets deeper, not paler.** The first pass thickened the fog (0.07 → 0.14 in the
  plan) in the dream's own tint — a light blue — and everything washed out to pale blue, taking the
  title's and the log's contrast with it. The fog now also turns from the tint to the deep background
  blue as you go under, at 0.1; screenshots under water keep both legible, on desktop and phone.
  Everything under-water (fog, background, floor caustics, the window's shafts) blends by the
  water's height across your eyes, not by time, so going back up undoes it the same way.

- **The lamp** (the fragment's reward) is a warm point light in the shade plus an emissive shade,
  in `--dream-stair`. It floats at the surface, above your eyes, so from below the shade itself is
  hidden — its light had to be strong enough (18, reach 8) to tint the walls, the window frame and
  the chair's legs amber. It flickers on over 1.2 s, stays lit for the night, and goes dark again on
  a new night (REPLAY or ?debug reset). Staying under means the last beat with your eyes fully below
  for 6 s while the dream is current; coming up, or leaving, starts the count over. "Stay under" from
  the keyboard takes the water all the way up and the count runs the same.

- **Ripples push what floats**: the surface simulation moved into the scene (`useRipples`), which
  steps it; Water only draws it and the furniture reads its slope to drift (damped, within 1.4 of its
  spot). Under water a moving pointer lets out bubbles (a pool of 40) that rise to the surface; none
  under reduced motion. The surface is double-sided so it reads from below.

- **Lint**: the first cut had children mutating things they received (the ripple buffers, `useMemo`
  scratch objects, the scene from `useThree`); each object is now mutated only where it's owned
  (scratch in refs, the scene through the frame state).

- **Verified** (headless Chrome, ?debug): four gestures take the water to beat 3; screenshots of each
  level, under water with bubbles, and with the lamp lit, on desktop and phone; six seconds under
  keeps the fragment; leaving for the fall and coming back lands under water again; no console errors
  or warnings. `pnpm lint` (no warnings), `pnpm build`, `pnpm test` clean.

- **After review — House clicks stopped working (intermittent), and a second bug found on the way.**
  - *House*: clicking a door or the kitchen did nothing. Instrumented: the scene had mounted as the
    Whale's neighbour with `live={false}` and, in failing runs, never received `live={true}` once the
    House became current — so it never subscribed to taps. The prop travelled section → DreamFrame →
    SceneCanvas → LiveCanvas → R3F `<Canvas>` (its own reconciler, behind a lazy Suspense) → scene,
    and that last hop sometimes didn't land; which run failed depended on timing (adding a log in
    the section made it pass). Rather than chase the race, the prop is gone: `night/stage.js` is a
    tiny store of the section on screen and whether it's settled, written by App from
    ScrollSections' `onStateChange`, and each scene reads `useLive(id)` itself — the update now starts
    inside the scene's own tree. Applied to all four scenes that listen (Stair, Whale, House, Ocean).
    Verified: the House checks pass 3/3; Whale and Ocean checks pass.
  - *Staircase*: re-running its checks after that change showed the fragment sometimes not kept after
    climbing back — also on the real GPU (2 of 3 runs). Cause: catching up ran while `s < −0.001` and
    the fragment was awarded on reaching `s ≥ 0`; a step landing `s` inside (−0.001, 0) left the
    figure "not catching up" and never "back" — a thousandth of a step short of its place forever,
    more likely the higher the frame rate. Now it catches up while `s < 0` and arrives within 1e-4.
    Verified 4/4 on the GPU, all seven checks each time. (Phase 3's single passing run was luck.)

- **After review — two fragments come faster** (user request):
  - *Staircase*: kept after **5 s stopped** (holding, or "Stop climbing", which now stops 5.5 s),
    counted in real seconds — no longer when the figure climbs back to its place after being carried
    2 steps. The stair still carries you and you still climb back; only the reward moved earlier.
  - *House*: kept **5 s after someone steps out of a door you opened** (click, tap or "Open a
    door") — no longer when your shadow reaches the kitchen's light (~20 s of walking, long enough to
    move on to the next dream without it). Spontaneous shadows still never count.
  - PLAN-2.md 6.1, 6.3 and 13.2 updated. Measured (GPU): a 2 s hold earns nothing; holding earns it
    at 5.3 s; "Stop climbing" at 5.1 s; a clicked door at 5.4 s; no console errors or warnings.

## Night 2 — Phase 7

- **The scroll is depth**: fall speed × (1 + 1.5·progress) (and × 0.4 while you look up), speed lines
  0.35 → 0.6 opacity, the HUD clock 06:41 → 07:01 and counter to 00:58:31 (phase 2's `clockTo` /
  `counterTo`).

- **The alarm**: a pool of 12 thin `--rec` rings rising from below out of the light, one every 3 s at
  the top down to three a second at the bottom (¼ as often under reduced motion); past 0.6 each ring
  also pulses the fog toward `--rec`. In the HUD, a new `hud.recTo` (0.3 for the Fall) runs the REC
  dot's blink from 1.2 s down to it with the scrub — a CSS variable set on the HUD only, in 0.05 s
  steps, so TapeLabel's REC dots inside the sections keep their pace.

- **The light below doesn't fill the frame** (PLAN-2.md 6.5 said it nearly would). Screenshots at the
  bottom showed it covering the title and the log — bone on bone, unreadable — and on a phone, where
  they span the whole width, covering the title outright. It's capped (scale 34, set 2.5 right) on a
  wide screen, and smaller (15) and pushed up the frame on a portrait one; the rings rise from under
  it. The white burn into Wake still starts from it. PLAN-2.md 6.5 updated.

- **Letting go**: pointer still 3 s (not pressed), progress under 0.9, the Fall current → the camera
  turns up (eased, 1.8 s), the tremor and steering fade, the fall slows. The fragment and the log's
  `let-go` event come when the turn passes 0.9 — at 0.97 (the first cut) the eased turn took ~4.7 s
  more, ~7.7 s from the last move; 0.9 looks the same and arrives ~1 s sooner. "Let go" from the
  keyboard looks up for 5 s.

- **The night above is drawn locally, not by reusing WhaleBody and Lamp** (as PLAN-2.md 6.5 sketched):
  those use lit, fogged materials; the silhouettes need flat unlit colour and their own opacity. Four
  small groups — a spiral stair, a whale, a lit door, the lamp — kept ones in their dream's tint with a
  halo (the lamp amber), the rest as cut-outs in `--line-strong` (`--line` was invisible against the
  sky). Placed clear of the title block; on a portrait screen they move up. Only drawn while looking up.

- **Verified** (headless Chrome on the GPU, ?debug): entered from Wake the Fall is at its bottom
  (REC 0.30 s), at its top 1.20 s; keeping still turns you up, keeps the fragment and types "being let
  go of"; "Let go" from the keyboard keeps it; the Fall still melts into Wake; screenshots at 0 / 0.5 /
  1, looking up (with stair, whale and ocean kept) and the burn, on desktop and phone — title and log
  readable in all of them; no console errors or warnings. `pnpm lint`, `pnpm build`, `pnpm test`
  clean.
