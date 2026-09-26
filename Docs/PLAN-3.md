# PLAN-3.md — Onirick: el sonido

> Tercer plan de desarrollo para un agente de IA. Continúa `Docs/PLAN.md` (noche 1) y `Docs/PLAN-2.md` (noche 2, cerrados). Repositorio: `nicolaslema/Onirick`, base: rama `develop`. Sale de la sección 1.2 de `Docs/FUTURO.md`, donde están las decisiones tomadas con el usuario.
> Idioma de este documento: español. **Todo el texto visible de la web va en inglés.** El contenido sonoro de este plan es **borrador**: se ajusta de oído, sección por sección, con el usuario.

---

## 0. Cómo usar este plan (instrucciones para el agente)

1. **Leé este plan completo**, después la sección 1.2 de `Docs/FUTURO.md` y los tres documentos anteriores donde este plan no dice nada: `Docs/PLAN.md` (tokens, capturas, melts), `Docs/PLAN-2.md` (compuerta, stores de juego, escenas) y `DECISIONS.md`. Después leé:
   - `src/App.jsx`, `src/night/stage.js`, `src/night/play.js`, `src/night/recording.js`, `src/night/config.js`.
   - `src/components/Hud/Hud.jsx` y `src/components/ScrollSections/ScrollSections.jsx`.
   - La escena de cada sección antes de ponerle sonido.
2. **Trabajá por fases (sección 7), en orden.** Cada fase es una sección de la noche: no empieces la siguiente hasta que el usuario haya escuchado y aprobado la anterior.
3. **Branches:** `plan-3` sale de `develop` y lleva este documento. Cada fase sale de `plan-3` (o de la fase anterior, ya aprobada): `snd-phase-0-engine`, `snd-phase-1-global`, etc. Commits chicos. No pushees a `main`.
4. **Al terminar cada fase:** `pnpm lint`, `pnpm build`, `pnpm test`, verificá los criterios en el navegador, medí los niveles con el panel de debug (3.8) y escribí un resumen corto con lo que el usuario tiene que escuchar y dónde.
5. **Vos no podés escuchar.** El criterio final de cada fase es **el oído del usuario**. Lo tuyo es que suene lo que dice el plan, en los niveles del plan (sección 6), sin clics ni cortes (verificable con el analizador) y sin errores. Anotá en `DECISIONS.md` lo que el usuario pidió cambiar.
6. **Si una decisión no está acá y cambia lo que se oye, lo que se ve o la arquitectura, preguntá.** Para detalles menores, elegí lo más simple y anotalo en `DECISIONS.md` bajo `## Sound — Phase N`.
7. **Nada de dependencias nuevas.** Web Audio es nativo. Los archivos CC0 solo entran con el acuerdo del usuario (2.3).
8. **Lo que ya funciona no se rompe:** con el sonido apagado, la web se comporta **exactamente igual que hoy**. Lighthouse sobre el sitio desplegado: mobile ≥ 80 (hoy 83), desktop 99, y 100 en Accessibility, Best Practices y SEO. También reduced motion, el fallback sin WebGL2 y el desvío del manual.

---

## 1. Concepto

La DR-1 es una grabadora: **ahora se la escucha grabar.** El sonido no es música ni una banda de sonido: es la máquina y lo que la máquina capta del sueño.

1. **Opt-in y bajo.** Apagado por defecto. Encendido, es un fondo que se escucha con atención, nunca algo que tape.
2. **El sonido sigue a lo que ya pasa.** Cada sonido cuelga de una señal que ya existe (sección, transición, progreso, evento, fragmento). No hay estados nuevos inventados para el sonido.
3. **El melt se escucha como cinta estirada**, y se intensifica igual que la imagen a lo largo de la noche.
4. **El silencio también cuenta:** el manual (despierto) y el quemado a blanco antes de Wake.
5. **Ninguna información depende del sonido.** Todo lo que suena ya se ve. Quien no activa el sonido no se pierde nada.

---

## 2. Decisiones tomadas

Vienen de `Docs/FUTURO.md` 1.2 (usuario, 2026-09-26). No las reabras sin preguntar.

