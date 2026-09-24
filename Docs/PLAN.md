# PLAN.md — Onirick DR-1

> Plan de desarrollo para un agente de IA. Repositorio: `nicolaslema/Onirick` (base: commit `b75391f`, rama `main`).
> Idioma de este documento: español. **Todo el texto visible de la web va en inglés** (el copy está en la sección 6).

---

## 0. Cómo usar este plan (instrucciones para el agente)

1. **Leé el plan completo antes de tocar código.** Después leé estos archivos del repo, que son la base técnica y no se reescriben desde cero:
   - `src/components/ScrollSections/ScrollSections.jsx`
   - `src/components/ScrollSections/useSectionTextures.js`
   - `src/components/ScrollSections/useWheelProgress.js`
   - `src/lib/morph/MorphEngine.js`
   - `src/lib/morph/shaders.js`
   - `src/components/GradualBlur/GradualBlur.jsx`
2. **Trabajá por fases (sección 8), en orden.** No empieces una fase hasta que la anterior cumpla todos sus criterios de "terminado".
3. **Un branch por fase** (`phase-0-foundation`, `phase-1-engine`, …) y commits chicos con mensajes descriptivos. No pushees a `main` sin que el usuario lo apruebe.
4. **Al terminar cada fase**, corré `pnpm lint` y `pnpm build`, verificá los criterios y escribí un resumen corto: qué hiciste, qué quedó pendiente, capturas si podés.
5. **Si una decisión no está en este plan y cambia el resultado visual o la arquitectura, preguntá.** Para detalles menores, elegí lo más simple y dejalo anotado en `DECISIONS.md`.
6. **No inventes valores de diseño.** Colores, tipografías, espaciados y tiempos salen de este plan (apéndices A y B, secciones 4 y 5).
7. **Gestor de paquetes: `pnpm`** (el repo declara `pnpm@10.17.0`).

---

## 1. Concepto

**Onirick** fabrica el **DR-1**, una grabadora de sueños ficticia de 1986 que se pone en la mesa de luz. La web es **una noche de sueño**:

1. Empezás frente al aparato (hero).
2. Te dormís y atravesás **tres sueños**. Cada paso de un sueño a otro es la transición *melt*.
3. A las **03:40 te despertás**: la página se vuelve papel, fría y técnica. Es el manual del DR-1, con scroll normal.
4. Te volvés a dormir y entrás en **dos sueños más profundos**.
5. A las **07:02 te despertás**: el último melt se quema a blanco y aparece el cierre.

**La idea que sostiene todo:** el melt *es* el acto de pasar de un sueño a otro. Por eso **se intensifica a lo largo de la noche**: la primera transición es sutil y la última casi rompe la página.

**Dos voces en cada pantalla:**

- **La máquina:** mono, mayúsculas, etiquetas de cinta (`TAPE 02 · 03:12 AM · REM 3`), un HUD fijo con contador.
- **El sueño:** serif itálica enorme, escenas 3D low-poly con niebla, frases cortas en segunda persona.

**Referencias de tono** (no copiar): webs de Awwwards con narrativa por scroll, estética de manuales técnicos de los 80, cintas de casete, fotografía nocturna con niebla.

**Es ficción y la web lo dice** en la última pantalla. Es una pieza de portfolio: no hay tienda ni formulario real.

---

## 2. Stack y decisiones técnicas

| Área | Decisión |
| --- | --- |
| Base | React 19 + Vite 8 (ya en el repo). JavaScript, sin TypeScript, para no frenar el proyecto; se puede migrar después. |
| Transición | `MorphEngine` (ogl + GSAP) y `ScrollSections`, ya en el repo. Se extienden, no se reemplazan. |
| 3D de escenas | **React Three Fiber** (`@react-three/fiber` ^9, `@react-three/drei` ^10, `three` ^0.186; ya instalados) + `maath` para suavizados (ya instalado). |
| Animación de UI | GSAP (ya instalado). `motion` está instalado pero no se usa: sacarlo si no hace falta. |
| Captura para el melt | `modern-screenshot` (ya instalado, lo usa `useSectionTextures`). |
| Fuentes | Google Fonts: **Instrument Serif** (400 regular e itálica) y **JetBrains Mono** (400/500/600). |
| Estilos | CSS plano con custom properties (`src/styles/tokens.css` y `src/styles/components.css`, apéndices A y B) + un CSS por componente. Sin Tailwind. |
| Deploy | Vercel o Netlify, sitio estático (`pnpm build` → `dist/`). |

**Dependencias nuevas permitidas:** ninguna obligatoria. Si hace falta postprocesado (grano), usar primero un overlay CSS con un PNG de ruido; `@react-three/postprocessing` solo si el usuario lo aprueba.

---

## 3. Arquitectura

