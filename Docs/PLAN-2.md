# PLAN-2.md — Onirick: la noche interactiva

> Segundo plan de desarrollo para un agente de IA. Continúa `Docs/PLAN.md` (fases 0–7, cerradas). Repositorio: `nicolaslema/Onirick`, base: rama `develop`.
> Idioma de este documento: español. **Todo el texto visible de la web va en inglés.** El copy nuevo de este plan es **borrador**: la narrativa se va a retocar, así que dejalo en un solo lugar por sueño (ver 3.1) para que cambiarlo no toque lógica.

---

## 0. Cómo usar este plan (instrucciones para el agente)

1. **Leé este plan completo y después `Docs/PLAN.md`**, que sigue siendo la fuente de verdad para lo que este plan no toca (tokens, tipografía, reglas de captura 3.1, montaje perezoso 3.2, tabla de melts 5.1). Después leé:
   - `src/components/ScrollSections/ScrollSections.jsx` y `useSectionTextures.js` (el motor y las capturas).
   - `src/night/config.js`, `src/night/DreamFrame.jsx`, `src/components/DreamTitle/DreamTitle.jsx`, `src/components/Hud/Hud.jsx`.
   - La escena de cada sueño antes de tocarla (`src/night/Dream*/…Scene.jsx`).
   - `DECISIONS.md`: muchas reglas del motor salen de bugs reales anotados ahí.
2. **Trabajá por fases (sección 9), en orden.** No empieces una fase hasta que la anterior cumpla sus criterios de "terminado".
3. **Un branch por fase**, que sale de `develop`: `n2-phase-0-state`, `n2-phase-1-gates`, etc. Commits chicos. No pushees a `main`.
4. **Al terminar cada fase:** `pnpm lint`, `pnpm build`, verificá los criterios en el navegador y escribí un resumen corto (qué hiciste, qué quedó pendiente, capturas si podés).
5. **Si una decisión no está acá y cambia el resultado visual, la narrativa o la arquitectura, preguntá.** La sección 13 lista las que ya se sabe que están abiertas. Para detalles menores, elegí lo más simple y anotalo en `DECISIONS.md` bajo un encabezado `## Night 2 — Phase N`.
6. **No inventes valores de diseño.** Colores y tipografía salen de `tokens.css`. Los números de este plan (duraciones, umbrales, píxeles) son **puntos de partida**: ajustalos en dispositivo y anotá el valor final en `DECISIONS.md`.
7. **Nada de dependencias nuevas.** `three`, R3F, `drei`, `maath`, `gsap` y `ogl` alcanzan para todo.
8. **Lo que ya funciona no se rompe:** rendimiento (Lighthouse mobile ≥ 80), accesibilidad (100), reduced motion, fallback sin WebGL y el desvío del manual.

---

## 1. Concepto: qué cambia

La noche sigue siendo la misma: hero → tres sueños → manual → dos sueños → wake, unidos por el melt que se intensifica. Lo nuevo es que **cada sueño se desarrolla y responde**, y que **la grabadora registra lo que hiciste**.

Tres ideas sostienen este plan:

1. **Cada sueño tiene su propio modelo de juego** (sección 3.1), elegido por lo que cuenta ese sueño:
   - **libre**: la escena responde al puntero, pero el scroll sigue siendo "siguiente sueño";
   - **beats**: los primeros gestos avanzan etapas *dentro* del sueño y el siguiente lo derrite;
   - **scrub**: la rueda recorre el sueño de forma continua.
2. **Los logs son guiones.** Cada frase del log de un sueño se vuelve algo que pasa en la escena, y la máquina la **transcribe** en vivo mientras sucede.
3. **La grabadora registra lo que hacés.** Cada sueño esconde un **fragmento** que se gana con una interacción intencional. Los fragmentos suben la **lucidez** (visible en el HUD). Wake responde por fin su propia pregunta, *Did you keep anything?*, mostrando **tu grabación**.

**Regla de oro:** ninguna interacción es obligatoria para avanzar. El scroll siempre te saca del sueño, como mucho después de recorrerlo, y todo fragmento se puede ganar también con teclado.

---

## 2. Decisiones tomadas

| Idea | Estado |
| --- | --- |
| Modelos por sueño: libre, beats y scrub | **Entra.** Stair = scrub + libre, Whale = libre, House = libre, Ocean = beats, Fall = scrub + libre |
| Staircase: la figura (vos) sube en el lugar, la luna orbita con el scroll, luz y sombras, si te detenés bajás | **Entra** (6.1) |
| Staircase: baranda tibia | **Descartado** (reemplazado por lo anterior) |
| Whale: saludar a la ballena | **Entra** (6.2) |
| House: puertas que se abren y sombras que van y vienen, cocina inalcanzable | **Entra** (6.3) |
| Ocean: el agua sube por beats y terminás bajo la superficie | **Entra** (6.4) |
| Fall: alarma que crece y soltarse | **Entra** (6.5) |
| Wake muestra tu grabación | **Entra** (7) |
| Log transcripto | **Entra** (4.1) |
| Lucidez | **Entra** (4.2) |
| Segunda noche distinta | **Después** (12), cuando la narrativa esté fija |
| Sonido opt-in | **Después** (12) |
| Manual interactivo | **Después** (12) |
| Cursor propio (uno para toda la noche) | **Después** (12) |
| Rebobinar en vez de derretir hacia atrás | **Descartado.** El melt se queda en las dos direcciones |

---

## 3. Arquitectura

```
src/
  night/
    config.js              ← cada sueño suma `play` (3.1); Fall suma `hud.clockTo`
    play.js                ← NUEVO: estado de juego por sección + la compuerta (gate) que usa ScrollSections
    recording.js           ← NUEVO: fragmentos + lucidez (store externo, sessionStorage)
    dreams.js              ← NUEVO: el copy de cada sueño (frases del log, fragmento, glitches), un solo lugar
    DreamFrame.jsx         ← pasa el id del sueño a DreamTitle y monta DreamAction
    Dream*/…Scene.jsx      ← cada escena lee `usePlayRef(id)` en su useFrame
    Wake/                  ← la grabación (sección 7)
  components/
    ScrollSections/        ← prop nueva `gate` (3.2); invalidate() en useSectionTextures (3.4)
    DreamTitle/            ← el log pasa a ser <Transcript> (4.1)
    Transcript/            ← NUEVO
    DreamAction/           ← NUEVO: acción accesible por teclado (3.7)
    Hud/                   ← lucidez (abajo a la izquierda), pistas, progreso del sueño
    DebugPanel/            ← NUEVO, solo en dev con ?debug
  three/
    pointer.js             ← suma tap, velocidad y "quieto desde" (3.6)
    gestures.js            ← NUEVO: detector de saludo (6.2)
```

### 3.1 Modelos de juego: el contrato `play`

Cada sección de `NIGHT` puede declarar `play`. Sin `play`, la sección se comporta como hoy (libre).

```js
// libre: la escena responde, el scroll navega (no hace falta declararlo)
play: { model: 'free' }

// beats: N etapas discretas; un gesto = un beat
play: { model: 'beats', beats: 4, beatDuration: 1.6 }

// scrub: progreso continuo 0→1 atado a la rueda o al dedo
play: { model: 'scrub', length: 2700, stops: [0, 0.33, 0.66, 1] }
```

- `length`: píxeles normalizados de rueda para ir de 0 a 1 (misma unidad que `PX_PER_TRANSITION = 900`). 2700 son unas tres "pantallas".
- `stops`: adónde salta el teclado (flechas y PageUp/PageDown) y dónde se revelan las frases del log.
- `beatDuration`: cuánto tarda la escena en pasar de un beat al siguiente. Mientras dura, los gestos se ignoran, igual que durante un melt.

El copy de cada sueño vive en `night/dreams.js`, separado de la lógica:

