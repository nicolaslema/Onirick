# Onirick — DR-1 Dream Recorder

**Onirick** makes the **DR-1**, a fictional 1986 dream recorder that sits on your nightstand. The site is one night of sleep, told through scroll:

1. You start in front of the device.
2. You fall asleep and move through three dreams — every step from one dream to the next is a *melt*.
3. At **03:40 you wake up**: the page turns to paper, cold and technical — the DR-1's manual, with normal scrolling.
4. You fall back asleep into two deeper dreams.
5. At **07:02 you wake**: the last melt burns to white and the closing screen appears.

The melt is the act of passing from one dream to another, so it **intensifies through the night**: the first transition is subtle, the last one almost breaks the page.

The night has sound, on by default: the DR-1's tape plays a piece of music while it records, and each dream answers what you do with a sound of its own (see [Sound](#sound)).

Each dream can also be *played*: it has one intentional thing to do — stop climbing, wave at the whale, open a door, sink, let go — and doing it lets the DR-1 keep a **fragment** of the dream. Wake prints what you kept, and you can save the tape as an image. Someone who only scrolls still sees a whole night; the tape just comes out blank.

It's fiction, and the last screen says so — a portfolio piece in scroll-driven motion. There's no store and no real form.

**Live:** _add the deploy URL here_

## Running it