```
src/
  main.jsx
  App.jsx                    ← lista NIGHT de secciones + HUD + GradualBlur + Grain + Loader
  styles/
    tokens.css               ← apéndice A (copiar tal cual)
    components.css           ← apéndice B (copiar tal cual)
    global.css               ← reset mínimo, body, fuentes
  lib/morph/                 ← existente; se agrega syncOptions explícito
  components/
    ScrollSections/          ← existente; se extiende (fase 1)
    GradualBlur/             ← existente, sin cambios
    Hud/Hud.jsx
    TapeLabel/TapeLabel.jsx
    DreamTitle/DreamTitle.jsx
    SpecTable/SpecTable.jsx
    Loader/Loader.jsx
    Grain/Grain.jsx
    SceneCanvas/SceneCanvas.jsx   ← wrapper de <Canvas> de R3F con las reglas de captura
  night/                     ← una carpeta por sección
    config.js                ← NIGHT: orden, tipo, parámetros de transición, datos del HUD
    Hero/      (Hero.jsx, DeviceScene.jsx, Hero.css)
    DreamStair/ DreamWhale/ DreamHouse/ DreamOcean/ DreamFall/
    Manual/    (Manual.jsx, Manual.css)
    Wake/
  three/                     ← piezas 3D reutilizables
    DR1.jsx                  ← el aparato (hero y wake)
    useCameraDrift.js        ← parallax de cámara con el puntero
    materials.js             ← flat shading, niebla por tinte
  legacy/                    ← experimentos que no se usan (se mueven acá en la fase 0)
public/
  posters/                   ← un .webp por sección 3D (fase 6)
  noise.png                  ← textura de grano
```

### 3.1 Reglas de captura

El melt **fotografía cada sección** (`domToCanvas`) y la usa como textura. Mientras dura la transición, `refresh()` copia cada 80 ms el `<canvas>` vivo de la sección sobre la captura. Esto impone reglas duras a cada sección 3D:

1. **Un solo `<canvas>` por sección**, el de R3F. `refresh()` y `prepareOverlay()` usan `el.querySelector('canvas')`, o sea, el primero que encuentran.
2. El `<Canvas>` de R3F necesita `gl={{ preserveDrawingBuffer: true }}`. Sin eso la captura sale negra.
3. El canvas tiene que marcar `data-async-ready="true"` cuando renderizó el primer frame con la escena completa (modelos cargados). Hasta entonces, `data-async-ready="false"`. `waitForCanvasesReady` espera ese atributo.
4. **La raíz de cada sección pinta su fondo opaco** (`background: var(--surface)`). Nunca transparente.
5. **Las secciones que no son la actual no se ocultan** con `display`, `visibility` u `opacity`. Ya se mueven fuera de pantalla con `transform`; no cambiar ese mecanismo.
6. `SECTION_BG` en `useSectionTextures.js` pasa a `#07080d` (el `surface` de night).
7. **El HUD, el grano, el loader y las bandas de blur viven fuera de las secciones**, así no se capturan ni se derriten. El HUD queda nítido encima de todo.

`SceneCanvas` encapsula las reglas 1 a 3:

```jsx
// components/SceneCanvas/SceneCanvas.jsx (esqueleto)
<Canvas
  gl={{ preserveDrawingBuffer: true, antialias: false }}
  dpr={[1, 1.75]}
  frameloop={active ? 'always' : 'demand'}
  onCreated={({ gl }) => { gl.domElement.dataset.asyncReady = 'false' }}
>
  <Suspense fallback={null}>
    {children}
    <MarkReady />   {/* en el primer useFrame tras cargar: dataset.asyncReady = 'true' */}
  </Suspense>
</Canvas>
```

### 3.2 Montaje perezoso del 3D

Ocho secciones con un contexto WebGL cada una es demasiado. Regla:

- **Se montan en vivo** la sección actual y sus dos vecinas (`index ± 1`): son las únicas que pueden participar de una transición.
  - La actual usa `frameloop="always"`.
  - Las vecinas usan `frameloop="demand"` e invalidan un frame al montarse (para la captura) y cada 80 ms durante una transición en la que participan.
- **El resto se desmonta** y muestra su póster (`public/posters/<id>.webp`) como `<img>` de fondo. Así hay como máximo 3 contextos de R3F + 1 del melt.
- `ScrollSections` expone el índice actual y el estado de la transición por contexto (`NightContext`) para que cada sección sepa si está `active`, `neighbor` u `offstage`.

---

## 4. Dirección visual

Resumen de lo necesario. Los valores exactos están en el apéndice A y en el design system "Onirick" (artifact).

### 4.1 Color

- **Dos temas:**
  - `night` (hero, cinco sueños, wake).
  - `paper` (solo el manual), que se aplica con `data-theme="paper"` en la raíz de esa sección.
  - Los tokens `surface`, `ink`, `ink-muted`, `ink-faint`, `line`, `line-strong`, `rec`, `on-rec` y `focus` cambian solos.
- **`rec` es el único acento:** punto de grabación, estado "grabando" y cinta activa en el HUD.
- **Cada sueño tiene un tinte** (`dream-stair`, `dream-whale`, `dream-house`, `dream-tide`, `dream-fall`) para:
  - la niebla y la luz principal de su escena 3D (convertir el hex a `THREE.Color`);
  - el color de su título.
  - Un tinte por pantalla; nunca en controles.
- **Nada de gradientes decorativos.** La atmósfera sale de la niebla 3D, el grano y el melt.
- **Contraste:** todos los pares de texto definidos cumplen WCAG AA en los dos temas. No usar colores fuera de los tokens.

### 4.2 Tipografía