```js
export const DREAMS = {
  stair: {
    lines: [
      { at: 0, text: 'You are climbing.' },
      { at: 0.33, text: 'You have been climbing for a long time.' },
      { at: 0.66, text: 'Every landing has the same window, and the same moon in it.' },
      { at: 1, text: 'The handrail is warm, like someone just let go.' }
    ],
    glitches: [{ word: 'moon', wrong: 'noon' }],
    fragment: { id: 'stair', label: "You stopped. The stairs didn't." },
    action: 'Stop climbing',
    hint: 'Hold to stop'
  },
  // …
};
```

En los sueños **libres**, todas las frases tienen `at: 0` (se transcriben al entrar). En **beats**, `at` es el índice del beat. En **scrub**, es el progreso.

### 3.2 La compuerta (gate) en ScrollSections

`ScrollSections` sigue siendo un componente genérico: no sabe nada de sueños. Suma **una sola prop**, `gate`, que `night/play.js` implementa:

```js
gate = {
  // true si este gesto puede salir de la sección (análogo a atScrollEdge)
  canLeave(index, dir) → boolean,
  // se come el input; devuelve true si lo consumió
  consume(index, dir, { source: 'wheel' | 'touch' | 'key', deltaPx, page }) → boolean,
  // la sección va a ser vecina: dejala en el estado en que la vas a encontrar
  prepare(index, entryDir) → void,
  // hubo un salto (goTo) que aterriza acá
  reset(index) → void
}
```

**Cambios en `ScrollSections.jsx`:**

1. `atScrollEdge(index, dir)` pasa a llamarse `canLeave(index, dir)` y devuelve `atScrollEdge(...) && (gate?.canLeave(index, dir) ?? true)`. Todos los handlers que hoy consultan `atScrollEdge` pasan a consultar `canLeave`.
2. **Rueda (`handleSnapWheel`)**: si `!canLeave` y la sección no es `kind: 'scroll'`, llamar a `gate.consume(...)`, hacer `preventDefault()` y marcar `gesture.scrolled = true`. Es exactamente la regla que ya existe para el manual: **el gesto que lleva el sueño a su final no lo derrite; un gesto nuevo, sí.** Eso evita que la inercia de un trackpad cruce el final del scrub y dispare el melt, y además deja un respiro al final de cada sueño.
   - En `beats`, `consume` avanza un beat solo al *inicio* de un gesto: agrupar con `WHEEL_GESTURE_GAP_MS` como ya se hace. Un gesto largo avanza un solo beat.
   - En `scrub`, `consume` suma cada `deltaPx` al progreso objetivo.
3. **Touch**: igual que la rueda. En `beats`, un swipe de más de `TOUCH_SWIPE_PX` avanza un beat. En `scrub`, cada `touchmove` pasa el delta desde el `touchmove` anterior multiplicado por `TOUCH_SCRUB_GAIN = 2.5`, porque el dedo recorre menos que la rueda. Hay que guardar el último `clientY` en `touchRef`, además del inicial.
4. **Teclado (`stepOrScroll`)**: si `!canLeave`, `gate.consume(index, dir, { source: 'key', page })`. En `beats` avanza un beat. En `scrub` salta al siguiente `stop` en esa dirección, con un tween de 0.8 s `power2.inOut`. Home y End siguen saltando al principio y al final de la noche.
5. **Preparar vecinas**: el efecto que hoy pre-captura las vecinas cuando cambia `currentIndex` llama **antes** a `gate.prepare(index - 1, -1)` y a `gate.prepare(index + 1, +1)`. Ver 3.3.
6. **Saltos**: `goTo()` con un salto no contiguo llama a `gate.reset(target)` antes del crossfade.
7. **Sin WebGL2**: `play.js` no le pasa la compuerta a `ScrollSections` (`gate={HAS_WEBGL2 ? nightGate : undefined}`). Los sueños vuelven a ser un póster por gesto, como hoy.
8. **Gesto en espera**: hoy, si un gesto llega antes de que la captura esté lista, `goToIndex` lo descarta. Con capturas que se invalidan más seguido (3.4), eso se va a notar. Guardar **un** gesto pendiente (`pendingNavRef = { target, dir, at }`), reintentarlo cuando `capture()` resuelva y descartarlo si pasaron más de 600 ms.

### 3.3 Estado de juego y estado de entrada

`night/play.js` es un store externo mínimo (mismo patrón que `useReducedMotion`: `useSyncExternalStore`), con una entrada por sección de `NIGHT` que tenga `play`:

```js
{ target: 0, beat: 0, reveal: 0, settledAt: 0 }
// target: progreso objetivo (scrub, 0→1) o beat objetivo (beats)
// reveal: cuántas frases del log están habilitadas (derivado de target y DREAMS[id].lines)
```

- **Las escenas no leen el store con React.** Leen un ref mutable (`usePlayRef(id).current.target`) dentro de `useFrame` y lo suavizan ellas mismas con `easing.damp` (`smoothTime` 0.25 en scrub y `beatDuration` en beats). Nada de estado de React por frame (ver `DECISIONS.md`, fase 1, sobre por qué el motor no guarda `progress`).
- **React solo se entera de `beat` y `reveal`**, que cambian pocas veces. Eso es lo que re-renderiza el `Transcript`.
- **Estado de entrada**: una vecina siempre se prepara en el estado en que la vas a encontrar:
  - la de abajo (`index + 1`, a la que se entra avanzando) queda en `target = 0`;
  - la de arriba (`index - 1`, a la que se entra volviendo) queda en `target = 1` o en el último beat, con todas sus frases reveladas.

  Así la captura que alimenta el melt coincide con lo que aparece al asentarse. `prepare()` escribe el estado y llama a `invalidate()` del canvas de esa sección (está en `frameloop="demand"`) para que dibuje un frame con el estado nuevo antes de la captura. En ese caso la escena salta directo al estado, sin suavizado: exponer `snap: true` en el ref.
- **Lo que la escena recuerda** (dónde quedó la figura de la escalera, las puertas abiertas) no es estado de juego: vive en la escena y se pierde cuando la escena se desmonta (offstage). Es aceptable. Lo que tiene que sobrevivir va a `recording.js`.

### 3.4 Capturas: invalidar el overlay de texto

Hoy el overlay de texto de cada sección se captura **una vez** (`overlayCacheRef`) y se reutiliza. Con el log transcripto y el copy por beat, el texto cambia mientras estás en el sueño, así que el overlay queda viejo.

- **`useSectionTextures`** suma `invalidate(index)`, que borra `cacheRef`, `textureCacheRef`, `overlayCacheRef` y los `pending` **de esa sección**, liberando la textura GL como hace `invalidateAll`.
- **Cuándo se invalida y recaptura:**
  - cuando el `Transcript` termina de escribir una tanda de frases (evento `onSettled`);
  - cuando `prepare()` cambia el estado de una vecina (3.3);
  - cuando cambia la grabación y Wake está cacheada (sección 7: Wake es vecina de Fall).
- **Cómo:** debounce de 250 ms y después `requestIdleCallback` (con fallback a `setTimeout` de 0) para `capture(index)`. Una captura tarda entre 100 y 400 ms. Nunca capturar durante un melt: si `activeTransition` no es `null`, esperar a `settle`.
- **El 3D no necesita nada de esto**: ya se compone desde el canvas vivo en cada refresh.

### 3.5 La grabación: `night/recording.js`

Store externo con `useSyncExternalStore`, persistido en `sessionStorage` (`onirick.recording`, envuelto en `try/catch`: si falla, funciona solo en memoria).

```js
{ kept: { stair: 1712..., whale: null, house: null, ocean: null, fall: null } } // timestamp o null

keep(id)        // guarda el fragmento (idempotente), anuncia y notifica
lucidity()      // 0–5 = cantidad de fragmentos guardados
reset()         // REPLAY THE NIGHT
```

