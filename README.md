# Onirick — DR-1 Dream Recorder

**Onirick** makes the **DR-1**, a fictional 1986 dream recorder that sits on your nightstand. The site is one night of sleep, told through scroll:

1. You start in front of the device.
2. You fall asleep and move through three dreams — every step from one dream to the next is a *melt*.
3. At **03:40 you wake up**: the page turns to paper, cold and technical — the DR-1's manual, with normal scrolling.
4. You fall back asleep into two deeper dreams.
5. At **07:02 you wake**: the last melt burns to white and the closing screen appears.

The melt is the act of passing from one dream to another, so it **intensifies through the night**: the first transition is subtle, the last one almost breaks the page.

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

Navigation: mouse wheel / trackpad, touch swipe, arrow keys and Page Up/Down (one section per gesture), Home/End for the first and last section.

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
  night/stage.js               which section is on screen and settled, for the scenes
  night/<Section>/             one folder per screen (copy + its 3D scene)
  components/ScrollSections/   the scroll engine: gestures, captures, melts and crossfades
  components/SceneCanvas/      R3F canvas wrapper with the capture rules below
  lib/morph/                   MorphEngine (ogl) + the melt shader
  components/Transcript/       a dream's log, typed as it's revealed
  components/DreamAction/      the keyboard/screen-reader way to do a dream's thing
  components/DebugPanel/       ?debug (dev only)
  three/                       shared 3D pieces: the DR-1, camera drift, materials, usePlayProgress
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

## Deploy

A static site: `pnpm build` produces `dist/`. On Vercel, import the repository — Vite is detected (build `pnpm build`, output `dist`); `vercel.json` adds long-term caching for hashed assets.

After the first deploy, make the Open Graph image absolute: set `og:image` in `index.html` to `https://<your-domain>/posters/hero.webp`.

## Credits

- Design, code and direction: Nicolás Lema.
- Typefaces: [Instrument Serif](https://fonts.google.com/specimen/Instrument+Serif) and [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono), both SIL Open Font License, served by Google Fonts.
- All 3D models are procedural (three.js primitives); no external assets.
- Libraries: React, Vite, three.js, React Three Fiber, drei, maath, ogl, GSAP, modern-screenshot.