- **`--font-serif` (Instrument Serif):**
  - `dream-title`: itálica, `clamp(56px, 10vw, 144px)`, interlineado 0.9, tracking -0.02em.
  - `display`: `clamp(44px, 6.5vw, 88px)`, interlineado 0.95.
  - `heading`: `clamp(32px, 4vw, 48px)`.
  - `lede`: 28px, interlineado 1.25.
- **`--font-mono` (JetBrains Mono):**
  - `body`: 15px, interlineado 1.6, máximo 38ch.
  - `small`: 13px.
  - `tape-label`: 12px, 500, tracking 0.12em, mayúsculas.
  - `button`: 13px, 600, tracking 0.08em, mayúsculas.
  - `spec-value`: 32px, 500.

### 4.3 Layout

- **Todas las pantallas de sueño usan el mismo marco:**
  - Escena 3D a pantalla completa.
  - Abajo a la izquierda, un bloque `DreamTitle` (TapeLabel → título → log), a `space-24 + space-4` del borde inferior.
  - HUD en las esquinas.
- **Márgenes laterales:** `space-12` en desktop y `space-4` en mobile.
- **El título del sueño puede sangrar** hasta `space-12` fuera del borde izquierdo. El resto queda dentro de la grilla.
- **Bandas de GradualBlur** de 6rem arriba y abajo (se conservan las de `App.jsx`). Nada legible adentro.
- **Esquinas cuadradas** (`radius-none`). Sin sombras. Líneas finas (`line`) para separar.

### 4.4 Estilo 3D (todas las escenas)

- **Low-poly con flat shading:** `MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 })`. Geometría procedural con primitivas de three; no hace falta modelar en Blender.
- **Niebla** `FogExp2` del tinte del sueño, densidad entre 0.045 y 0.08. `scene.background` en `#07080d` mezclado 15% con el tinte.
- **Una luz principal** (direccional o puntual) del tinte + `hemisphereLight` tenue. Sin sombras dinámicas, salvo que el rendimiento sobre.
- **Cámara con parallax del puntero** (`useCameraDrift`): 0.15 rad de yaw y 0.08 rad de pitch, suavizado con `easing.damp3` de `maath` (smoothTime 0.35). Se apaga con reduced motion.
- **Grano:** overlay CSS fijo con `noise.png` al 6–8% de opacidad y `mix-blend-mode: overlay`, fuera de las secciones.
- **Modelos externos:** solo CC0 y registrados en `CREDITS.md`. Preferir procedural.

---

## 5. Motion

### 5.1 La noche, transición por transición

La transición *i* une la sección *i − 1* con la sección *i*. Sus parámetros viven en la entrada de la sección de destino (`melt` o `plainDuration`) y **se usan igual en las dos direcciones**.

| # | De → a | Tipo | Duración | Ease | intensity | scale | aberration | drift | overlayColor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Hero → Dream 01 Staircase | melt | 1.6s | power2.inOut | 0.45 | 4 | 0.15 | 0.3 | `#000000` |
| 2 | Dream 01 → Dream 02 Whale | melt | 1.5s | power2.inOut | 0.65 | 5 | 0.25 | 0.4 | `#000000` |
| 3 | Dream 02 → Dream 03 House | melt | 1.5s | power2.inOut | 0.85 | 5 | 0.35 | 0.4 | `#000000` |
| 4 | Dream 03 → Manual | crossfade | 0.45s | ease-out | — | — | — | — | — |
| 5 | Manual → Dream 04 Ocean | crossfade | 1.2s | ease-in-out | — | — | — | — | — |
| 6 | Dream 04 → Dream 05 Fall | melt | 1.7s | power3.inOut | 1.05 | 6 | 0.5 | 0.55 | `#000000` |
| 7 | Dream 05 → Wake | melt | 2.2s | power3.inOut | 1.25 | 7 | 0.7 | 0.6 | `#f2efe8` (blanco) |

### 5.2 Movimiento de interfaz

| Dónde | Valor |
| --- | --- |
| Punto REC | Opacidad 1 → 0.25, 1.2s `steps(2)` infinito. Fijo con reduced motion. |
| Contador del HUD | En cada cambio de sección cada dígito "scramblea" 0.4s y se asienta en el valor nuevo, de izquierda a derecha, con 30 ms de desfase. |
| Texto de los sueños | Forma parte de la captura: se derrite con la escena. **Sin animación de entrada después del melt** (se vería como un parpadeo). |
| Hero, primera carga | Después del loader: TapeLabel, display, body y botones entran con fade + 12px hacia arriba, 0.6s `power2.out`, 80 ms de stagger. |
| Manual | El reveal al hacer scroll ya existe en el repo (`Proof.jsx`: fade + 16px, 0.5s, umbral 35%). Reutilizarlo. |
| Botones | 0.15s ease: el primario se invierte y el secundario cambia el borde a `ink`. |
| Loader | Un contador de cinta sube de `00:00:00` mientras cargan las fuentes y se capturan las secciones 0 y 1; después el hero aparece desde `night` (0.8s). |

### 5.3 Reduced motion

Con `prefers-reduced-motion: reduce`:

- El melt se vuelve una mezcla simple (`uReduce`, ya existe).
- Los crossfades y reveals se apagan (ya existe en el CSS).
- Sin parallax de cámara y sin parpadeo del REC.
- Los contadores saltan directo al valor final.
- Las animaciones internas de las escenas bajan al 25% de velocidad.