| Tema | Decisión |
| --- | --- |
| Alcance | Capa global + un ambiente por sección, construidos por fases. |
| Toggle | Botón `SOUND OFF` / `SOUND ON` en el HUD, siempre visible, **apagado por defecto**. |
| Origen | **Sintetizado con Web Audio primero.** Archivos CC0 solo donde lo sintetizado no convenza (2.3). |
| Preferencia | **No se guarda.** Cada visita arranca sin sonido. |
| Manual | **A definir** con el usuario en su fase (7, fase 8). |
| Clic por carácter en los logs | **No.** Cansa rápido. La impresión de Wake es la única excepción. |

### 2.1 Qué se considera "sintetizado"

Todo sonido generado en el navegador con nodos de Web Audio: osciladores, buffers de ruido generados por código, filtros, envolventes y modulación. Cero archivos de audio.

### 2.2 Qué se considera "CC0"

Grabaciones reales (`.ogg`, con `.m4a` de respaldo si Safari lo exige) con licencia CC0 de freesound.org u otras fuentes con licencia libre de regalías (Pixabay, Sonniss GDC). Pasan por el mismo grafo de Web Audio que lo sintetizado (filtros, ganancia).

### 2.3 Cuándo un sonido pasa a CC0

Solo si el usuario, después de escuchar la versión sintetizada, dice que no convence. Entonces:
- el agente propone 2 o 3 candidatos con link y licencia;
- el usuario elige;
- el archivo va a `public/sound/`, recortado y normalizado (mono, ≤ 30 s, ≤ 250 KB), y se carga **solo al activar el sonido**;
- se registra en `CREDITS.md` (fuente, autor, licencia, link).

Candidatos probables (según el análisis de `FUTURO.md`): pasos de la escalera, agua de Ocean, pájaros de Wake.

---

## 3. Arquitectura

```
src/
  sound/                     ← NUEVO: motor genérico, no sabe nada de sueños
    bus.js                   ← en el primer chunk (tiny): estado on/off, cue(), param()
    engine.js                ← lazy: AudioContext, grafo, capas, ciclo de vida
    synth.js                 ← lazy: primitivas (ruido, osciladores, envolventes, wow)
  night/
    score.js                 ← NUEVO, lazy: qué suena en cada sección (el "guion sonoro")
  components/
    SoundToggle/             ← NUEVO: el botón, al lado del HUD
    ScrollSections/          ← activeTransition suma { kind, duration, intensity } (3.4)
    DebugPanel/              ← medidores de nivel por capa (3.8)
```

### 3.1 `sound/bus.js`: lo único que va en el primer chunk

Un store externo mínimo (mismo patrón que `night/stage.js`), que no importa nada de Web Audio:

```js
isOn()                       // boolean
useSound()                   // React: { on }
toggle()                     // enciende o apaga (ver 3.2)
cue(name, params?)           // un sonido puntual: 'step', 'door', 'whale-call', …
param(name, value)           // un valor continuo: 'ocean.under', 'fall.speed', …
```

- **Con el sonido apagado, `cue` y `param` retornan en la primera línea.** Las escenas pueden llamarlos cada frame sin costo.
- `param` solo guarda el último valor; el motor lo lee cuando lo necesita (nada de eventos por frame).
- Presupuesto: **menos de 1 KB gzip** en el primer chunk. Verificarlo en el build.

### 3.2 Encender y apagar

- **Encender** (click en el toggle):
  1. crear el `AudioContext` **sincrónicamente dentro del handler del click** (Safari exige que se cree o se reanude dentro del gesto; si se crea después del `await` del import, queda suspendido);
  2. `import('./engine')` y pasarle el contexto;
  3. el motor arma el grafo y hace un fade-in del master de 1 s (encender nunca es un golpe).
- **Apagar:** fade-out del master de 0.3 s y `ctx.suspend()`. El grafo queda armado: volver a encender es instantáneo.
- **Pestaña oculta** (`visibilitychange`): `suspend()`; al volver, `resume()` con fade-in de 0.3 s, solo si estaba encendido.
- **Sin persistencia** (2): recargar arranca apagado.