- **La lucidez se deriva de los fragmentos**, no es un número aparte. Una sola fuente de verdad, determinista y fácil de testear.
- **`keep()` anuncia** en la región `aria-live` que ya existe en el Hud: *"Fragment kept: It looked back."*.
- **`REPLAY THE NIGHT` llama a `reset()`**: cada noche es una grabación nueva. La "segunda noche" que recuerda la anterior queda para después (12).

### 3.6 Input compartido: `three/pointer.js` y `three/gestures.js`

Hoy `pointer.js` expone `{ x, y }` en NDC, con un listener en `window`. Suma, sin agregar listeners:

- `pointer.vx`, `pointer.vy`: velocidad suavizada (NDC/s).
- `pointer.stillSince`: `performance.now()` del último movimiento de más de 0.004 NDC. Sirve para "quedarse quieto" (Fall).
- `pointer.down`: si hay un botón o un dedo apretado.
- **Mantener apretado**: `onHold({ delay: 250, tolerance: 10 }, { start, end })` llama a `start` cuando el puntero lleva `delay` ms apretado sin moverse más de `tolerance` px, y a `end` al soltar. Si se mueve antes de `delay`, no pasa nada (es un swipe). Se ignora sobre elementos interactivos, igual que el tap. Lo usa Stair (6.1).
- **Tap**: `onTap(callback)` registra un listener y devuelve la función para desregistrarlo. Cuenta como tap un `pointerdown` → `pointerup` con menos de 10 px de recorrido y menos de 300 ms. El callback recibe `{ x, y }` en NDC. **Se ignora si el `target` es interactivo** (`closest('a, button, [role=button], input')`): hacer click en un botón no abre una puerta.

`three/gestures.js` tiene detectores puros (sin React), fáciles de testear:

- `createWaveDetector({ reversals: 3, window: 1500, minAmp: 0.06 })`: recibe `x` y `t` en cada frame y devuelve `true` cuando detecta un saludo (6.2).

Los handlers de navegación siguen siendo los de `ScrollSections`. Un tap no navega y un saludo horizontal tampoco: el swipe solo mira el eje Y.

### 3.7 Accesibilidad: `DreamAction`

Cada fragmento tiene que poder ganarse con teclado.

- **`DreamAction`** es un `<button>` por sueño, dentro de la sección, **visualmente oculto hasta que recibe foco** (patrón de *skip link*). Con `:focus-visible` aparece arriba del `DreamTitle`, con el estilo `onk-btn-secondary`. Texto: `DREAMS[id].action` (por ejemplo, *Wave at the whale*).
- Al activarlo dispara en la escena **la misma reacción** que la interacción con el puntero (un evento en el store de juego: `play.trigger(id, 'action')`) y, si corresponde, gana el fragmento.
- No se captura en el melt: fuera de foco está fuera del flujo visual (`.sr-only` hasta el foco). Verificá que la captura del overlay no lo muestre.
- **Nada de atajos de una sola tecla** (WCAG 2.1.4). La acción es un botón enfocable, no una tecla global.

---

## 4. Sistemas transversales

### 4.1 Log transcripto

El log de cada sueño deja de ser texto estático: **la máquina lo transcribe** mientras pasa.

- **`<Transcript id lines reveal />`** reemplaza el `<p className="onk-dream-log">` de `DreamTitle`. Mantiene la clase y la tipografía. Frases solo hasta `reveal`.
- **Tipeo**: unos 38 caracteres/s con variación aleatoria de ±30% por carácter, y una pausa de 220 ms después de cada punto. Un cursor de bloque `▍` en `--ink-muted` parpadea con `steps(2)` 1.2 s, igual que el REC, y desaparece 1.5 s después de la última frase.
- **Glitches**: una palabra de `DREAMS[id].glitches` se tipea mal (`wrong`), queda 350 ms y se borra carácter por carácter para escribir la correcta. **Máximo uno por sueño.** La probabilidad de que ocurra baja con la lucidez: 100% con 0, 20% con 4 y ninguno con 5, porque la máquina "te escucha mejor".
- **Sin saltos de layout**: el texto completo de las frases reveladas se renderiza siempre. Lo que falta tipear lleva `color: transparent`. Así la caja no crece mientras se escribe y la captura sale bien: el texto transparente no se ve en el melt.
- **Cuándo empieza**: cuando la sección es la actual y no hay `activeTransition` (el melt terminó), más 250 ms.
- **Estado de reposo = estado capturado.** Entrando hacia adelante, las frases todavía no tipeadas están transparentes, así que la captura del melt muestra el log vacío y el tipeo empieza sin parpadeo. Entrando hacia atrás, todo está revelado y tipeado. **Esto enmienda `PLAN.md` 5.2** ("sin animación de entrada después del melt"): la regla sigue valiendo para todo lo demás. Al tipeo no le afecta porque arranca desde lo que ya mostró la captura.
- **Accesibilidad**: la versión tipeada lleva `aria-hidden`. Al lado va un `<span className="sr-only">` con las frases reveladas completas, sin glitches.
- **Reduced motion**: el texto aparece completo al revelarse, sin tipeo, sin cursor y sin glitch.
- Al terminar una tanda: `onSettled()` → invalidar y recapturar el overlay (3.4).

### 4.2 Lucidez en el HUD

El hueco `onk-hud-bl` (abajo a la izquierda, hoy vacío) muestra la lucidez:

```
LUCIDITY ▮▮▯▯▯
```

- Mono, `tape-label` (12px, 500, tracking 0.12em), en `--ink-muted`. Cada segmento lleno va en `--ink`.
- **Al ganar un fragmento**, el segmento nuevo parpadea dos veces en `--rec` (0.6 s, `steps(2)`) y queda en `--ink`. `rec` sigue siendo el único acento (`PLAN.md` 4.1).
- **Oculta en hero y manual** (todavía no dormiste o estás despierto). Visible en los sueños y en Wake.
- **Qué cambia con la lucidez** (poco, a propósito):
  - la frecuencia de glitches del transcript (4.1);
  - el copy de Wake (7);
  - nada más en las escenas. Si más adelante se quiere que la lucidez afecte al melt o a la niebla, es una decisión abierta (13), porque choca con "el melt se intensifica a lo largo de la noche".
- `aria-hidden` como el resto del HUD. Los anuncios los hace `keep()`.

### 4.3 Pistas

Para las interacciones que no son obvias (detenerse, saludar, las puertas):

- **Una línea en el HUD** justo arriba de la lucidez, con la voz de la máquina: `PROMPT · HOLD TO STOP`, `PROMPT · WAVE ↔`, `PROMPT · OPEN A DOOR`. Viene de `DREAMS[id].hint`.
- **Aparece** a los 6 s de estar en el sueño si el fragmento todavía no se ganó y no hubo interacción relevante. Fade de 0.4 s, dura 5 s y se va. **Una sola vez por sueño y por noche.**
- Vive en el HUD, así que **no se captura ni se derrite**, y no necesita invalidar nada.
- Con reduced motion: sin fade, aparece y desaparece.

### 4.4 Progreso dentro del sueño

El usuario tiene que entender que el scroll hizo algo aunque no haya habido melt.

- **Barra en las cintas del HUD**: en `onk-hud-tapes`, el punto de la cinta actual se estira a una barra de 16px que se llena con el progreso (scrub) o por tramos (beats). En sueños libres queda como hoy.
- **Final alcanzado**: cuando `canLeave(index, +1)` pasa a `true`, la barra llena parpadea una vez en `--ink`. Es la señal de "un gesto más y seguís".
- **Reloj del HUD en scrub**: si la sección declara `hud.clockTo`, el reloj interpola de `clock` a `clockTo` con el progreso, redondeado al minuto y sin scramble (lo usan Stair, 6.1, y Fall, 6.5). El contador de cinta hace lo mismo con `counterTo` si existe.

### 4.5 Panel de debug (solo dev)