---

## 6. Secciones y copy

El copy es definitivo salvo que el usuario diga lo contrario. HUD = esquina superior derecha (estado) y esquina inferior derecha (contador de cinta).

### 6.0 Hero: the device

- **Tipo:** morph · **Tema:** night · **HUD:** `STANDBY` · `11:58 PM` · contador `00:00:00`
- **Escena:**
  - El DR-1 en 3D, en el centro-derecha y girado unos 20°. Es una caja de 142 × 96 × 38 con bordes biselados, color hueso.
  - Tiene una ventana de casete con dos carretes que giran lento, un LED REC que parpadea en `rec`, y un dial y dos teclas que se hunden en hover (raycast de R3F).
  - El puntero lo inclina (±8°).
  - Fondo `night` con niebla neutra.
- **Copy:**
  - TapeLabel: `DR-1 · DREAM RECORDER · 1986`
  - Display: **Every night you lose about six dreams. Keep one.**
  - Body: *The Onirick DR-1 sits by your bed and records the one that matters. Press REC, close your eyes, and scroll.*
  - Botón primario: `BEGIN RECORDING` → siguiente sección
  - Secundario: `READ THE MANUAL →` → salta a la sección Manual (con crossfade)
  - Pista abajo al centro, en `tape-label`: `SCROLL TO FALL ASLEEP ↓`

### 6.1 Dream 01: The Staircase

- **Tipo:** morph · **Tinte:** `dream-stair` · **HUD:** `● REC` · `02:47 AM` · `00:06:31`
- **Escena:**
  - Una escalera caracol infinita: peldaños `BoxGeometry` instanciados (`InstancedMesh`, unos 120) alrededor de un eje, subiendo hacia la niebla ámbar.
  - Cada 12 peldaños, un marco de ventana con una luna (disco emisivo). Es siempre la misma ventana.
  - La escalera gira 0.02 rad/s y la cámara mira hacia arriba.
  - El puntero rota la escalera, además del parallax.
- **Copy:**
  - TapeLabel: `TAPE 01 · 02:47 AM · REM 2`
  - Título: **The Staircase**
  - Log: *You are climbing. You have been climbing for a long time. Every landing has the same window, and the same moon in it. The handrail is warm, like someone just let go.*

### 6.2 Dream 02: The Whale Above the City

- **Tipo:** morph · **Tinte:** `dream-whale` · **HUD:** `● REC` · `03:12 AM` · `00:14:22`
- **Escena:**
  - Techos de ciudad low-poly: una grilla de cajas instanciadas con tanques de agua y antenas, y pocas ventanas encendidas (emisivas en el tinte).
  - Una ballena low-poly procedural (icosaedro estirado + aletas y cola de conos, flat shading) nada un recorrido de 40s entre los techos.
  - El puntero corre las nubes (planos con alfa) y hace que la ballena gire un poco el ojo hacia el cursor.
- **Copy:**
  - TapeLabel: `TAPE 02 · 03:12 AM · REM 3`
  - Título: **The Whale Above the City**
  - Log: *It swims slowly between the rooftops. Nobody looks up. You wave, and it turns one eye toward you.*

### 6.3 Dream 03: The House You Grew Up In

- **Tipo:** morph · **Tinte:** `dream-house` · **HUD:** `● REC` · `03:31 AM` · `00:21:48`
- **Escena:**
  - Un pasillo que se aleja con puertas instanciadas a los dos lados. Desde las rendijas sale luz naranja sodio.
  - Las puertas cercanas al puntero se entreabren (rotación suavizada).
  - Al fondo, una puerta abierta a una cocina iluminada, siempre a la misma distancia (la cámara avanza muy lento y el pasillo se recicla).
- **Copy:**
  - TapeLabel: `TAPE 03 · 03:31 AM · REM 3`
  - Título: **The House You Grew Up In**
  - Log: *The hallway is longer than it was. Every door opens onto the same kitchen, and someone is always just leaving it. You can smell toast. You never find out whose.*

### 6.4 Manual: 03:40, awake

- **Tipo:** scroll · **Tema:** paper · **HUD:** `STANDBY` · `03:40 AM` · contador en pausa
- Sin 3D: es papel, y la ausencia del 3D es el contraste.
- **Copy:**
  - TapeLabel: `03:40 AM · YOU WOKE UP`
  - Heading: **You woke up. Here's how it works.**
  - Lede: *The DR-1 listens for the moment your breathing slows, then records until morning. It keeps one dream. Usually the right one.*
  - **Bloque "How the DR-1 listens"**, 3 pasos numerados en mono:
    - `01` Place it within arm's reach.
    - `02` Press REC before you close your eyes.
    - `03` In the morning, press ▶. The tape keeps one dream.
  - **SpecTable:**
    - Recording: `6h 40m`, *Of REM, on one 90-minute tape. It only keeps what matters.*
    - Battery: `11 nights`
    - Tape: `C-90 DREAM`, *Standard cassettes will record, but only nightmares.*
    - Noise floor: `−42 dB`, *Quieter than your breathing. That's the point.*
    - Weight: `640 g`
    - Size: `142 × 96 × 38 mm`
  - **Bloque "Warnings"** (lista en `body`):
    - Do not record on nights you want to forget.
    - Recordings of other people's dreams are not supported.
    - If the tape plays back a dream you don't remember having, stop the unit and turn on the lights.
  - **Final del manual,** en `tape-label`: `GO BACK TO SLEEP ↓`