### 3.3 El grafo

```
capas de sección (ambientes) ─┐
capa global (cinta, motor) ───┼─→ wow (melt) ─→ master ─→ limitador ─→ destino
puntuales (cue) ──────────────┘                    ↑
                                      puntuales de interfaz (sin wow)
```

- **Ambientes por sección:** cada sección tiene su propio `GainNode`. Solo suenan la sección actual y, durante una transición, las dos que participan. Las demás se desconectan (sin costo de CPU).
- **Wow:** un `DelayNode` modulado por un LFO (vibrato por modulación del tiempo de retardo) = el pitch que se dobla de la cinta. Ver 4.3.
- **Limitador:** un `DynamicsCompressorNode` con ratio alto como red de seguridad, no como parte del sonido.
- **Todo cambio de ganancia o de filtro usa rampas** (`setTargetAtTime` / `linearRampToValueAtTime`). Nunca asignar `.value` directo sobre algo que suena: produce clics.

### 3.4 Señales: de dónde sale cada sonido

| Señal | Hoy | Para qué |
| --- | --- | --- |
| Sección actual y asentada | `night/stage.js` (`currentId`, `settled`) | Qué ambiente suena |
| Estado de la DR-1 | `NIGHT[i].hud.state` (`standby`, `rec`, `stop`) en `config.js` | Si el motor de la cinta gira |
| Transición | `onStateChange` → `activeTransition { from, to }` | Crossfade de ambientes y wow |
| Progreso / beat | `night/play.js` (`subscribeTarget`, `getPlay`) | Viento de Fall, subida del agua |
| Eventos | `play.trigger` / `play.act` | Reacciones (`wave`, `let-go`, `action`) |
| Fragmento guardado | `night/recording.js` (`keep`) | El clic de cinta |
| Lo que solo sabe la escena | **nuevo:** `bus.cue` / `bus.param` desde la escena | Pasos, puertas, agua, ballena |

**Cambio en `ScrollSections` (genérico, sin saber de sonido):** hoy `activeTransition` es `{ from, to }`. Pasa a ser `{ from, to, kind: 'melt' | 'plain', duration, intensity }`, con los valores que el motor **ya resolvió** para esa transición (la regla del `Math.max` para pasos contiguos y la del destino para saltos, `DECISIONS · Phase 1`). Así el sonido no duplica esa regla. `intensity` es la del melt (0.45 a 1.25 en `config.js`); en un crossfade, 0. `App.jsx` se lo pasa al motor de sonido junto con el resto.

**Cambios en las escenas:** una o dos líneas cada una, en el lugar donde ya pasa lo que suena (el paso de la figura, la puerta que se abre). Se detallan en cada sección (5).

### 3.5 `night/score.js`: el guion sonoro

Separado del motor, como `dreams.js` está separado de la lógica: **qué suena en cada sección**, con sus niveles y parámetros, en un solo archivo. Retocar un sonido no toca el motor.

```js
export const SCORE = {
  stair: {
    ambience: { /* receta del ambiente */ },
    cues: { step: { /* receta */ } },
    params: { /* cómo se mapea un param a la receta */ }
  },
  // …
};
```

### 3.6 El toggle: `SoundToggle`

- **Un `<button>` real** con `aria-pressed`, texto `Sound off` / `Sound on` (en mayúsculas por CSS, como el HUD) y un indicador de estado (un punto o dos barras que se mueven, estático con reduced motion).
- **No va dentro del `div` del HUD**, que es `aria-hidden` y `pointer-events: none`: va **como hermano**, igual que las regiones `aria-live` del HUD, posicionado fijo en la esquina superior izquierda, debajo de `ONIRICK · DR-1`. Mismo estilo que el HUD (mono, 12px, 500, tracking 0.12em), con `pointer-events: auto`.
- **Tamaño táctil:** 44 px mínimos en touch y pantallas angostas (misma regla que los botones, `DECISIONS · Phase 7`).
- **Tema:** sigue a la sección actual (`data-theme="paper"` en el manual), como el HUD.
- **Foco:** el anillo de foco de los botones. El teclado de navegación escucha en `window` y no usa Space ni Enter, así que activar el toggle con teclado no navega. Verificarlo.
- **No se captura en el melt:** está fuera de las secciones, como el HUD.
- **Hero en portrait:** `DeviceScene` ajusta el DR-1 midiendo el borde inferior de `.onk-hud-tr` (`DECISIONS · Phase 6`). El toggle agrega una línea en la esquina izquierda que puede quedar más abajo: medir **la más baja de las dos esquinas superiores**. Verificar en 390 × 844 y 375 × 667.
- **Anuncio:** al encender o apagar, `aria-pressed` alcanza. Sin anuncio `aria-live` extra.