Con `?debug` en la URL y `import.meta.env.DEV`: un panel fijo abajo al centro muestra la sección actual, `target`, `beat`, `reveal`, los fragmentos y la lucidez, con botones para ganar o resetear fragmentos y saltar a un beat o a un progreso. Es imprescindible para probar Wake sin jugar la noche entera. **No entra en el build de producción** (import dinámico detrás de `import.meta.env.DEV`).

---

## 5. Reglas para toda interacción nueva

1. **Estado por frame en refs**, dentro de `useFrame`. React solo para cambios discretos (beat, reveal, fragmento).
2. **Instanciar** lo que se repite (sombras, anillos, burbujas) con `InstancedMesh` y un pool fijo. Sin crear objetos por frame.
3. **Presupuesto**: 60 fps en una laptop moderna con el sueño actual más sus vecinas. Lighthouse mobile ≥ 80 (hoy 82–83) y Accessibility 100. Si una escena nueva baja de eso, recortá geometría antes de sumar efectos.
4. **Reduced motion**: la escena reacciona igual, pero al 25% de velocidad (`REDUCED_SPEED`), sin temblores ni sacudidas, y los tweens de beats y stops son instantáneos.
5. **Sin WebGL2**: sin compuerta (3.2), sin fragmentos de escena. `DreamAction` se oculta y Wake usa la variante de 0 fragmentos con una línea propia (sección 7).
6. **Mobile**: todo lo que es hover tiene un equivalente en tap. Ninguna interacción depende de hover.
7. **Las escenas se siguen viendo bien sin interacción.** Alguien que solo scrollea tiene que ver una noche completa y linda.

---

## 6. Sueños, uno por uno

Formato de cada sueño: **modelo**, **qué pasa**, **interacción**, **copy** (borrador), **fragmento**, **técnica**, **mobile/reduced**.

### 6.1 Dream 01: The Staircase (scrub + libre)

**Lectura:** la escalera es el movimiento continuo en algo infinito: metas, miedos, la vida misma. Esa figura sos vos, que subís sin parar y aun así seguís en el mismo lugar. Si te detenés, no te quedás donde estabas: bajás. Hay que seguir subiendo solo para no perder terreno (la Reina Roja de *Alicia*).

- **Modelo:** scrub para la luna (`length: 2700`, `stops: [0, 0.33, 0.66, 1]`) y libre para detenerse.
- **Qué pasa:**
  - **La figura sube en el lugar.** Una figura low-poly, *vos*, sube la escalera sin parar. La escalera gira y baja como un tornillo exactamente al ritmo de sus pasos, así que la figura queda siempre en el mismo punto del cuadro. Es una escalera de Escher.
  - **La escena está casi a oscuras.** La luz del tinte baja a un resto (ver técnica) y la fuente principal pasa a ser **la luna**.
  - **El scroll mueve la luna.** Una luna que emite luz orbita alrededor de la escalera. Con el progreso da algo más de una vuelta y va subiendo, pasa por detrás de la columna y sale de cuadro por los costados. Aunque no se vea, su luz sigue barriendo los escalones, así que siempre se nota dónde está.
  - **Luz y sombras.** La luna proyecta sombras: la de la **columna** (el poste central de la escalera caracol), la de los escalones y la de la figura caen sobre los escalones de abajo y giran con la órbita, como la aguja de un reloj de sol. La noche pasa mientras subís en el lugar.
  - **El reloj del HUD** avanza con la luna, de `02:47 AM` a `03:04 AM` (`hud.clockTo`, 4.4).
- **Interacción (si te detenés, bajás):**
  - **Mantener apretado** (mouse o dedo) detiene a la figura: termina el paso y queda parada. **La escalera no se detiene**, así que se la lleva: la figura gira con su escalón alrededor de la columna, baja y termina saliendo de cuadro entre la niebla.
  - **Al soltar**, la figura retoma la subida más rápido que la escalera (cadencia de recuperación) hasta volver a su lugar, y ahí vuelve al ritmo normal.
  - La luna, las sombras y el scroll siguen funcionando mientras la figura está detenida.
- **Copy (frases por progreso):**
  - 0: *You are climbing.*
  - 0.33: *You have been climbing for a long time.*
  - 0.66: *Every landing has the same window, and the same moon in it.*
  - 1: *The handrail is warm, like someone just let go.*
  - Glitch: `moon` → `noon`.
  - La última frase ya no se relaciona con ninguna mecánica: ver decisión abierta 13.7.
- **Fragmento `stair`:** *"You stopped. The stairs didn't."* Se gana cuando la figura, después de haber sido arrastrada **al menos 2 escalones**, vuelve a su lugar. Es decir: te detuviste, la escalera te llevó y volviste a subir.
- **Pista:** `PROMPT · HOLD TO STOP`.
- **DreamAction:** *Stop climbing*. Detiene a la figura 4 s, la suelta y el fragmento se gana cuando vuelve a su lugar.
- **Técnica:**
  - **El tornillo:** la escalera se repite cada escalón y sus ventanas cada 12 (`WINDOW_EVERY`). 12 escalones son media vuelta (π) y `12 × RISE` de altura. El grupo de la escalera gira `stepAngle` y baja `RISE` por cada paso de la figura, y vuelve al inicio cada 12 escalones, sin salto visible porque la geometría es idéntica. Los 120 escalones actuales sobran para cubrir el cuadro durante el desplazamiento. El sentido de giro es el que hace que el escalón bajo la figura se aleje hacia abajo y hacia atrás de su marcha.
  - **Ritmo:** un escalón cada `T_STEP = 2 s`, un paso lento y pesado de alguien que viene subiendo hace mucho. Hoy la escalera gira a `SPIN = 0.02` rad/s (unos 13 s por escalón); pasa a `stepAngle / T_STEP ≈ 0.13` rad/s. Ajustar en pantalla y anotarlo.
  - **La figura** mide unas 1.6 unidades (proporción humana con escalones de `RISE = 0.18` y 1.6 de ancho). Son unas 10 primitivas: torso, cabeza, brazos y piernas en dos tramos con rodilla, en flat shading y `--ink-muted`. Va sobre el radio de los escalones (`STEP_RADIUS`), del lado que mira a la cámara, a una altura que la deje **por encima del bloque de título** (también en portrait), mirando en el sentido de subida.
    - **Ciclo de caminata sincronizado** con `T_STEP`: cada pie sube `RISE` y se apoya exactamente cuando el escalón pasa bajo él. **Los pies no pueden resbalar**: es lo que vende la ilusión.
    - Balanceo leve del cuerpo y de los brazos.
  - **Detenerse, en una sola variable:** `s` = cuántos escalones está la figura por delante (+) o por detrás (−) de su lugar, en el marco de la escalera. Por segundo, `ds/dt = (cadencia − 1) / T_STEP`:
    - subiendo normal: cadencia 1, `s` queda fijo en 0;
    - detenida: cadencia 0, `s` baja un escalón cada `T_STEP`;
    - recuperando: cadencia 1.8 (hasta 3 si `s < −12`) hasta volver a 0.
    - La posición de la figura es su lugar transformado por el tornillo de `s` escalones: ángulo `+ s · stepAngle`, altura `+ s · RISE`. `s` tiene un piso en `−36` (tres rellanos, bien dentro de la niebla).
  - **Mantener apretado:** `pointer.down` durante más de 250 ms con menos de 10 px de recorrido (3.6), para que no choque con el swipe del scrub. Si el dedo empieza a moverse, gana el scrub y se cancela la detención. Se ignora sobre elementos interactivos, igual que el tap.
  - **El puntero ya no rota la escalera.** Hoy suma `pointer.x * POINTER_SPIN` a la rotación, y con la figura sincronizada eso la haría resbalar. El parallax queda solo en la cámara (`useCameraDrift`, como en los otros sueños).
  - **La luna:**
    - una esfera de radio ~0.35 en `--ink` con `fog: false`;
    - un halo aditivo (textura radial en canvas, `depthWrite: false`);
    - una **`SpotLight` con sombra** en su posición, apuntando al centro de la columna a la altura de la figura, con ángulo amplio y `penumbra` 0.5. Es blanca hueso (`--ink`) contra la niebla ámbar del tinte: dos temperaturas en la escena.
    - **Órbita elíptica:** más ancha en X que el ancho visible, para que salga de cuadro por los costados. Da `1.25` vueltas y sube de `y ≈ 1` a `y ≈ 6` entre `p = 0` y `p = 1`. Arranca adelante a la izquierda, para que se vea al entrar.
    - Se suaviza con `easing.damp` hacia el objetivo del scrub.
  - **Apagar la escena:** `hemisphereLight` de 0.35 a ~0.07 y la `directionalLight` del tinte de 2.2 a ~0.35. El ámbar sigue en la niebla y en el fondo, y el título conserva su color porque es DOM. Las lunas de las ventanas son `meshBasicMaterial` y siguen visibles en la oscuridad: la misma luna en cada ventana.
  - **Sombras (entran, suman la profundidad):**
    - `shadows` en el `<Canvas>` **solo de este sueño**: `SceneCanvas` y `LiveCanvas` suman una prop `shadows` que pasa derecho a R3F.
    - Proyectan sombra (`castShadow`): la columna, los escalones (`InstancedMesh` lo soporta), los marcos de ventana y la figura. La reciben (`receiveShadow`): escalones y columna.
    - `shadow.mapSize` 1024 en desktop y 512 en mobile, con `shadow.bias` y `normalBias` ajustados para que no aparezca *acne* sobre el flat shading. El `near`/`far` de la cámara de sombra lo más ajustado posible a la escalera visible.
    - **Respaldo:** si con sombras el sueño baja de 60 fps en una laptop moderna, o de 30 en un teléfono medio, se apagan solo en mobile. Si aun así no rinde, la luna queda sin sombra y la luz sola ya marca la dirección sobre el flat shading. Anotar lo medido en `DECISIONS.md`.
  - **Captura:** las sombras son parte del canvas, así que no cambia nada (`preserveDrawingBuffer` ya está). Entrando hacia atrás, la luna aparece en su posición final (`p = 1`, 3.3).