Requires Node 20.19+ (or 22.12+) and [pnpm](https://pnpm.io) 10 (the repo pins `pnpm@10.17.0`).

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # static site in dist/
pnpm preview    # serve dist/ locally
pnpm lint       # oxlint
pnpm posters    # regenerate public/posters/*.webp (needs `pnpm dev` running and Google Chrome installed)
```

Navigation: mouse wheel / trackpad, touch swipe, arrow keys and Page Up/Down (one section per gesture), Home/End for the first and last section. The night itself starts from the hero with BEGIN RECORDING or an arrow key — the wheel and a swipe don't leave the hero (they make the button pulse), so everyone clicks or types before the dreams and the sound can start.

## Stack

React 19 + Vite, plain CSS with custom properties (`src/styles/tokens.css`), [React Three Fiber](https://r3f.docs.pmnd.rs) + three.js for the 3D scenes (all procedural, low-poly, flat-shaded), [ogl](https://github.com/oframe/ogl) + GSAP for the melt, [modern-screenshot](https://github.com/qq15725/modern-screenshot) to capture sections.

```
src/
  App.jsx                      the night: HUD, grain, blur bands, loader, <ScrollSections>
  night/config.js              the sections in order, their HUD data, play model and per-transition parameters
  night/dreams.js              each dream's words: log lines, fragment, action label, hint
  night/play.js                per-dream play state (progress, beats, events) — a store outside React
  night/gate.js                the gate: which gestures a dream keeps before the night moves on
  night/recording.js           what the DR-1 kept tonight (fragments; lucidity is their count)
  night/stage.js               which section is on screen and settled (and the transition in flight), for the scenes and the sound
  night/score.js               the night's sound: what plays where, tied to the stage, the play state and the recording
  night/dreamSounds.js         each dream's own sounds (steps, the whale's call, doors, water, the alarm, Wake's lines)
  night/tapeRules.js           when the tape starts, stops, rewinds — a pure function, tested
  night/music.js               the piece on the tape: its file, loop points and level
  night/<Section>/             one folder per screen (copy + its 3D scene)
  components/ScrollSections/   the scroll engine: gestures, captures, melts and crossfades
  components/SceneCanvas/      R3F canvas wrapper with the capture rules below
  lib/morph/                   MorphEngine (ogl) + the melt shader
  components/Transcript/       a dream's log, typed as it's revealed
  components/DreamAction/      the keyboard/screen-reader way to do a dream's thing
  components/DebugPanel/       ?debug (dev only)
  three/                       shared 3D pieces: the DR-1, camera drift, materials, usePlayProgress
  sound/                       the sound engine, knowing nothing of the night: bus (first chunk), engine, tape, machine, synthesis
  components/SoundToggle/      SOUND ON / OFF, in the HUD
scripts/posters.mjs            renders one poster per 3D section
```

## How the melt works

Every section is real, accessible DOM, stacked full-screen; only the current one is on screen, the rest are moved off it with a `transform`. The melt is a separate full-screen WebGL canvas that exists only for the duration of a transition:

1. **Capture.** Each section is photographed into a canvas. A section with a 3D scene is composed from its live `<canvas>` plus a text-only overlay of its DOM (captured once with `modern-screenshot`, scene left out, background transparent). The current section's neighbours are captured ahead of time, so a gesture can start a melt immediately.
2. **Melt.** Both captures become textures of a single fragment shader: fbm noise warps the outgoing image more and more while the incoming one resolves from the same noise, with chromatic aberration, drift and a vignette tint peaking mid-transition. A GSAP tween drives the progress.
3. **Stay live.** While the melt runs, both textures are re-composed from the scenes' live canvases every frame, so the 3D keeps moving *inside* the melt instead of freezing and popping at the end.
4. **Settle.** At the end, the canvas fades out over the now-current section — which by then looks exactly like the last frame.

Each transition's parameters (duration, ease, intensity, noise scale, aberration, drift, overlay color, burn to overlay) live on the destination section in `night/config.js` and apply in both directions; transitions touching the manual, jumps between non-adjacent sections and the no-WebGL fallback are plain crossfades instead.

That design imposes a few rules on every 3D section (`SceneCanvas` enforces them):

- one `<canvas>` per section, with `preserveDrawingBuffer: true`, or the capture comes out black;
- the canvas flags when its first complete frame has rendered, and captures wait for it;
- every section paints an opaque background;
- non-current sections are moved away with a `transform`, never hidden with `display`, `visibility` or `opacity` — hidden elements capture blank;
- the HUD, grain, loader and blur bands live outside the sections, so they never melt.

Only the current section and its two neighbours keep a live 3D scene; the rest unmount and show a poster (`public/posters/`), which is also what a browser without WebGL2 gets, along with crossfades everywhere.

With `prefers-reduced-motion`, the melt becomes a plain blend, crossfades and reveals turn off, there's no parallax or blinking, counters jump straight to their value and scene animation runs at a quarter speed.

Design and engineering decisions made along the way are logged in [`DECISIONS.md`](DECISIONS.md).

## Playing the night

### The gate

`ScrollSections` knows nothing about dreams. It takes an optional `gate` (built by `night/gate.js` from the config) and asks it, by section index, before a gesture may leave:

- `canLeave(index, dir)` — false while the dream still has somewhere to go in that direction;
- `consume(index, dir, { source, deltaPx, step })` — the gesture the dream kept instead;
- `prepare(index, entryDir)` — set a neighbour to the state it will be entered in (its start going down, its end coming back up), before it's captured for the melt;
- `reset(index)` — forget a dream you left.

The edge rule is the same as the manual's scroll: the gesture that carries a dream to its end never melts; the next one does.

### Play models

Each dream declares one in `night/config.js`:

| Model | Used by | What a gesture does |
| --- | --- | --- |
| `scrub` — `{ length, stops }` | Stair, Fall | wheel and finger move a 0–1 progress (`length` px for the whole dream); keys jump to the next stop, tweened |
| `beats` — `{ beats, beatDuration }` | Ocean | one step per gesture; while a beat plays out, further gestures are swallowed |
| `free` | Whale, House | nothing — the dream is played with the pointer, and one gesture leaves |

The state lives in `night/play.js`, outside React: `target` (the progress or beat the gate set), `events` (things that happened: `'wave'`, `'door'`…) and `reveal` (how many log lines are out). A scene reads its progress with `usePlayProgress(id)`, which eases toward the target every frame and invalidates on-demand canvases; it only listens to the visitor while `useLive(id)` (`night/stage.js`) says it's the dream on screen and settled.

**Adding a model:** give it a name and its parameters in the section's `play`, teach `gate.js` its `canLeave` / `consume` / `prepare` (and the last value, for `prepare` going up), and give its log lines an `at` on the same scale as its `target` in `dreams.js` — the reveal and the transcript need nothing else. The debug panel draws buttons for `scrub` stops and `beats`; a new model adds its own there.

### Fragments, lucidity, the transcript

- A dream's log (`dreams.js` `lines`) is revealed by progress (`at`), by an event (`on`), or whichever comes first, and typed by `Transcript`. The typed text is an overlay on an invisible copy of the whole log, so nothing moves as it types; a section is re-captured once its text finishes.
- Doing a dream's thing calls `keep(id)` (`night/recording.js`): the fragment is kept, announced, and the HUD's **lucidity** (five segments, one per dream) fills in. The recording is in memory only — a reload is a new night.
- Every interaction has a `DreamAction`: a real button, reachable by keyboard and screen reader, that does the same thing as the pointer.
- **Wake** prints the tier line and the tape's log (`— no signal —` for what you missed), labels the ejected tape with the night's date and count, and offers **Save the tape** — a 1200×630 PNG, shared through the system sheet on phones and downloaded elsewhere. **Replay the night** resets everything.

### `?debug`

In development, `?debug` in the URL opens a panel with the current dream's play state and buttons to set its stops, beats and events, keep or forget any fragment, and reset the night — so every Wake variant can be checked without playing through. It's never in a production build.

## Sound

**On by default, and it waits for you.** The HUD's toggle reads SOUND ON from the first paint, but no browser plays audio before the visitor interacts — so the sound starts on the first click, tap or key anywhere. The wheel and a trackpad don't count as a gesture to browsers, which is why the hero only lets the night begin from BEGIN RECORDING or an arrow key (`keysOnly` in `night/config.js`). Nothing is downloaded before that gesture (the sound engine and the music load then), so it costs the page's first load nothing. The toggle turns it off; each visit starts on again. With the tab hidden it's suspended.

**The tape.** The music is what's on the DR-1's tape: it plays only while the DR-1 records (the five dreams), spins up with the motor as you fall asleep, tape-stops — speed and pitch falling — into the manual and at Wake, and carries on from where it stopped; REPLAY THE NIGHT rewinds it. Every melt bends it like stretched tape (a delay swung by an LFO), more deeply as the night goes on, and the burn into Wake stops it dead by the white. Under it, barely there, the motor and the tape's hiss; STOP and eject at Wake. Its level, a slow compressor and the loop across its two quietest seconds are in `night/music.js`.

**The dreams.** Each answers what happens in it, in the same frame it happens: the Staircase's steps as each foot lands, the whale's call when you wave (the music ducks under it), a door's latch, the kitchen taking the music with it as it recedes, the Ocean's water rising, everything muffled once you're under — crossing with the camera, and surfacing through the melt out —, bubbles, the Fall's *bip bip* growing louder as you fall, a rush of air through each ring, and on Wake a printer pass for each line, a soft chord for each fragment kept and static for each *no signal*. Everything but the music is synthesized in the browser (Web Audio: oscillators, generated noise, filters, generated reverbs) — no sound files.

**How it's built.** `sound/bus.js` is the only piece in the first chunk: `cue(name, options)` for a one-off and `param(name, value)` for a continuous value, both a no-op while sound is off, so scenes call them freely (even every frame). `night/score.js` builds the engine (`sound/engine.js`: layers → melt wow → under-water lowpass → master → limiter), the tape (`sound/tape.js`: two `<audio>` decks through `MediaElementSource`, taking turns at the loop) and the DR-1 (`sound/machine.js`), and ties them to `night/stage.js`, `night/play.js` and `night/recording.js`. A dream's sounds only play while that dream is on screen or melting in or out.

**Adding a sound to a dream:** write it in `night/dreamSounds.js` (into the `scene` layer, so melts bend it), give it a cue in `night/score.js` wrapped in `inDream('<id>', …)`, and call `cue('<name>', …)` from the scene where the thing happens. For something continuous, have the scene write `param('<dream>.<name>', value)` every frame and apply it in the score's `follow()` loop, through `through()` so it fades across transitions.

**Music:** Chopin, from the *Études* Op. 10, a public-domain recording from Musopen — see [CREDITS.md](CREDITS.md).

**iOS:** Web Audio respects the iPhone's silent switch: with it on, there's no sound. Not verified on devices yet.

`?debug` also shows the sound: the context's state, a meter per layer (RMS and peak) and on the master, the limiter's reduction, the melt's wow, the under-water filter and the music's distance, a click counter, the tape's state with buttons to start, stop, rewind or jump near its loop, and one button per sound.

## Deploy

A static site: `pnpm build` produces `dist/`. On Vercel, import the repository — Vite is detected (build `pnpm build`, output `dist`); `vercel.json` adds long-term caching for hashed assets.

The Open Graph tags in `index.html` (`og:url`, `og:image`) point at `https://onirick.vercel.app/` — update both if the domain changes.

## Credits

- Design, code and direction: Nicolás Lema.
- Typefaces: [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), both SIL Open Font License, served by Google Fonts.
- All 3D models are procedural (three.js primitives); no external assets.
- Music (optional, SOUND ON): Chopin, from the Études Op. 10, a public-domain recording from [Musopen](https://musopen.org/music/610-etudes-op-10/) — see [CREDITS.md](CREDITS.md). The DR-1's own sounds are synthesized.
- Libraries: React, Vite, three.js, React Three Fiber, drei, maath, ogl, GSAP, modern-screenshot.