### 3.7 Reduced motion, sin WebGL2 e iOS

- **Reduced motion:** no dice nada del audio. El sonido es el mismo, salvo el **wow del melt**, que pasa a ser un crossfade simple (como la imagen), y los cambios de ambiente que dependen de una animación, que siguen su tempo (por ejemplo, los pasos de la escalera al 25%).
- **Sin WebGL2:** no hay escenas, así que no hay `cue` de escena. Los ambientes y la capa global funcionan igual, con crossfades entre pósters.
- **iOS:** Web Audio respeta el interruptor de silencio del iPhone. No es verificable hasta tener dispositivos (quedó para más adelante en `FUTURO.md`). Anotarlo en el README.

### 3.8 Panel de debug (solo dev, `?debug`)

Suma al panel existente:
- estado del `AudioContext` (`running` / `suspended`);
- un **medidor por capa** (global, ambiente actual, puntuales, master): RMS y pico en dBFS, con un `AnalyserNode` por capa;
- un contador de **clics detectados**: saltos de muestra a muestra mayores que un umbral en el master;
- botones para disparar cada `cue` de la sección actual y un deslizador por `param`.

Es la forma de verificar niveles y ausencia de clics sin oídos, y de que el usuario pruebe cada sonido sin jugar la noche entera. **No entra en el build de producción** (igual que el panel actual).

---

## 4. La capa global

Suena en toda la noche, debajo de los ambientes.

### 4.1 La cinta y el motor

- **Hiss de cinta:** ruido rosa, pasa-altos ~3 kHz, pasa-bajos ~9 kHz, muy bajo. Suena siempre que el sonido está encendido.
- **Motor:** un zumbido grave (fundamental ~55 Hz más dos armónicos, con pasa-bajos), con una fluctuación lenta de pitch (±0.3%, 0.5 Hz). **Gira solo cuando la DR-1 graba** (`hud.state === 'rec'`: los cinco sueños):
  - entrar a `rec` (BEGIN RECORDING, o volver del manual): el motor arranca subiendo de pitch en 0.6 s;
  - salir de `rec` (al manual, `STANDBY`): se frena bajando de pitch en 0.8 s;
  - así **el manual queda sin motor** por construcción, lo que ya lo separa del sueño aunque su ambiente siga a definir.
- **Standby** (hero y manual): solo un zumbido eléctrico muy tenue (100 Hz, casi inaudible).

### 4.2 Wake: STOP y eject

- Al asentarse en Wake (`hud.state === 'stop'`): el motor se frena de golpe (0.3 s, bajando de pitch), un **clack** de STOP (ruido filtrado + un transitorio grave) y, 0.4 s después, el **eject** (un clack más largo con un resorte: un tono corto que baja).
- Después, solo el hiss muy bajo y el ambiente de Wake (5.8).

### 4.3 El melt suena a cinta estirada

- Durante una transición `kind: 'melt'`, **el wow** dobla el pitch de todo lo que suena (ambientes y capa global): la profundidad del LFO sigue la misma envolvente que el melt (sube hasta la mitad, baja al final), con `duration` de `activeTransition`.
- **Se intensifica con la noche:** profundidad y velocidad del wow escalan con `intensity` (0.45 en el primer melt, 1.25 en el último).
- **Crossfade de ambientes:** el de salida baja y el de entrada sube a lo largo de la transición, cruzándose en la mitad.
- **Transición 7 (Fall → Wake, `burn`):** en el quemado a blanco **todo baja a silencio** en la mitad del melt (con la imagen en blanco), y Wake entra desde el silencio con el STOP (4.2).
- **Crossfades (`kind: 'plain'`: manual, saltos, sin WebGL2):** solo crossfade de ambientes, sin wow.
- **Reduced motion:** sin wow; solo crossfade.