- **Mobile/reduced:** en mobile, el swipe vertical mueve la luna y mantener el dedo quieto detiene a la figura. Con reduced motion, el tornillo y la caminata van al 25%, la luna sigue al scroll sin suavizado largo y la detención funciona igual.

### 6.2 Dream 02: The Whale Above the City (libre)

- **Modelo:** libre.
- **Qué pasa:** la ballena sigue su ruta sobre los techos (como hoy). *"Nobody looks up."*
- **Interacción (saludar):**
  - **Saludo** = sacudir el puntero de lado a lado: 3 inversiones de dirección en X en menos de 1.5 s, cada tramo de al menos 0.06 NDC (`createWaveDetector`, 3.6). En touch es lo mismo con el dedo apoyado, porque los pointer events también disparan ahí.
  - **Respuesta:**
    1. La ballena frena y sale de su ruta en un arco suave de 1.5 s.
    2. Gira hasta mostrarte un flanco, con **un ojo hacia la cámara**, y se queda ahí 3 s.
    3. Parpadea (escala Y del ojo 1 → 0.1 → 1 en 0.2 s).
    4. Vuelve a la ruta.
  - **La ciudad responde:** las ventanas bajo su recorrido se encienden en una onda que la sigue (atributo de color por instancia en `windows`, 0 → tinte y vuelta en 4 s). En un techo aparece una **figura diminuta que mira hacia arriba**: alguien por fin mira.
  - Antes de saludar, el ojo sigue sutilmente al cursor (ya existe).
- **Copy:** las cuatro frases del log actual con `at: 0`. Glitch: `eye` → `I` (*"it turns one I toward you"*, y se corrige).
- **Fragmento `whale`:** *"It looked back."* Se gana con el primer saludo completo. Saludar otra vez repite la reacción, pero no suma.
- **Pista:** `PROMPT · WAVE ↔` (4.3).
- **DreamAction:** *Wave at the whale*.
- **Técnica:**
  - La salida de la ruta se hace mezclando `pathPoint(t)` con un punto de "atención" frente a la cámara, con un peso `w` que va 0 → 1 → 0 (damp). La rotación interna ya existe (`inner`): sumarle el giro de flanco con el mismo peso.
  - Para la figura en el techo alcanza con 2 primitivas (cápsula y esfera) sobre un edificio fijo, elegido de la semilla, dentro del cuadro en landscape y en portrait. Aparece y se queda hasta que la sección se desmonta.
- **Mobile/reduced:** saludo con el dedo (no choca con el swipe vertical). Con reduced motion, la reacción es igual pero más lenta y sin la onda de ventanas: se encienden todas a la vez con fade.

### 6.3 Dream 03: The House You Grew Up In (libre)

**Lectura:** un camino constante. La gente va y viene, tiene su vida y no siempre camina con vos ni hacia donde vas. La cocina queda inalcanzable.

- **Modelo:** libre. La opción de sumarle un scrub de "caminar sin llegar" queda abierta (13).
- **Qué pasa:** el pasillo avanza lento y se recicla (como hoy). La cocina, al fondo, siempre a la misma distancia.
- **Interacción (puertas y sombras):**
  - **Hover** entreabre la puerta cercana (ya existe).
  - **Click o tap** sobre una puerta la **abre del todo** (`AJAR` → 1.35 rad en 0.5 s): la luz de la habitación se derrama más fuerte en el piso y, 0.4 s después, **sale una sombra**.
  - **Las sombras** son siluetas oscuras low-poly (cápsula + esfera) en `--surface`, así que contra el resplandor naranja se leen como recortes. Al salir, doblan hacia un carril del pasillo y caminan:
    - **hacia la cocina** (~60%): se alejan, y cerca de la puerta de la cocina se funden con el brillo (color → el de la cocina, opacidad → 0, un poco de escala en Y). *Se pierden en la luz.*
    - **hacia vos** (~40%): caminan hacia la cámara por el carril opuesto, pasan de costado y se desvanecen antes de alcanzarla. **No te miran.**
  - **La vida sigue sin vos:** cada 7–12 s, una puerta lejana se abre sola y sale una sombra.
  - La cocina no se alcanza nunca: el pasillo se recicla y el `Kitchen` está fijo respecto de la cámara (ya es así).
- **Copy:** el log actual (`at: 0`). Glitch: `toast` → `ghost`.
- **Fragmento `house`:** *"Someone reached the kitchen."* Se gana cuando una sombra **que liberaste vos** se funde con la luz de la cocina. Las sombras espontáneas no cuentan.
- **Pista:** `PROMPT · OPEN A DOOR`.
- **DreamAction:** *Open a door*. Abre la puerta más cercana al centro del cuadro y libera una sombra que va hacia la cocina.
- **Técnica:**
  - **Click → puerta:** `onTap` (3.6) + un raycast contra el `instancedMesh` de puertas (`instanceId`). Si falla, usar la proyección de centros de puerta que ya se calcula para el hover (`probe`) y tomar la más cercana a menos de 0.15 NDC.
  - **Espacio de mundo:** el grupo `Hallway` salta hacia atrás un `BAY` cada vez que `offset` da la vuelta (`% BAY`). Las sombras **no pueden ser hijas de ese grupo**, porque saltarían. Van en espacio de mundo y a su velocidad se le suma `CREEP` hacia la cámara (el piso "se mueve" hacia vos). Al nacer: `z = doorCenterZ(i) + offset.current`.
  - **Pool** de 10 sombras en un `InstancedMesh` por pieza (cuerpo y cabeza), más opacidad por instancia (atributo + `onBeforeCompile`) o 10 mallas simples si es más claro: con 10, ambas opciones andan.
  - **Estados de la sombra:** `emerging` (0.6 s, de dentro de la habitación al umbral) → `turning` (0.4 s, al carril) → `walking` → `fading`. Carriles: `x = ±0.35` (a la kitchen por un lado y hacia vos por el otro, con 30% de mezcla para que no parezca tráfico ordenado). Velocidad de 0.6 a 0.9 u/s. Un bamboleo leve en Y (0.02 a 2 Hz) para que caminen y no se deslicen.
  - Una puerta abierta del todo se cierra sola a los 6 s.