### 6.5 Dream 04: The Ocean Indoors

- **Tipo:** morph · **Tinte:** `dream-tide` · **HUD:** `● REC` · `04:58 AM` · `00:38:05`
- **Escena:**
  - Interior de un cuarto low-poly (caja invertida) con una ventana.
  - Un plano de agua sube 12s y baja, con un shader de olas simple y cáusticas tenues en las paredes.
  - Una silla, una lámpara y un libro flotan.
  - El puntero genera ondas en la superficie: un shader con un buffer de ondas. Se puede adaptar la idea de `legacy/RippleDistortion` (la simulación de ondas instanciadas) a una textura de desplazamiento del plano.
- **Copy:**
  - TapeLabel: `TAPE 04 · 04:58 AM · REM 4`
  - Título: **The Ocean Indoors**
  - Log: *The water comes in under the door without a sound. It's warm, and it keeps rising. The furniture floats up politely. You were never afraid of this.*

### 6.6 Dream 05: The Fall

- **Tipo:** morph · **Tinte:** `dream-fall` · **HUD:** `● REC` · `06:41 AM` · `00:52:17`
- **Escena:**
  - Caída infinita entre nubes: unos 2000 puntos y planos de nube con alfa, reciclados. Pasan hacia arriba a velocidad constante.
  - Líneas de velocidad finas y una vibración mínima de cámara (0.002).
  - El puntero "maneja" la caída (desplaza la cámara en X/Y con suavizado).
  - La escena casi blanca prepara el white-out del melt siguiente.
- **Copy:**
  - TapeLabel: `TAPE 05 · 06:41 AM · REM 4`
  - Título: **The Fall**
  - Log: *There's no ground yet. The clouds go past in the wrong direction. You're not falling so much as being let go of. Somewhere below, an alarm is starting.*

### 6.7 Wake: 07:02

- **Tipo:** morph · **Tema:** night, con luz de amanecer · **HUD:** `■ STOP` · `07:02 AM` · `00:58:40`
- **Escena:** el mismo `DR1.jsx` apoyado sobre una mesa de luz low-poly, luz cálida y baja desde la izquierda (amanecer) y la cinta expulsada con la etiqueta `TAPE 05`. Composición centrada.
- **Copy** (centrado):
  - TapeLabel: `07:02 AM · RECORDING SAVED`
  - Display: **Did you keep anything?**
  - Body: *The DR-1 isn't real. Neither was the whale. Onirick is a design experiment in scroll-driven motion by {AUTHOR}.* (pedirle al usuario el nombre y los links)
  - Primario: `REPLAY THE NIGHT` → vuelve al hero (una sola transición, crossfade de 1.2s)
  - Secundario: `VIEW SOURCE →` → repositorio en GitHub (pestaña nueva)

### 6.8 Configuración (`src/night/config.js`)

```js
export const NIGHT = [
  { id: 'hero',   Component: Hero,       hud: { state: 'standby', clock: '11:58 PM', counter: '00:00:00' } },
  { id: 'stair',  Component: DreamStair, tint: 'stair', hud: { state: 'rec', clock: '02:47 AM', counter: '00:06:31' },
    melt: { duration: 1.6, ease: 'power2.inOut', intensity: 0.45, scale: 4, aberration: 0.15, drift: 0.3, overlayColor: '#000000' } },
  { id: 'whale',  Component: DreamWhale, tint: 'whale', hud: { state: 'rec', clock: '03:12 AM', counter: '00:14:22' },
    melt: { duration: 1.5, intensity: 0.65, scale: 5, aberration: 0.25, drift: 0.4 } },
  { id: 'house',  Component: DreamHouse, tint: 'house', hud: { state: 'rec', clock: '03:31 AM', counter: '00:21:48' },
    melt: { duration: 1.5, intensity: 0.85, scale: 5, aberration: 0.35, drift: 0.4 } },
  { id: 'manual', Component: Manual, kind: 'scroll', theme: 'paper', plainDuration: 0.45,
    hud: { state: 'standby', clock: '03:40 AM', counter: '00:21:48' } },
  { id: 'ocean',  Component: DreamOcean, tint: 'tide', plainDuration: 1.2, hud: { state: 'rec', clock: '04:58 AM', counter: '00:38:05' } },
  { id: 'fall',   Component: DreamFall,  tint: 'fall', hud: { state: 'rec', clock: '06:41 AM', counter: '00:52:17' },
    melt: { duration: 1.7, ease: 'power3.inOut', intensity: 1.05, scale: 6, aberration: 0.5, drift: 0.55 } },
  { id: 'wake',   Component: Wake, hud: { state: 'stop', clock: '07:02 AM', counter: '00:58:40' },
    melt: { duration: 2.2, ease: 'power3.inOut', intensity: 1.25, scale: 7, aberration: 0.7, drift: 0.6, overlayColor: '#f2efe8' } }
]
```