### 4.4 Puntuales globales

- **Fragmento guardado** (`recording.keep`): un clic de cinta (dos transitorios cortos, como una tecla mecánica) y un tono breve muy suave. Coincide con el parpadeo `rec` del segmento de lucidez.
- **Botones** (`onk-btn`, incluido `DreamAction`): un clic de tecla sordo, muy bajo, al activarse. **No** en hover.
- **`REPLAY THE NIGHT`:** un rebobinado corto (ruido que sube de pitch rápido, 0.8 s), durante el crossfade al hero.

---

## 5. Sección por sección

Formato: **qué suena**, **señales**, **técnica** (punto de partida), **terminado cuando**. Todo es borrador hasta que el usuario lo escuche.

### 5.1 Hero

- **Qué suena:** standby (4.1) y nada más: la máquina está esperando. Al hacer click en BEGIN RECORDING, el motor arranca con el melt a la escalera.
- **Señales:** `hud.state`.
- **Terminado cuando:** encender el sonido en el hero da un fade-in del standby, sin clic; BEGIN RECORDING arranca el motor.

### 5.2 Dream 01: The Staircase

- **Qué suena:**
  - **pasos lentos**, uno cada `T_STEP` (2 s), cuando cada pie se apoya en el escalón;
  - un eco grande y oscuro de piedra (reverb sintético: ruido con decaimiento exponencial como respuesta de un `ConvolverNode`, generada por código);
  - un zumbido muy grave y lejano para la luna, que se abre (filtro) a medida que sube con el scroll.
- **Al detenerte:** los pasos paran. La escalera sigue "sonando": un roce grave, continuo, de piedra que gira, que se escucha más cuando estás parado. Al soltar, los pasos vuelven más rápidos (cadencia de recuperación 1.8 y 3).
- **Señales:** `cue('step', { foot, cadence })` desde `StairScene.jsx`, donde el ciclo de caminata (`climb.current.u`) cruza el apoyo de un pie; `param('stair.stopped', 0|1)`; progreso del scrub para la luna.
- **Técnica:** paso = ruido corto filtrado (pasa-banda ~300 Hz) + un transitorio grave, con variación aleatoria de ±10% en pitch y nivel para que no suene a loop. **Candidato a CC0** si no convence.
- **Terminado cuando:** los pasos caen exactamente cuando el pie se apoya (verificado con el panel: el `cue` y el apoyo en el mismo frame), paran al detenerte, vuelven más rápidos al soltar y nunca se superponen.

### 5.3 Dream 02: The Whale Above the City

- **Qué suena:** viento alto (ruido con pasa-banda que se mueve lento) y un rumor lejano de ciudad (ruido grave con pasa-bajos ~200 Hz).
- **El saludo:**
  - **primer saludo (reacción completa):** un **canto de ballena**: dos o tres tonos graves que se deslizan (glissando entre ~80 y ~300 Hz, con un vibrato lento y formantes con pasa-banda), mientras baja y te mira; un tono cálido y suave cuando la luz recorre la ciudad;
  - **saludos siguientes ("ya te vi"):** un canto corto de un solo tono.
- **Señales:** `cue('whale-call', { full })` desde `WhaleScene.jsx`, donde arranca cada reacción. Hoy el evento `wave` se dispara una sola vez por noche, así que el canto corto **necesita** el `cue` de la escena.
- **Terminado cuando:** el primer saludo da el canto completo y los siguientes el corto; mover el mouse normalmente no hace sonar nada.

### 5.4 Dream 03: The House You Grew Up In