- **Mobile/reduced:** tap abre. Con reduced motion, las sombras caminan al 25% y la puerta abre sin rebote.

### 6.4 Dream 04: The Ocean Indoors (beats)

- **Modelo:** beats, `beats: 4` (0 a 3), `beatDuration: 1.6`.
- **Qué pasa:** el agua **deja de subir y bajar en ciclo** (`waterLevel(t)` actual). Cada gesto la sube un escalón hasta que la cámara queda **bajo la superficie**:

| Beat | Nivel del agua | Qué se ve | Frase del log |
| --- | --- | --- | --- |
| 0 | Tobillos (`LOW`) | Muebles apoyados | *The water comes in under the door without a sound.* |
| 1 | Cintura | Los muebles empiezan a flotar | *It's warm, and it keeps rising.* |
| 2 | Justo bajo la cámara | Muebles a la altura de los ojos, cáusticas altas | *The furniture floats up politely.* |
| 3 | Sobre la cámara | **Bajo el agua** | *You were never afraid of this.* |

- **Bajo el agua (beat 3):**
  - La niebla se vuelve más densa (0.07 → 0.14) y el fondo, más profundo (`sceneBackground` con 30% de tinte).
  - La superficie se ve desde abajo (`Water` con `side: DoubleSide`) con las ondas del puntero todavía activas.
  - Las cáusticas pasan al piso.
  - Burbujas suben desde el puntero cuando se mueve: un pool de 40 puntos que reemplaza las ondas como respuesta al puntero.
  - La luz de la ventana cae en haces: 2 o 3 planos aditivos, tenues.
- **Interacción libre dentro de cada beat:**
  - Las ondas del puntero **empujan los muebles** que flotan: el pico de la onda cercana a un mueble le suma un impulso lateral que se amortigua.
  - Bajo el agua, el puntero suelta burbujas.
- **Fragmento `ocean`:** *"You stayed under."* Se gana quedándose **6 s bajo el agua** en el beat 3. Al ganarlo, la lámpara flotante **se enciende** (una luz puntual cálida y débil, más su pantalla emisiva). Es la única luz cálida del cuarto.
- **DreamAction:** *Stay under*. Lleva al beat 3 si no estás ahí y cuenta los 6 s.
- **Glitch:** `politely` → `quietly`.
- **Estado de entrada:** entrando desde el manual, beat 0. Volviendo desde Fall, beat 3 (bajo el agua), lo que da continuidad: venís de caer y "emergés" subiendo.
- **Técnica:**
  - `waterLevel` pasa a ser `lerp` hacia el nivel del beat objetivo, suavizado con `beatDuration`. `swell` sigue igual.
  - Cruzar la superficie: cuando el nivel pasa `camera.y`, conmutar niebla, fondo y cáusticas con un fundido de 0.4 s ligado al nivel, no al tiempo, para que en un scroll hacia atrás se deshaga igual.
  - El nivel máximo actual (`HIGH`) está pensado para quedar bajo la cámara: el beat 3 necesita un nivel mayor que `CAMERA.position.y` (1.3). Revisar que la ventana siga dentro del cuarto.
- **Mobile/reduced:** un swipe es un beat. Con reduced motion, el cambio de nivel es un fundido rápido, sin burbujas.
- **Fuera de alcance:** distorsionar el texto del DOM bajo el agua. Es un filtro SVG sobre el DOM, con riesgo alto de que `modern-screenshot` no lo capture igual. Queda anotado en 12.

### 6.5 Dream 05: The Fall (scrub + libre)

- **Modelo:** scrub, `length: 2700`, `stops: [0, 0.25, 0.5, 0.75, 1]`, con interacción libre encima.
- **Qué pasa:** el scroll es **profundidad**. Con el progreso:
  - La velocidad de caída crece (`SPEED × (1 + 1.5p)`) y aparecen más líneas de velocidad (opacidad `0.35 → 0.6`).
  - **La alarma crece**, sin sonido: anillos finos en `--rec` suben desde abajo, como ondas. Su frecuencia va de 1 cada 3 s a 3 por segundo, y a partir de `p > 0.6` pulsan también en la niebla.
  - **La luz de abajo**: un disco sin niebla, en `--dream-fall` (el blanco cálido), crece desde el fondo del pozo. A `p = 1` casi llena el cuadro, y el melt a Wake se quema a blanco (`burn: 1`) desde ahí, sin corte.
  - **El reloj del HUD** avanza de `06:41 AM` a `07:01 AM` (4.4, `hud.clockTo`). Un minuto antes de despertar.
- **Interacción:**
  - **Dirigir** la caída con el puntero (ya existe).
  - **Soltarse:** si el puntero queda **quieto 3 s** (`pointer.stillSince`) y `p < 0.9`, la caída se calma. El temblor se apaga, la cámara **gira despacio hacia arriba** y ves de dónde caíste: capas de nubes teñidas con los tintes de la noche (`stair`, `whale`, `house`, `tide`), lejos, una sobre otra. **Toda la noche arriba tuyo.** Mover el puntero te devuelve a mirar hacia abajo.
- **Copy (frases por progreso):**
  - 0: *There's no ground yet.*
  - 0.25: *The clouds go past in the wrong direction.*
  - 0.5, o al soltarse: *You're not falling so much as being let go of.*
  - 0.75: *Somewhere below, an alarm is starting.*
  - Glitch: `clouds` → `crowds`.
- **Fragmento `fall`:** *"You let go."* Se gana la primera vez que la cámara termina de girar hacia arriba.
- **DreamAction:** *Let go*. Hace el giro durante 5 s y gana el fragmento.
- **Técnica:**
  - Los anillos son un pool de 12 `RingGeometry` finos, en un `Tiled` propio con velocidad mayor a la de las nubes.
  - Las nubes de la noche son 4 planos grandes con la textura de nube existente (`useCloudTexture`) y `color` = cada tinte, en `y` altos y `fog: false`. Solo se ven al mirar arriba.
  - El giro de cámara es un peso `up` 0 → 1 (damp de 1.8 s) que mezcla el `lookAt` hacia abajo actual con uno hacia arriba.
- **Mobile/reduced:** en mobile, "quieto" = sin tocar la pantalla 3 s. El giroscopio para dirigir queda fuera de alcance (necesita permiso en iOS). Con reduced motion, sin temblor y con anillos a 1/4 de frecuencia.

---

## 7. Wake: la grabación

Wake responde por fin *Did you keep anything?*

- **Layout:** igual que hoy (copy arriba y el DR-1 sobre la mesa de luz abajo). Entre el body y los botones entra el **registro de cinta**:

```
TAPE 01  THE STAIRCASE ............ You stopped. The stairs didn't.
TAPE 02  THE WHALE ABOVE THE CITY . It looked back.
TAPE 03  THE HOUSE YOU GREW UP IN . — no signal —
TAPE 04  THE OCEAN INDOORS ........ You stayed under.
TAPE 05  THE FALL ................. — no signal —
```

  - Mono `small` (13px). La columna del título va en `--ink-muted`. Los fragmentos guardados van en `--ink` y en itálica serif (la voz del sueño). `— no signal —` va en `--ink-faint`.
  - En mobile (≤ 640px), cada entrada ocupa dos líneas (`TAPE 02 · THE WHALE…` arriba y el fragmento abajo), sin puntos de relleno.
  - Es una `<ol>` real con `aria-label="Your recording"`.
- **Una línea según la lucidez**, entre el display y el body (borrador):