Los parámetros de `melt` que no se declaran heredan los defaults de `ScrollSections`: `ease: 'power2.inOut'` y `overlayColor: '#000000'`.

---

## 7. Cambios al motor (detalle para la fase 1)

1. **Parámetros por transición.**
   - En `goToIndex`, calcular `destIndex = Math.max(current, target)`, que es la sección "de entrada" de esa transición, y mezclar `{ ...defaults, ...sections[destIndex].melt }` en `optsRef.current` **antes** de `prepareTransition`.
   - Después llamar a `engine.syncOptions()` de forma explícita. Hoy el loop solo sincroniza cuando `!animating`, y durante el tween los uniforms quedarían viejos.
   - Pasar `duration` y `ease` de esa mezcla a `animateProgress`.
   - Restaurar los defaults en `settle`.
2. **`plainDuration` por sección:** en `runPlainTransition`, usar `sections[destIndex].plainDuration ?? plainDuration`, y setear la variable CSS `--scroll-sections-plain-duration` en el host durante la transición.
3. **Touch:**
   - Agregar `onTouchStart` y `onTouchMove` al stage: un swipe vertical de más de 40px equivale a una rueda en esa dirección (usar el mismo `handleSnapWheel` con un evento sintético o una función compartida).
   - `touch-action: none` en el stage, salvo dentro de una sección `scroll`, donde el scroll nativo tiene que funcionar. Ahí aplicar la misma lógica de "llegó al borde" que ya existe para la rueda.
4. **`NightContext`:** proveer `{ currentIndex, transition: { from, to, progress } | null }`. `SceneCanvas` lo usa para decidir `active`, `neighbor` u `offstage`, y el HUD para actualizar sus datos.
5. **Navegación programática:**
   - Exponer `goTo(id)` en el contexto para los botones (`BEGIN RECORDING`, `READ THE MANUAL`, `REPLAY THE NIGHT`).
   - Un salto de más de una sección usa **crossfade**, nunca un melt entre secciones no contiguas.
6. **`SECTION_BG` = `#07080d`.**
7. **Accesibilidad:**
   - Cada sección es un `<section aria-labelledby>`.
   - El HUD tiene `aria-hidden="true"`, salvo un `aria-live="polite"` oculto que anuncia "Tape 02, The Whale Above the City".
   - Se mantienen `ArrowUp`/`ArrowDown`/`PageUp`/`PageDown`.
   - `Home` y `End` van al primero y al último (con crossfade).

---

## 8. Fases

Cada fase termina con `pnpm lint` sin errores, `pnpm build` OK y los criterios cumplidos.

### Fase 0: Limpieza y base

- Renombrar el paquete a `onirick` en `package.json`. `<title>Onirick — DR-1 Dream Recorder</title>` y fuentes nuevas en `index.html`. Sacar la de JetBrains 700 si no se usa.
- Mover a `src/legacy/`, sin borrar:
  - `MorphSlider`, `LiquidChrome`, `GridDistortion`, `DistortionHero`, `LiquidHero`, `SliderHero` y `RippleDistortion`;
  - `sections/Placeholder`, `sections/Projects`, `sections/Sound` y `sections/current`;
  - `src/assets/Slider` y `src/assets/bugs`.
- Borrar los estilos de la plantilla de Vite en `index.css` y `App.css`. Crear `src/styles/tokens.css` (apéndice A), `components.css` (apéndice B) y `global.css`.
- Reemplazar `public/favicon.svg` por un punto rojo (`rec`) simple en SVG.
- Crear `night/config.js` con las 8 secciones como placeholders: cada una muestra su `DreamTitle` o su copy sobre `surface`, todavía sin 3D.
- Montar el `Hud` estático (sin animación de contador) y las dos `GradualBlur`.
- **Terminado cuando:** la web navega las 8 secciones con el melt *actual* (parámetros globales), todo el copy de la sección 6 está en su lugar y el manual se ve en `paper` con scroll nativo.

### Fase 1: Motor

- Todo lo de la sección 7.
- **Terminado cuando:**
  - Las 7 transiciones usan los valores de la tabla 5.1 (verificable con un `console.table` en dev).
  - La 7 se quema a blanco.
  - Funcionan el swipe en mobile, los botones de navegación y la navegación por teclado.
  - Las transiciones hacia atrás funcionan.

### Fase 2: SceneCanvas y el DR-1 (hero + wake)

- `SceneCanvas` con las reglas 3.1 y 3.2, `useCameraDrift` y `materials.js`.
- `three/DR1.jsx` procedural: caja biselada (`RoundedBox` de drei), ventana, carretes que giran, LED, teclas con hover.
- Escena del hero y escena de wake (misma pieza, otra luz y la cinta expulsada).
- **Terminado cuando:**
  - El melt Hero → Dream 01 muestra el aparato derritiéndose con los carretes todavía girando (el refresh funciona), sin frames negros.
  - Nunca hay más de 4 contextos WebGL (verificar en DevTools > Memory o contando `canvas`).

### Fase 3: Sueños 01–03

- Las escenas Staircase, Whale y House según la sección 6, con niebla y luz del tinte, parallax e interacción de puntero.
- **Terminado cuando:** cada escena corre a 60 fps en una laptop moderna, entra y sale derritiéndose sin cortes, y su título tiene el color de su tinte.