- **Qué suena:**
  - el **zumbido de una heladera lejana**: la cocina (tono ~60 Hz y armónicos, pasa-bajos, con un "ciclo" que arranca y para cada tanto);
  - el tono de la habitación, muy bajo;
  - **una puerta que se abre:** un crujido (ruido con resonancias que se mueven) y la luz que se derrama como un leve aumento del tono de la habitación;
  - **pasos de las sombras:** muy suaves, sordos, que se alejan (paneo y volumen según su `z`);
  - **la cocina se aleja** (el estiramiento): la heladera baja y se aleja (pasa-bajos + volumen) en 0.8 s y vuelve en 6 s, con la misma curva que la imagen.
- **Señales:** `cue('door', { x, z, spontaneous })` y `param('house.stretch', 0→6)` desde `HouseScene.jsx`. Pasos de sombras: `param` con la posición de las sombras activas, o un `cue` por paso (lo que resulte más simple; anotarlo).
- **Terminado cuando:** cada puerta que se abre cruje (las espontáneas, más lejos y más bajas), la heladera se aleja con la cocina, y con 10 sombras caminando no hay saturación ni clics.

### 5.5 Manual

- **A definir con el usuario** al llegar a esta fase (2). Mientras tanto: sin motor (4.1, standby) y el zumbido de standby. Opciones para proponerle: silencio casi total; un tono de habitación de día; el roce de las páginas al scrollear.

### 5.6 Dream 04: The Ocean Indoors

- **Qué suena:**
  - **agua que golpea** contra las paredes, baja: ruido con pasa-bajos modulado por la respiración del agua (±0.08 en 8 s) y el oleaje;
  - **cada beat** sube el agua: el sonido del agua se acerca y se llena (más graves, más volumen) durante los 1.6 s de subida;
  - **bajo el agua (beat 3):** todo pasa por un pasa-bajos fuerte (~400 Hz), incluidos la capa global y los puntuales: el mundo queda sordo. Burbujas cuando mueve el puntero (tonos cortos que suben, con pasa-banda);
  - **la lámpara** (el fragmento): un zumbido eléctrico cálido y bajo, con el mismo parpadeo del encendido.
- **Señales:** `param('ocean.under', 0→1)` desde `OceanScene.jsx`, con la función `underBy(level)` que ya existe, así el sonido cruza la superficie exactamente cuando la cámara; `cue('bubble')`; `param('ocean.lamp', 0→1)`.
- **Técnica:** el pasa-bajos de "bajo el agua" se aplica sobre el master (antes del limitador, 3.3), siguiendo `ocean.under` con rampas, así al subir se deshace igual. **Candidato a CC0** para el agua si no convence.
- **Terminado cuando:** el pasa-bajos sigue exactamente al cruce de la superficie en las dos direcciones, el agua respira, y la lámpara suena solo con el fragmento.

### 5.7 Dream 05: The Fall

- **Qué suena:**
  - **viento** que crece con la velocidad de caída (ruido con pasa-banda que se abre y sube de volumen con `SPEED × (1 + 1.5p)`);
  - **la alarma:** pitidos cortos en un tono agudo (seno + un armónico), al **mismo ritmo que el punto REC del HUD**: el período baja de 1.2 s a 0.3 s con el scrub (`hud.recTo`). Cada anillo que cruza la cámara, un "whoosh" breve;
  - **soltarse** (la cámara mira hacia arriba): el viento baja y se abre un tono amplio y suave. La noche entera arriba, en sonido: un eco lejano de los ambientes de los sueños donde guardaste el fragmento (opcional, si no sobrecarga);
  - **perder el control** (desde 0.75): el viento y la alarma aceleran con la caída, y en el quemado a blanco, **silencio** (4.3).
- **Señales:** progreso del scrub (`subscribeTarget` de `play.js`), el mismo cálculo de período del REC que usa el HUD (extraerlo a una función compartida en vez de duplicarlo), `cue('ring')` desde `FallScene.jsx`, `param('fall.up', 0→1)`.
- **Terminado cuando:** los pitidos van en fase con el REC del HUD (a ojo y en el panel), el viento sigue la velocidad y el melt a Wake cae a silencio en el blanco.

### 5.8 Wake