| Fragmentos | Línea |
| --- | --- |
| 0 | *The tape is blank. Most nights are.* |
| 1–2 | *A few seconds made it through.* |
| 3–4 | *Most of it made it through. Not all of it.* |
| 5 | *You kept all of it. That almost never happens.* |
| sin WebGL2 | *The tape is blank. Your browser couldn't reach the dream.* |

- **La cinta expulsada:** `DR1` recibe `tapeLabel={`Tape 05 · ${kept}/5 kept`}`. Ya genera la textura de la etiqueta desde texto (`useTapeLabel`), así que hay que regenerarla cuando cambia (`useMemo` sobre el texto y `dispose` de la anterior).
- **Captura:** Wake es vecina de Fall y queda cacheada **antes** de que ganes el fragmento de Fall. Cada `keep()` invalida la captura de Wake si está cacheada, y la recaptura en idle (3.4). El gesto en espera (3.2.8) cubre el caso de ganar el fragmento y scrollear enseguida.
- **Botones:** `REPLAY THE NIGHT` llama a `recording.reset()` y después a `goTo('hero')`. `VIEW SOURCE →` queda igual.
- **Opcional (decisión abierta, 13): *Save the tape*.** Un tercer botón que genera un PNG de la etiqueta de cinta con los fragmentos (canvas 2D, fuentes ya cargadas) y lo descarga. No agrega dependencias.

---

## 8. Configuración (`src/night/config.js`)

Solo los cambios respecto de hoy. Los `melt` no cambian.

```js
{ id: 'stair', /* … */ play: { model: 'scrub', length: 2700, stops: [0, 0.33, 0.66, 1] },
  hud: { state: 'rec', clock: '02:47 AM', clockTo: '03:04 AM', counter: '00:06:31' } },
{ id: 'whale', /* … */ play: { model: 'free' } },
{ id: 'house', /* … */ play: { model: 'free' } },
{ id: 'ocean', /* … */ play: { model: 'beats', beats: 4, beatDuration: 1.6 } },
{ id: 'fall',  /* … */ play: { model: 'scrub', length: 2700, stops: [0, 0.25, 0.5, 0.75, 1] },
  hud: { state: 'rec', clock: '06:41 AM', clockTo: '07:01 AM', counter: '00:52:17', counterTo: '00:58:31' } },
```

`App.jsx` pasa `gate={nightGate}` a `<ScrollSections>` (3.2) y le da al `Hud` el `id` actual para que lea el store de juego (progreso) y el de la grabación (lucidez).

---

## 9. Fases

Cada fase termina con `pnpm lint` sin errores, `pnpm build` OK, los criterios cumplidos y sin errores en consola.

### Fase 0: Estado y herramientas

- `night/play.js` (store + `usePlayRef` + `usePlay`), sin compuerta todavía.
- `night/recording.js` (`keep`, `lucidity`, `reset`, sessionStorage con `try/catch`).
- `night/dreams.js` con el copy de la sección 6. `DreamX.jsx` y `DreamTitle` leen el log de ahí (todavía estático, todas las frases visibles).
- `three/pointer.js`: `vx/vy`, `stillSince`, `down`, `onTap`. `three/gestures.js`: `createWaveDetector`.
- Panel de debug (4.5).
- **Terminado cuando:** la web se ve y navega **exactamente igual que hoy**, `?debug` muestra el estado, ganar o resetear fragmentos desde el panel persiste al recargar la pestaña y se borra al cerrarla, y `createWaveDetector` tiene un test mínimo o un script de verificación anotado.

### Fase 1: La compuerta

- Todo 3.2, 3.3 y 3.4 en `ScrollSections` y `useSectionTextures`.
- Para probar: Stair con `play: scrub` y Ocean con `play: beats`, **sin escena nueva todavía**. La escena actual solo lee `target` y lo muestra de forma cruda (Stair: una esfera que orbita como luna provisoria; Ocean: nivel del agua por beat).
- **Terminado cuando:**
  - Rueda, trackpad, touch y teclado recorren el scrub y los beats. El gesto que llega al final no derrite. Un gesto nuevo, sí. Hacia atrás funciona igual.
  - Entrando hacia atrás, el sueño aparece en su estado final **y el melt ya lo muestra así** (sin salto al asentarse).
  - La inercia de un flick en trackpad no cruza el final de un scrub.
  - Un salto (`Home`, `End`, `REPLAY`) resetea el estado del destino.
  - El desvío del manual y sus bordes funcionan como hoy.
  - Sin WebGL2 (forzar `HAS_WEBGL2 = false`), cada gesto cambia de sección, como hoy.
  - Invalidar y recapturar el overlay no produce frames negros ni cortes, y un gesto durante una recaptura se ejecuta al terminar (en menos de 600 ms).

### Fase 2: Transcript, lucidez, pistas y progreso

- `Transcript` (4.1), lucidez en el HUD (4.2), pistas (4.3), barra de progreso y reloj interpolado (4.4) y `DreamAction` (3.7), que por ahora solo dispara `play.trigger`.
- **Terminado cuando:**
  - Cada sueño transcribe su log al asentarse, sin parpadeo: el melt de entrada muestra el log vacío y el de salida lo muestra completo.
  - Stair y Ocean revelan frases con el progreso y los beats.
  - Un glitch aparece y se corrige. Con lucidez 5, no aparece.
  - Con reduced motion, el texto aparece completo.
  - Un lector de pantalla lee las frases completas y sin glitches.
  - La lucidez se ve en los sueños y en Wake, no en el hero ni en el manual, y el segmento nuevo parpadea en `rec`.
  - `Tab` muestra el `DreamAction` de cada sueño y no aparece en ninguna captura.

### Fase 3: Staircase

- Todo 6.1, en este orden:
  1. el tornillo con la figura caminando en el lugar (sin luna todavía);
  2. la luna con la escena apagada;
  3. las sombras, midiendo fps antes y después y anotándolo;
  4. detenerse y recuperar.
- **Terminado cuando:**
  - La figura sube en el lugar sin que los pies resbalen, y se lee como una persona a la distancia de cámara, en landscape y en portrait, por encima del título.
  - El scroll mueve la luna alrededor de la escalera; su luz se nota incluso fuera de cuadro o detrás de la columna, y las sombras giran con ella.
  - Mantener apretado detiene a la figura y la escalera se la lleva; al soltar vuelve a su lugar. El fragmento se gana así y también con `DreamAction`.
  - Un swipe en mobile mueve la luna sin detener a la figura por error.
  - 60 fps en laptop con sombras; en mobile, con sombras o con el respaldo documentado.

### Fase 4: Whale

- Todo 6.2.
- **Terminado cuando:** el saludo se detecta con mouse y con el dedo, sin falsos positivos al mover el mouse normalmente (probar un minuto de uso normal); la ballena se da vuelta, mira y vuelve a su ruta sin saltos; las ventanas y la figura del techo responden; la pista aparece una vez si no saludaste; 60 fps.

### Fase 5: House

- Todo 6.3.
- **Terminado cuando:** click o tap abre la puerta correcta; las sombras salen, doblan y caminan en las dos direcciones sin saltar cuando el pasillo se recicla; las que van a la cocina se funden con el brillo; hay sombras espontáneas; hacer click en un botón no abre puertas; el fragmento se gana solo con una sombra propia; 60 fps con 10 sombras activas.

### Fase 6: Ocean

- Todo 6.4.
- **Terminado cuando:** cada gesto sube un beat y el último deja la cámara bajo el agua; volver desde Fall aparece bajo el agua y el melt ya lo muestra así; los muebles responden a las ondas; quedarse 6 s bajo el agua enciende la lámpara y gana el fragmento; 60 fps.

### Fase 7: Fall

- Todo 6.5.
- **Terminado cuando:** el scrub acelera la caída, hace crecer la alarma y la luz, y avanza el reloj del HUD; quedarse quieto 3 s gira la cámara hacia la noche de arriba y gana el fragmento; el melt a Wake arranca desde la luz de abajo y se quema a blanco sin corte; 60 fps.

### Fase 8: Wake