### Fase 4: Manual

- La sección `scroll` completa en `paper`: heading, lede, pasos, `SpecTable`, advertencias y reveal on scroll.
- **Terminado cuando:**
  - El crossfade de entrada dura 0.45s y el de salida 1.2s.
  - El scroll interno llega hasta el final antes de pasar a Dream 04, en las dos direcciones.
  - El HUD pasa a `STANDBY` y al tema paper.

### Fase 5: Sueños 04–05 y cierre

- Las escenas Ocean (agua con ondas por puntero) y Fall (partículas y nubes), y el Wake completo.
- **Terminado cuando:** el melt 6 se nota más fuerte que el 3, el 7 termina en blanco y aparece Wake, y `REPLAY THE NIGHT` vuelve al hero.

### Fase 6: Pulido

- **Loader:** contador de cinta y espera de fuentes + capturas 0 y 1.
- **Scramble del contador del HUD, parpadeo del REC y grano.**
- **Pósters:** un script `scripts/posters.mjs` con Playwright abre la web en dev, navega cada sección y guarda un `.webp` de 1600px en `public/posters/`. Correrlo y commitear los pósters.
- **Fallback sin WebGL:** si `WebGL2RenderingContext` no existe, todas las secciones usan su póster y crossfade.
- **Rendimiento:** `dpr` máximo de 1.75 (1.25 en mobile), `frameloop` según la sección 3.2 e `InstancedMesh` donde haya repetición.
- **Metadatos:** descripción, Open Graph con imagen (el póster del hero) y `theme-color` `#07080d`.
- **Terminado cuando:**
  - Lighthouse (mobile) da Performance ≥ 70 y Accessibility ≥ 95.
  - Sin errores en consola.
  - Con reduced motion todo es navegable y estático.

### Fase 7: QA y deploy

- Checklist manual de la sección 9 en Chrome, Safari y Firefox desktop, y en Safari iOS y Chrome Android.
- Deploy en Vercel o Netlify y link en el README.
- Reescribir `README.md`: qué es, cómo correrlo, cómo funciona el melt (resumen de las secciones 3.1 y 7) y créditos.

---

## 9. Checklist de QA

- [ ] Rueda, trackpad, teclado y swipe avanzan exactamente una sección por gesto.
- [ ] Ninguna transición muestra un frame negro, ni al empezar ni al terminar.
- [ ] Las escenas 3D siguen animándose durante el melt, sin congelarse y "saltar".
- [ ] El HUD nunca se derrite y siempre muestra los datos de la sección actual.
- [ ] El manual scrollea nativo; las transiciones entran y salen por los bordes correctos.
- [ ] Redimensionar a mitad de una transición no rompe nada (ya hay reset por resize).
- [ ] Reduced motion: sin distorsión, sin parallax, sin parpadeo.
- [ ] Sin WebGL: pósters + crossfade.
- [ ] Contraste: nada de texto fuera de los pares definidos en la sección 4.1.
- [ ] Mobile (390px): los títulos no rompen palabras, el HUD no tapa el texto y los botones son tocables (44px de alto mínimo).
- [ ] Sin errores ni warnings en consola en producción.

---

## 10. Riesgos conocidos

| Riesgo | Mitigación |
| --- | --- |
| Captura negra de un canvas R3F | `preserveDrawingBuffer`, `data-async-ready` y un solo canvas por sección (sección 3.1). |
| Demasiados contextos WebGL | Montaje perezoso y pósters (sección 3.2). |
| La captura con `domToCanvas` tarda (100–400 ms) y el primer scroll se siente lento | El loader captura 0 y 1; `settle` ya pre-captura las vecinas. Si un gesto llega antes de que la captura esté lista, se ignora (comportamiento actual). |
| Safari y `backdrop-filter` en GradualBlur | Probar temprano. Si falla, bajar `divCount` o aplicar el blur solo en Chromium/Firefox. |
| Scroll nativo + swipe en iOS dentro del manual | Reutilizar la lógica de borde de la rueda y probar en dispositivo real en la fase 4, no en la 7. |
| Alcance: cinco escenas 3D | Cada escena tiene que verse bien con primitivas simples. Pulir la iluminación antes de sumar geometría. Si el tiempo aprieta, Ocean puede ser un cuarto vacío con el agua como único elemento. |

---

## 11. Fuera de alcance

- Sonido. Queda como posible fase 8: un toggle en el HUD, apagado por defecto, con un zumbido de cinta y un ambiente por sueño.
- CMS, i18n y formulario real de reserva.
- Migrar a TypeScript.

---

## 12. Referencia

- **Design system "Onirick"** (artifact en claude.ai, privado del usuario). Tiene tokens, componentes (Button, SecondaryButton, TapeLabel, DreamTitle, Hud, SpecTable, ScrollSections, GradualBlur) y la tabla de motion. Si el agente no tiene acceso, los apéndices A y B de este plan son la fuente de verdad.

---

## Apéndice A: `src/styles/tokens.css`