- **Qué suena:**
  - STOP y eject (4.2);
  - **la impresora:** un tic por carácter impreso (transitorio muy corto y agudo, bajo), más grave para los encabezados (`Tape 0N · …`) que para los fragmentos, y un "avance de línea" entre filas. Es **la única** tipografía con sonido (2);
  - **amanecer:** un tono de habitación de mañana, muy suave. **Pájaros**: opcional, **candidato a CC0** (difícil de sintetizar); preguntarle al usuario;
  - `SAVE THE TAPE`: el clic de botón (4.4); `REPLAY`: el rebobinado (4.4).
- **Señales:** `cue('print', { head })` desde el loop de impresión de `Wake.jsx` (el `tick` que avanza caracteres).
- **Con reduced motion** el registro aparece completo: **sin tics**.
- **Terminado cuando:** cada llegada a Wake da STOP, eject y la impresión con sus tics; al terminar de imprimir queda solo el amanecer.

---

## 6. Mezcla: niveles de partida

Puntos de partida, a ajustar de oído con el usuario y anotar en `DECISIONS.md`. Medidos con el panel (3.8), en dBFS.

| Capa | RMS objetivo | Pico máximo |
| --- | --- | --- |
| Master | −24 a −20 | −6 |
| Hiss de cinta | −48 | — |
| Motor | −40 | — |
| Ambiente de sección | −32 a −26 | −12 |
| Puntuales de escena (pasos, puertas, ballena) | — | −12 |
| Puntuales de interfaz (botones, fragmento) | — | −18 |
| Alarma de Fall en su punto más alto | — | −10 |

- **El limitador no debería actuar** en uso normal: si el panel lo muestra reduciendo más de 3 dB, bajar la capa que lo provoca.
- **Ningún sonido nuevo se agrega sin medir** el master con el peor caso de su sección (10 sombras en House, la alarma al máximo en Fall).

---

## 7. Fases

Cada fase termina con `pnpm lint`, `pnpm build` y `pnpm test` limpios, sin errores ni advertencias en consola, los criterios cumplidos y **la aprobación de oído del usuario**.

### Fase 0: Motor y toggle

- `sound/bus.js`, `sound/engine.js` (contexto, grafo vacío con master, limitador y capas), `sound/synth.js` (primitivas: buffer de ruido blanco y rosa, osciladores, envolventes, reverb sintético).
- `SoundToggle` (3.6) y el ajuste de `DeviceScene` en el hero.
- Ciclo de vida (3.2): encender, apagar, pestaña oculta.
- Panel de debug (3.8), con un tono de prueba.
- **Terminado cuando:**
  - Con el sonido apagado la web es idéntica a hoy y el primer chunk crece menos de 1 KB gzip.
  - El toggle se activa con mouse, touch y teclado, lee bien su estado en un lector de pantalla, mide 44 px en touch y sigue el tema del manual.
  - En portrait el DR-1 del hero no queda debajo del toggle.
  - El tono de prueba suena, se apaga y vuelve sin clics; al ocultar la pestaña el contexto se suspende.
  - Lighthouse sobre el sitio desplegado (o en preview, comparando con `develop` el mismo día) sigue igual.

### Fase 1: Capa global

- Toda la sección 4: hiss, motor por `hud.state`, standby, STOP y eject, wow del melt con crossfade de ambientes (todavía vacíos), silencio del burn, fragmento, botones y rebobinado.
- El cambio de `activeTransition` en `ScrollSections` (3.4).
- **Terminado cuando:** recorriendo la noche entera se escucha el motor arrancar al dormir, frenar en el manual y volver, el wow más fuerte en cada melt, el silencio en el blanco y STOP + eject en Wake; guardar un fragmento hace clic; sin clics ni cortes en el panel.

### Fase 2: Hero + Staircase (5.1, 5.2)

### Fase 3: Whale (5.3)

### Fase 4: House (5.4)

### Fase 5: Ocean (5.6)

### Fase 6: Fall (5.7)

### Fase 7: Wake (5.8)

Para las fases 2 a 7: **terminado cuando** se cumple el "terminado cuando" de su sección, los niveles están dentro de la tabla 6 en el peor caso de la sección, y el usuario aprobó el sonido. Si un sonido pasa a CC0 (2.3), se resuelve dentro de su fase.