- Todo 7.
- **Terminado cuando:** con 0, 3 y 5 fragmentos (usar `?debug`), Wake muestra el registro, la línea y la etiqueta de cinta correctos; el melt Fall → Wake ya muestra el fragmento de Fall aunque lo hayas ganado un segundo antes de scrollear; `REPLAY THE NIGHT` resetea todo; la lista se lee bien en 390px.

### Fase 9: Pulido, pósters y QA

- Regenerar los pósters (`pnpm posters`) en el estado 0 de cada sueño.
- Ajustar en dispositivo todos los números marcados como punto de partida y anotarlos en `DECISIONS.md`.
- Actualizar `README.md` (qué es la compuerta, cómo agregar un modelo de juego) y los briefs `Docs/onirick.*.mdx` (capacidades nuevas).
- Checklist de la sección 10 en Chrome, Safari y Firefox desktop, Safari iOS y Chrome Android.
- **Terminado cuando:** Lighthouse mobile da Performance ≥ 80 y Accessibility 100, sin errores en consola en producción y con el checklist completo.

---

## 10. Checklist de QA (se suma al de `PLAN.md` 9)

- [ ] Alguien que solo scrollea, sin tocar nada, ve una noche completa y coherente, y Wake le muestra la variante de 0 fragmentos.
- [ ] En scrub y beats, el gesto que llega al final nunca dispara el melt. El siguiente, siempre.
- [ ] Hacia atrás, cada sueño aparece en su estado final, sin salto al terminar el melt.
- [ ] Ninguna captura muestra texto a medio tipear, un `DreamAction` visible ni un overlay viejo.
- [ ] Los cinco fragmentos se pueden ganar con puntero, con touch y con teclado (`DreamAction`).
- [ ] Hacer click o tap en botones y links nunca dispara una interacción de escena.
- [ ] Mover el mouse normalmente en Whale no cuenta como saludo.
- [ ] Reduced motion: sin tipeo, sin temblores, beats y stops instantáneos; todo sigue siendo alcanzable.
- [ ] Sin WebGL2: un gesto, una sección; Wake muestra la línea de "sin WebGL".
- [ ] `REPLAY THE NIGHT` resetea fragmentos, lucidez, pistas y estado de juego.
- [ ] El HUD muestra la lucidez solo en sueños y en Wake; la barra de progreso se llena y parpadea al final.
- [ ] 60 fps en cada sueño en una laptop moderna, con la interacción más cara activa (sombras de la luna en Stair, 10 sombras en House, burbujas).

---

## 11. Riesgos conocidos

| Riesgo | Mitigación |
| --- | --- |
| La compuerta hace que el sitio se sienta "trabado" | Barra de progreso en el HUD (4.4), `length` corto (unas 3 pantallas) y el mismo "respiro" de gesto nuevo que ya tiene el manual. Si en pruebas se siente pesado, bajar `length` antes de agregar indicadores. |
| Recapturas frecuentes (100–400 ms) que compiten con la navegación | Debounce + `requestIdleCallback`, nunca durante un melt, y el gesto en espera (3.2.8). |
| El estado de entrada no coincide con la captura (salto al asentarse) | `prepare()` con `snap` + `invalidate()` del canvas antes de capturar (3.3). Verificarlo explícitamente en la fase 1. |
| Las sombras de House saltan cuando el pasillo se recicla | Espacio de mundo + compensar `CREEP` (6.3). |
| Falsos positivos del saludo | Umbral de amplitud y ventana de tiempo; probar un minuto de uso normal (fase 4). |
| Los pies de la figura resbalan sobre la escalera y se rompe la ilusión | Caminata y tornillo comparten `T_STEP`; se construye primero, sin luna (fase 3, paso 1). |
| Las sombras en tiempo real bajan el rendimiento | Una sola luz con sombra, solo en este sueño, `mapSize` reducido en mobile y respaldo documentado (6.1). |
| La escena queda demasiado oscura cuando la luna está atrás o fuera de cuadro | Piso de luz ambiente (~0.07) y el ámbar de la niebla; ajustar mirando el póster y el título. |
| Conflicto entre mantener apretado y el swipe del scrub en mobile | Detenerse exige 250 ms quieto; si el dedo se mueve, gana el scrub (6.1). |
| El texto transparente del transcript sale en la captura | `color: transparent` no se pinta. Verificarlo con `modern-screenshot` en la fase 2 antes de seguir. |
| Rendimiento en mobile con las escenas más cargadas | Pools fijos, `InstancedMesh`, tope de DPR actual. Recortar geometría antes que efectos. |
| Alcance: cinco sueños con interacción | El orden de fases deja cada sueño terminado y publicable por separado. Si el tiempo aprieta, House puede quedar sin sombras espontáneas y Fall sin las nubes de la noche. |

---

## 12. Fuera de alcance (próximas iteraciones)

- **Segunda noche distinta.** Con la narrativa ya fija, `recording.js` guarda cuántas noches grabaste (`localStorage`) y los sueños cambian de forma fiel al original. Ejemplos: la ballena no está (*"Neither was the whale"*), la casa tiene una puerta nueva, el HUD dice `NIGHT 02`.
- **Sonido opt-in.** Un toggle en el HUD, apagado por defecto. Fuentes gratis:
  - **Sintetizado con Web Audio, sin archivos.** El hiss de cinta es ruido filtrado, la alarma es un oscilador con envolvente y el agua es ruido con filtro pasa-bajos. Es la opción recomendada para la mayor parte.
  - **freesound.org**, filtrando por licencia **CC0**, para ambientes: agua, viento, habitación.
  - **Pixabay Sound Effects**, con su propia licencia libre de regalías.
  - **Sonniss GDC Game Audio Bundle**, libre de regalías y en volúmenes grandes.
  - Cualquier archivo usado queda registrado con su licencia en `CREDITS.md`.
- **Manual interactivo:** hover en la `SpecTable` resalta la pieza en una vista explotada del DR-1, y botones `PLAY TAPE 0N` que saltan a cada sueño.
- **Cursor propio** para toda la noche.
- **Distorsión del texto bajo el agua** en Ocean (filtro SVG sobre el DOM, con riesgo de captura).
- **Giroscopio** para dirigir la caída en mobile.
- **Lucidez con efecto en las escenas o en el melt** (ver 13).

---

## 13. Decisiones abiertas (para el usuario)

1. **House: ¿scrub de "caminar sin llegar"?** Que el scroll te haga caminar más rápido por el pasillo sin que la cocina se acerque nunca. Refuerza "inalcanzable", pero suma otro scrub a la noche. Por defecto: **no** (libre).
2. **Condiciones de los fragmentos.** Las de la sección 6 son una propuesta: detenerse y volver a su lugar después de 2 escalones, saludo, una sombra propia que llega a la cocina, 6 s bajo el agua y 3 s quieto en la caída.
3. **Copy nuevo** (frases por beat y progreso, glitches, etiquetas de fragmento, pistas, líneas de Wake). Todo es borrador y vive en `night/dreams.js` y en `Wake.jsx`.
4. **¿La lucidez afecta algo más que el copy y los glitches?** Por ejemplo, niebla más liviana o un melt un poco más suave con lucidez alta. Por defecto: **no**, para no contradecir la intensificación de la noche.
5. **Estado al volver a un sueño.** Por defecto, el estado de juego depende de la dirección de entrada (3.3) y los fragmentos quedan; la posición de la figura y las puertas abiertas se pierden si la escena se desmonta.
6. **Save the tape** (PNG descargable desde Wake). Por defecto: **fuera**, se suma en la fase 8 si hay tiempo.
7. **La última frase de Staircase.** *"The handrail is warm, like someone just let go"* venía de la baranda, que se descartó. Se puede dejar como imagen suelta o reemplazar por una que acompañe la nueva escena, por ejemplo *"If you stop, the stairs keep going."* Por defecto queda la actual hasta que se retoque la narrativa.