```css
:root,
[data-theme="night"] {
  --surface: #07080d;
  --surface-raised: #10121a;
  --ink: #ece6d8;
  --ink-muted: #a6a298;
  --ink-faint: #848077;
  --line: #2a2c35;
  --line-strong: #5a5d68;
  --rec: #ff4a2e;
  --on-rec: #07080d;
  --focus: #ece6d8;
  --dream-stair: #e8b86a;
  --dream-whale: #6cc4b8;
  --dream-house: #ff9b4a;
  --dream-tide: #8db8e0;
  --dream-fall: #f2efe8;
  --melt-overlay: #000000;
  --melt-whiteout: var(--dream-fall);
}

[data-theme="paper"] {
  --surface: #ece6d8;
  --surface-raised: #e2dbca;
  --ink: #16140f;
  --ink-muted: #5c574c;
  --ink-faint: #605b50;
  --line: #c9c1ae;
  --line-strong: #857e6d;
  --rec: #b42d17;
  --on-rec: #ece6d8;
  --focus: #16140f;
}

:root {
  --font-serif: "Instrument Serif", "Times New Roman", serif;
  --font-mono: "JetBrains Mono", ui-monospace, Consolas, monospace;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-6: 24px;
  --space-8: 32px;
  --space-12: 48px;
  --space-16: 64px;
  --space-24: 96px;
  --space-32: 128px;
  --radius-none: 0px;
  --radius-sm: 2px;
  --radius-full: 50%;
}
```

## Apéndice B: `src/styles/components.css`

Clases `onk-*` de los componentes de interfaz. Copiar tal cual y sacar el `@import` si las fuentes ya se cargan en `index.html`.

```css
/* Onirick — components/bundle.css
   The planned markup's stylesheet (onk-* classes). Colours, type and spacing
   come only from tokens.css variables. */
@import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500;600&display=swap');

body {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink);
  background: var(--surface);
  -webkit-font-smoothing: antialiased;
}

/* Buttons ------------------------------------------------------------ */
.onk-btn,
.onk-btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-3) var(--space-6);
  border-radius: var(--radius-none);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
}
.onk-btn {
  border: 1px solid var(--ink);
  background: var(--ink);
  color: var(--surface);
}
.onk-btn::before {
  content: '';
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--rec);
}
.onk-btn:hover {
  background: var(--surface);
  color: var(--ink);
}
.onk-btn-secondary {
  border: 1px solid var(--line-strong);
  background: transparent;
  color: var(--ink);
}
.onk-btn-secondary:hover {
  border-color: var(--ink);
}
.onk-btn:focus-visible,
.onk-btn-secondary:focus-visible {
  outline: 2px solid var(--focus);
  outline-offset: 3px;
}

/* TapeLabel ---------------------------------------------------------- */
.onk-tape {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  line-height: 1.4;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.onk-rec {
  width: 8px;
  height: 8px;
  border-radius: var(--radius-full);
  background: var(--rec);
  animation: onk-blink 1.2s steps(2, jump-none) infinite;
}
.onk-tape[data-live] {
  color: var(--ink-muted);
}
@keyframes onk-blink {
  from { opacity: 1; }
  to { opacity: 0.25; }
}
@media (prefers-reduced-motion: reduce) {
  .onk-rec { animation: none; }
}

/* DreamTitle --------------------------------------------------------- */
.onk-dream {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  max-width: 38ch;
}
.onk-dream-title {
  margin: 0;
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: clamp(56px, 10vw, 144px);
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--dream-tint, var(--ink));
  white-space: nowrap;
}
.onk-dream-log {
  margin: 0;
  max-width: 38ch;
  font-size: 15px;
  line-height: 1.6;
  color: var(--ink-muted);
}

/* HUD ---------------------------------------------------------------- */
.onk-hud {
  position: fixed;
  inset: var(--space-6);
  pointer-events: none;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-faint);
  z-index: 1100;
}
.onk-hud > * { position: absolute; display: flex; flex-direction: column; gap: var(--space-2); }
.onk-hud-tl { top: 0; left: 0; }
.onk-hud-tr { top: 0; right: 0; text-align: right; align-items: flex-end; }
.onk-hud-bl { bottom: 0; left: 0; }
.onk-hud-br { bottom: 0; right: 0; text-align: right; align-items: flex-end; }
.onk-hud-mark { color: var(--ink); letter-spacing: 0.2em; }
.onk-hud-counter { color: var(--ink); font-variant-numeric: tabular-nums; }
.onk-hud-tapes { display: flex; flex-direction: row; gap: var(--space-1); }
.onk-hud-tapes span { width: 18px; height: 2px; background: var(--line-strong); }
.onk-hud-tapes span[data-active] { background: var(--rec); }

/* SpecTable (manual, paper theme) ----------------------------------- */
.onk-spec {
  width: 100%;
  border-collapse: collapse;
}
.onk-spec th,
.onk-spec td {
  padding: var(--space-8) 0;
  border-top: 1px solid var(--line);
  text-align: left;
  vertical-align: baseline;
}
.onk-spec th {
  width: 40%;
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--ink-faint);
}
.onk-spec td {
  font-size: 32px;
  font-weight: 500;
  line-height: 1.1;
  color: var(--ink);
}
.onk-spec td small {
  display: block;
  margin-top: var(--space-2);
  font-size: 13px;
  font-weight: 400;
  line-height: 1.5;
  color: var(--ink-muted);
}
```