### Fase 8: Manual, mezcla final y cierre

- **Manual:** decidir con el usuario (5.5) y hacerlo.
- **Pasada de mezcla** de la noche entera, de corrido, con el usuario.
- `CREDITS.md` si entró algún archivo CC0.
- `README.md`: cómo funciona el sonido (bus, motor, guion), cómo agregarle sonido a una sección, y la nota de iOS.
- Checklist de la sección 8.
- **Terminado cuando:** el checklist está completo y Lighthouse sobre el sitio desplegado sigue en mobile ≥ 80 y 100 en el resto.

---

## 8. Checklist de QA

- [ ] Con el sonido apagado, la noche es idéntica a la de `develop` (navegación, capturas, rendimiento).
- [ ] Encender no suena de golpe (fade-in); apagar y encender no dejan clics.
- [ ] Ocultar la pestaña silencia; volver retoma, solo si estaba encendido.
- [ ] Recargar arranca apagado.
- [ ] Cada melt suena a cinta estirada y más fuerte a medida que avanza la noche; los crossfades, no.
- [ ] El blanco antes de Wake es silencio.
- [ ] Cada sección suena según su sección 5, y en el peor caso los niveles están dentro de la tabla 6.
- [ ] Reduced motion: sin wow, sin tics de impresora; todo lo demás suena.
- [ ] Sin WebGL2: capa global y ambientes, sin errores.
- [ ] El toggle es accesible (teclado, lector de pantalla, 44 px en touch) y no tapa nada en 390 px.
- [ ] Sin errores ni advertencias en consola, con y sin sonido.
- [ ] Lighthouse desplegado: mobile ≥ 80, desktop sin bajar, 100 en Accessibility, Best Practices y SEO.

---

## 9. Riesgos conocidos

| Riesgo | Mitigación |
| --- | --- |
| El agente no puede escuchar | Panel con medidores y detector de clics (3.8), niveles objetivo (6) y aprobación del usuario por fase. |
| Lo sintetizado suena "de videojuego viejo" o falso | Filtros y variación aleatoria en todo; reverb sintético para dar espacio; CC0 como salida por sonido (2.3). |
| Cansa: un zumbido constante molesta a los minutos | Niveles bajos, el hiss casi inaudible, el manual sin motor como respiro, y la pasada de mezcla de corrido (fase 8). |
| Clics al cambiar ganancias o filtros | Solo rampas (3.3); el detector de clics del panel. |
| Safari: el contexto queda suspendido | Crearlo dentro del handler del click, antes de cualquier `await` (3.2). |
| iOS: el interruptor de silencio lo apaga | Documentado; no verificable hasta tener dispositivos. |
| El sonido suma peso al primer chunk | Solo `bus.js` va en el primer chunk; motor, síntesis y guion son lazy (3.1). |
| Los pasos o la alarma se desfasan de la imagen | Los dispara la escena en el mismo frame (`cue`), no un reloj aparte; la alarma usa el mismo cálculo que el REC. |
| CPU en mobile con muchas voces (10 sombras, burbujas) | Voces con tope por tipo (pool), las secciones fuera de escena desconectadas (3.3). |

---

## 10. Fuera de alcance

- Guardar la preferencia de sonido entre visitas (decidido que no, 2).
- Control de volumen (el del sistema alcanza).
- Música.
- Audio espacial con HRTF (el paneo estéreo simple alcanza).
- Sonido en el póster/OG o en *Save the tape*.

---

## 11. Decisiones abiertas

Se preguntan al usuario cuando llegue su fase:

1. **Manual** (fase 8): silencio, tono de habitación de día o roce de páginas.
2. **Pájaros en Wake** (fase 7): sí o no; si sí, probablemente CC0.
3. **Cada sonido candidato a CC0** (pasos, agua, pájaros): se decide después de escuchar la versión sintetizada.
4. **El eco de los sueños guardados al mirar hacia arriba en Fall** (fase 6): si suma o sobrecarga.
