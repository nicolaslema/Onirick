# PLAN-3.md — Onirick: el sonido

> Tercer plan de desarrollo para un agente de IA. Continúa `Docs/PLAN.md` (noche 1) y `Docs/PLAN-2.md` (noche 2, cerrados). Repositorio: `nicolaslema/Onirick`, base: rama `develop`. Sale de la sección 1.2 de `Docs/FUTURO.md`, donde están las decisiones tomadas con el usuario.
> Idioma de este documento: español. **Todo el texto visible de la web va en inglés.** El contenido sonoro de este plan es **borrador**: se ajusta de oído, fase por fase, con el usuario.
> **Revisado el 2026-09-26, después de escuchar la fase 0:** la noche lleva **música** (una pieza de violín con licencia libre) en lugar de ambientes sintetizados por sueño, y la mezcla baja ~8 dB. Ver sección 2.

---

## 0. Cómo usar este plan (instrucciones para el agente)

1. **Leé este plan completo**, después la sección 1.2 de `Docs/FUTURO.md` y los tres documentos anteriores donde este plan no dice nada: `Docs/PLAN.md` (tokens, capturas, melts), `Docs/PLAN-2.md` (compuerta, stores de juego, escenas) y `DECISIONS.md`. Después leé:
   - `src/App.jsx`, `src/night/stage.js`, `src/night/play.js`, `src/night/recording.js`, `src/night/config.js`.
   - `src/components/Hud/Hud.jsx` y `src/components/ScrollSections/ScrollSections.jsx`.
   - `src/sound/` (lo que construyó la fase 0).
   - La escena de cada sección antes de ponerle sonido.
2. **Trabajá por fases (sección 7), en orden.** No empieces la siguiente hasta que el usuario haya escuchado y aprobado la anterior.
3. **Branches:** cada fase sale de `develop` una vez mergeada la anterior: `snd-phase-0-engine`, `snd-phase-1-tape`, etc. Commits chicos. No pushees a `main`.
4. **Al terminar cada fase:** `pnpm lint`, `pnpm build`, `pnpm test`, verificá los criterios en el navegador, medí los niveles con el panel de debug (3.8) y escribí un resumen corto con lo que el usuario tiene que escuchar y dónde. Dejale el servidor de desarrollo corriendo si lo pide.
5. **Vos no podés escuchar.** El criterio final de cada fase es **el oído del usuario**. Lo tuyo es que suene lo que dice el plan, en los niveles del plan (sección 6), sin clics ni cortes (verificable con el analizador) y sin errores. Anotá en `DECISIONS.md` lo que el usuario pidió cambiar.
6. **Si una decisión no está acá y cambia lo que se oye, lo que se ve o la arquitectura, preguntá.** Para detalles menores, elegí lo más simple y anotalo en `DECISIONS.md` bajo `## Sound — Phase N`.
7. **Nada de dependencias nuevas.** Web Audio y `<audio>` son nativos. Ningún archivo de audio entra sin que el usuario lo elija (2.2).
8. **Lo que ya funciona no se rompe:** con el sonido apagado, la web se comporta **exactamente igual que hoy**. Lighthouse sobre el sitio desplegado: mobile ≥ 80 (hoy 83), desktop 99, y 100 en Accessibility, Best Practices y SEO. También reduced motion, el fallback sin WebGL2 y el desvío del manual.

---

## 1. Concepto

La DR-1 es una grabadora: **ahora se la escucha grabar, y lo que suena es lo que hay en la cinta.**

1. **La música es la cinta.** Una pieza de violín, oscura y clásica, suena **solo mientras la DR-1 graba** (`hud.state === 'rec'`): arranca con el motor al dormirte, se frena como una cinta cuando el motor para (el manual, el STOP de Wake) y retoma desde donde quedó. `REPLAY THE NIGHT` la rebobina.
2. **La máquina se escucha debajo:** el hiss de la cinta y el motor, casi inaudibles.
3. **El melt dobla la música como una cinta estirada**, y se intensifica igual que la imagen a lo largo de la noche.
4. **Los sueños responden con pocos sonidos puntuales** (el canto de la ballena, una puerta, el agua sobre tu cabeza, la alarma), no con ambientes propios.
5. **Opt-in y bajo.** Apagado por defecto. Encendido, es un fondo: nunca tapa.
6. **Ninguna información depende del sonido.** Todo lo que suena ya se ve. Quien no activa el sonido no se pierde nada.

---

## 2. Decisiones tomadas

Vienen de `Docs/FUTURO.md` 1.2 y de la revisión de la fase 0 (usuario, 2026-09-26). No las reabras sin preguntar.

| Tema | Decisión |
| --- | --- |
| Fondo | **Música:** una pieza de violín (clásica, oscura) con licencia libre, de fondo durante la grabación. **Reemplaza los ambientes sintetizados por sueño** del plan original. |
| Capa de la DR-1 | **Sintetizada:** hiss, motor, wow del melt, STOP y eject, clic de fragmento, botones, rebobinado. |
| Sonidos de los sueños | **Solo puntuales** y ligados a una interacción (5). |
| Toggle | Botón `SOUND OFF` / `SOUND ON` en el HUD, siempre visible, **apagado por defecto** (hecho en la fase 0). |
| Volumen | **Sin control propio.** La mezcla baja ~8 dB respecto del plan original (6); el volumen del sistema hace el resto. |
| Preferencia | **No se guarda.** Cada visita arranca sin sonido. |
| Clic por carácter en los logs | **No.** Cansa rápido. La impresión de Wake es la única excepción. |

### 2.1 Qué se considera "sintetizado"

Todo sonido generado en el navegador con nodos de Web Audio: osciladores, buffers de ruido generados por código, filtros, envolventes y modulación. Cero archivos de audio. Es el origen de todo lo que no es la música.

### 2.2 La música: licencia y elección

- **La obra puede ser de dominio público (Bach, Paganini, Tartini, Vivaldi…), pero la grabación tiene sus propios derechos.** Solo entran grabaciones con una licencia que permita usarla en la web sin pagar ni pedir permiso:
  - **CC0 / dominio público** (preferidas: sin obligación de atribución), por ejemplo las grabaciones de dominio público de Musopen o Free Music Archive filtrando CC0;
  - **CC BY** (con atribución visible en el README y en `CREDITS.md`);
  - **Pixabay Content License** (libre de regalías).
  - **No:** CC BY-NC o BY-ND si hay dudas sobre el uso (NC en un portfolio es discutible), ni "sin copyright" de YouTube sin licencia escrita.
- **Cómo se elige:** el agente propone **3 candidatos** con link, intérprete, licencia (con captura o cita del texto de la licencia en su página) y duración; el usuario escucha y elige. Es el primer paso de la fase 1.
- **Carácter buscado:** violín solo o con poco acompañamiento, lento, oscuro, sin golpes ni crescendos bruscos (va de fondo y se dobla en cada melt). Ejemplos de obras para buscar: la *Chacona* o una *Sarabanda* de Bach, un *Largo* o un *Adagio* barroco.
- **El archivo:** `public/sound/night.ogg` (Opus o Vorbis, mono o estéreo a ~96 kbps, **≤ 3 MB**), más `night.m4a` (AAC) si Safari no reproduce el `.ogg`. Normalizado a −16 LUFS integrados, recortado para que el loop no salte (2.3). Registrado en `CREDITS.md` (obra, compositor, intérprete, fuente, licencia, link).
- **Carga:** solo al activar el sonido, nunca antes. Lighthouse no la ve.

### 2.3 El loop

Una noche jugada dura entre 3 y 10 minutos; la pieza, probablemente menos. Se repite:
- con **dos elementos `<audio>` alternados** y un crossfade de 3 s en el punto de loop, en vez de `loop` (que en algunos navegadores deja un hueco audible);
- el punto de loop se elige en el archivo al recortarlo (una frase que cierra), no al final crudo.

### 2.4 Cuándo un sonido pasa a archivo (CC0)

Para los sonidos puntuales (5), igual que antes: solo si el usuario, después de escuchar la versión sintetizada, dice que no convence. El agente propone 2 o 3 candidatos con link y licencia, el usuario elige, y el archivo va a `public/sound/` (mono, ≤ 30 s, ≤ 250 KB, cargado al activar el sonido) y a `CREDITS.md`.

---

## 3. Arquitectura

```
src/
  sound/                     ← motor genérico, no sabe nada de sueños
    bus.js                   ← en el primer chunk (tiny): on/off, cue(), param()      [fase 0 ✔]
    engine.js                ← lazy: AudioContext, grafo, capas, ciclo de vida         [fase 0 ✔]
    synth.js                 ← lazy: primitivas (ruido, osciladores, envolventes, wow) [fase 0 ✔]
    tape.js                  ← NUEVO, lazy: la música como cinta (play, stop de cinta, loop, rebobinado)
    meter.worklet.js         ← solo dev: medidores y detector de clics                 [fase 0 ✔]
  night/
    score.js                 ← NUEVO, lazy: qué suena en cada sección (el "guion sonoro")
  components/
    SoundToggle/             ← el botón, en el HUD                                     [fase 0 ✔]
    ScrollSections/          ← activeTransition suma { kind, duration, intensity } (3.4)
    DebugPanel/              ← medidores por capa (3.8)                                [fase 0 ✔]
```

### 3.1 `sound/bus.js`: lo único que va en el primer chunk

Un store externo mínimo, sin React:

```js
isOn()                       // boolean
subscribe(listener)          // SoundToggle lo usa con useSyncExternalStore
toggle()                     // enciende o apaga (ver 3.2)
cue(name, params?)           // un sonido puntual: 'door', 'whale-call', …
param(name, value)           // un valor continuo: 'ocean.under', 'house.stretch', …
```

- **Con el sonido apagado, `cue` y `param` retornan en la primera línea.** Las escenas pueden llamarlos cada frame sin costo.
- `param` solo guarda el último valor; el motor lo lee cuando lo necesita.
- Medido en la fase 0: el primer chunk creció 0.38 KB gzip (bus + toggle).

### 3.2 Encender y apagar

- **Encender** (click en el toggle): el `AudioContext` se crea y se reanuda **sincrónicamente dentro del click** (Safari lo exige), después se importa el motor, y el master entra con un fade de 1 s. Hecho en la fase 0.
- **La música también necesita el gesto** en Safari iOS: en ese mismo click, **desbloquear los elementos `<audio>`** (`play()` seguido de `pause()` en silencio) aunque la música todavía no deba sonar (en el hero no suena). Verificarlo en Safari cuando haya dispositivo.
- **Apagar:** fade-out de 0.3 s, `ctx.suspend()` y **pausa de la música** (conserva su posición). Volver a encender retoma.
- **Pestaña oculta:** lo mismo que apagar (la música se pausa: si no, seguiría avanzando en silencio); al volver, retoma con fade de 0.3 s si estaba encendido.
- **Sin persistencia:** recargar arranca apagado.

### 3.3 El grafo

```
música (<audio> → MediaElementSource) ─┐
capa global (hiss, motor) ─────────────┼─→ wow (melt) ─→ bajo el agua ─→ master ─→ limitador ─→ destino
puntuales de escena (cue) ─────────────┘                                    ↑
                                                         puntuales de interfaz (sin wow)
```

- **La música entra como `MediaElementSource`**, no con `decodeAudioData`: una pieza de 3 minutos decodificada ocupa ~35–70 MB de memoria, mucho para un teléfono; el elemento `<audio>` la lee en streaming.
- **Capas del motor:** la de la fase 0 llamada `ambience` pasa a ser `music`. Quedan `global`, `music`, `scene` y `ui`.
- **Wow:** un `DelayNode` modulado por un LFO (vibrato por modulación del tiempo de retardo) = el pitch que se dobla de la cinta. Ver 4.3.
- **Bajo el agua:** un pasa-bajos sobre todo lo que tiene wow, abierto (sin efecto) salvo en Ocean (5.5).
- **Limitador:** red de seguridad, no parte del sonido.
- **Todo cambio de ganancia o de filtro usa rampas** que arrancan desde el valor actual (`synth.rampTo` / `glideTo`). Nunca `cancelAndHoldAtTime` (salta en Chrome, `DECISIONS · Sound — Phase 0`) ni asignar `.value` sobre algo que suena.

### 3.4 Señales: de dónde sale cada sonido

| Señal | Hoy | Para qué |
| --- | --- | --- |
| Estado de la DR-1 | `NIGHT[i].hud.state` (`standby`, `rec`, `stop`) en `config.js` | Si la cinta gira: música y motor |
| Sección actual y asentada | `night/stage.js` (`currentId`, `settled`) | Qué puntuales escuchan; el STOP de Wake |
| Transición | `onStateChange` → `activeTransition { from, to }` | Wow y silencio del burn |
| Progreso / beat | `night/play.js` (`subscribeTarget`, `getPlay`) | La alarma de Fall |
| Eventos | `play.trigger` / `play.act` | Reacciones (`wave`, `action`) |
| Fragmento guardado | `night/recording.js` (`keep`) | El clic de cinta |
| Lo que solo sabe la escena | `bus.cue` / `bus.param` desde la escena | Puertas, cocina, agua, ballena |

**Cambio en `ScrollSections` (genérico, sin saber de sonido):** `activeTransition` pasa de `{ from, to }` a `{ from, to, kind: 'melt' | 'plain', duration, intensity }`, con los valores que el motor **ya resolvió** para esa transición (la regla del `Math.max` para pasos contiguos y la del destino para saltos, `DECISIONS · Phase 1`). `intensity` es la del melt (0.45 a 1.25 en `config.js`); en un crossfade, 0. Así el sonido no duplica esa regla.

**Cambios en las escenas:** una o dos líneas cada una, donde ya pasa lo que suena (5).

### 3.5 `night/score.js`: el guion sonoro

Separado del motor, como `dreams.js` está separado de la lógica: qué puntuales tiene cada sección, sus niveles y cómo se mapea cada `param`. Retocar un sonido no toca el motor.

### 3.6 El toggle: `SoundToggle` (hecho en la fase 0)

Botón real con nombre "Sound" y `aria-pressed`, en la esquina superior izquierda del HUD: debajo de `DR-1` en pantallas anchas, al lado en angostas o verticales. 44 px táctiles sin agrandar la esquina, sigue el tema del manual, y el hero sigue midiendo el DR-1 contra las dos esquinas superiores. Detalle en `DECISIONS · Sound — Phase 0`.

### 3.7 Reduced motion, sin WebGL2 e iOS

- **Reduced motion:** el sonido es el mismo, salvo el **wow del melt** (sin wow, la música sigue lisa) y la impresora de Wake (sin tics, porque el registro aparece completo).
- **Sin WebGL2:** no hay escenas, así que no hay puntuales de escena. La música, la cinta y los puntuales globales funcionan igual.
- **iOS:** Web Audio y la música respetan el interruptor de silencio del iPhone. No es verificable hasta tener dispositivos (quedó para más adelante en `FUTURO.md`). Anotarlo en el README.

### 3.8 Panel de debug (solo dev, `?debug`)

Hecho en la fase 0: estado del contexto, medidores por capa y del master (RMS y pico en dBFS, AudioWorklet), reducción del limitador y contador de clics. En cada fase se suman:
- un botón por `cue` de la sección actual y un deslizador por `param`;
- para la música (fase 1): posición, estado (`playing`, `stopped`, `stopping`), y botones para forzar el stop de cinta, el arranque y el rebobinado.

---

## 4. La cinta: música y máquina

### 4.1 La música

- **Suena mientras la DR-1 graba** (`hud.state === 'rec'`: los cinco sueños).
- **Arranque** (entrar a `rec`: BEGIN RECORDING, o volver del manual): la cinta arranca como un motor, `playbackRate` de 0.6 a 1 en 0.6 s con `preservesPitch = false` (el pitch sube con la velocidad) y un fade-in de la misma duración.
- **Stop de cinta** (salir de `rec`: al manual, al STOP de Wake): `playbackRate` de 1 a ~0.25 en 0.8 s (el pitch cae como una cinta que se frena) con fade-out, después `pause()`. **Conserva la posición:** al volver a grabar retoma desde ahí.
- `playbackRate` no es un `AudioParam`: se actualiza por frame (`requestAnimationFrame`) durante el arranque y el stop, y se mide con el panel que no deje clics.
- **`REPLAY THE NIGHT`:** rebobina (4.4) y la música vuelve al principio.
- **El hero y el manual no tienen música** (standby). Ver 5.4 sobre el manual.

### 4.2 La máquina

- **Hiss de cinta:** ruido rosa, pasa-altos ~3 kHz, pasa-bajos ~9 kHz, casi inaudible, solo mientras la cinta gira.
- **Motor:** un zumbido grave (~55 Hz más dos armónicos, pasa-bajos) con una fluctuación lenta de pitch (±0.3%, 0.5 Hz), **debajo de la música**; arranca y se frena con ella (mismas curvas que 4.1).
- **Standby** (hero y manual): un zumbido eléctrico muy tenue (100 Hz, casi inaudible).

### 4.3 El melt suena a cinta estirada

- Durante una transición `kind: 'melt'`, **el wow** dobla el pitch de la música, del motor y de los puntuales de escena: la profundidad del LFO sigue la misma envolvente que el melt (sube hasta la mitad, baja al final), con `duration` de `activeTransition`.
- **Se intensifica con la noche:** profundidad y velocidad del wow escalan con `intensity` (0.45 en el primer melt, 1.25 en el último).
- **Transición 7 (Fall → Wake, `burn`):** en el quemado a blanco la cinta **se frena de golpe** (el stop de 4.1 en 0.4 s) y todo baja a silencio en la mitad del melt; Wake entra desde el silencio con el STOP (4.5).
- **Crossfades (`kind: 'plain'`: manual, saltos, sin WebGL2):** sin wow.
- **Reduced motion:** sin wow.

### 4.4 Puntuales globales

- **Fragmento guardado** (`recording.keep`): un clic de cinta (dos transitorios cortos, como una tecla mecánica). Coincide con el parpadeo `rec` del segmento de lucidez.
- **Botones** (`onk-btn`, incluido `DreamAction`): un clic de tecla sordo, muy bajo, al activarse. **No** en hover.
- **`REPLAY THE NIGHT`:** un rebobinado corto (ruido que sube de pitch rápido, 0.8 s), durante el crossfade al hero.

### 4.5 Wake: STOP y eject

- Al llegar a Wake (`hud.state === 'stop'`): la cinta ya se frenó en el burn (4.3); suena el **clack** de STOP (ruido filtrado + un transitorio grave) y, 0.4 s después, el **eject** (un clack más largo con un resorte: un tono corto que baja). Después, silencio y la impresora (5.7).

---

## 5. Sueños: los puntuales

Con la música de fondo, cada sueño suma **pocos sonidos, solo ligados a lo que hacés o a lo que la escena hace por su cuenta**. Formato: **qué suena**, **señal**, **técnica** (punto de partida), **terminado cuando**. Todo es borrador hasta que el usuario lo escuche; cualquiera puede sacarse si sobra con la música.

### 5.1 Dream 01: The Staircase

- **Qué suena:** **pasos lentos**, uno cada `T_STEP` (2 s), cuando cada pie se apoya; paran al detenerte y vuelven más rápidos al soltar. **A confirmar de oído:** con la música pueden sobrar.
- **Señal:** `cue('step', { foot, cadence })` desde `StairScene.jsx`, donde el ciclo de caminata (`climb.current.u`) cruza el apoyo de un pie.
- **Técnica:** ruido corto filtrado (pasa-banda ~300 Hz) + un transitorio grave, con ±10% de variación en pitch y nivel; un eco de piedra sintético (reverb generado). **Candidato a CC0** si no convence.
- **Terminado cuando:** los pasos caen en el mismo frame que el apoyo, paran al detenerte y nunca se superponen.

### 5.2 Dream 02: The Whale Above the City

- **Qué suena:** un **canto de ballena** al saludar: el primero completo (dos o tres tonos graves que se deslizan entre ~80 y ~300 Hz, con vibrato lento y formantes), los siguientes un solo tono corto.
- **Señal:** `cue('whale-call', { full })` desde `WhaleScene.jsx`, donde arranca cada reacción (el evento `wave` ocurre una sola vez por noche, así que el canto corto necesita el `cue`).
- **Terminado cuando:** el primer saludo da el canto completo y los siguientes el corto; mover el mouse normalmente no suena.

### 5.3 Dream 03: The House You Grew Up In

- **Qué suena:**
  - **una puerta que se abre:** un crujido (ruido con resonancias que se mueven); las espontáneas, más lejos y más bajas;
  - **la cocina se aleja** (el estiramiento): **la música se aleja con ella** (pasa-bajos y más reverb) en 0.8 s y vuelve en 6 s, con la misma curva que la imagen.
- **Señal:** `cue('door', { x, z, spontaneous })` y `param('house.stretch', 0→6)` desde `HouseScene.jsx`.
- **Terminado cuando:** cada puerta cruje, la música se aleja y vuelve con la cocina, y con 10 sombras en escena no hay saturación ni clics.

### 5.4 Manual

- **Propuesta (a confirmar):** es el momento despierto y la DR-1 está en standby, así que **la cinta se frena al entrar** (4.1) y el manual queda en silencio, con el zumbido de standby. Al volver a un sueño, la música retoma desde donde quedó.

### 5.5 Dream 04: The Ocean Indoors

- **Qué suena:**
  - **cada beat**, un golpe de agua sordo al subir el nivel;
  - **bajo el agua (beat 3): la música, el motor y los puntuales quedan sordos** (el pasa-bajos del grafo, ~400 Hz), como oídos bajo el agua; burbujas cuando se mueve el puntero (tonos cortos que suben, con pasa-banda).
- **Señal:** `param('ocean.under', 0→1)` desde `OceanScene.jsx` con la función `underBy(level)` que ya existe, así el sonido cruza la superficie exactamente cuando la cámara; `cue('beat')`, `cue('bubble')`.
- **Terminado cuando:** el pasa-bajos sigue exactamente el cruce de la superficie en las dos direcciones y se deshace al salir del sueño.

### 5.6 Dream 05: The Fall

- **Qué suena:**
  - **la alarma:** pitidos cortos en un tono agudo (seno + un armónico), al **mismo ritmo que el punto REC del HUD**: el período baja de 1.2 s a 0.3 s con el scrub (`hud.recTo`), encima de la música;
  - un "whoosh" breve cuando la cámara atraviesa un anillo;
  - en el quemado a blanco, **la cinta se frena y silencio** (4.3).
- **Señal:** progreso del scrub (`subscribeTarget`), el cálculo de período del REC que usa el HUD (extraerlo a una función compartida en vez de duplicarlo), `cue('ring')` desde `FallScene.jsx`.
- **Terminado cuando:** los pitidos van en fase con el REC del HUD y el melt a Wake cae a silencio en el blanco.

### 5.7 Wake

- **Qué suena:** STOP y eject (4.5); **la impresora:** un tic por carácter impreso (transitorio muy corto y agudo, bajo), más grave para los encabezados, y un "avance de línea" entre filas; `SAVE THE TAPE` con el clic de botón y `REPLAY` con el rebobinado (4.4).
- **Señal:** `cue('print', { head })` desde el loop de impresión de `Wake.jsx`.
- **Con reduced motion** el registro aparece completo: sin tics.
- **Terminado cuando:** cada llegada a Wake da STOP, eject y la impresión con sus tics.

---

## 6. Mezcla: niveles de partida

~8 dB más bajos que el plan original, después de escuchar la fase 0 (el zumbido de prueba a −28 dB RMS en el master sonaba alto). Puntos de partida, a ajustar de oído y anotar en `DECISIONS.md`. Medidos con el panel (3.8), en dBFS.

| Capa | RMS objetivo | Pico máximo |
| --- | --- | --- |
| Master | −32 a −28 | −14 |
| Música | −38 a −34 | −20 |
| Hiss de cinta | −56 | — |
| Motor | −50 | — |
| Puntuales de escena (pasos, puertas, ballena, agua) | — | −22 |
| Puntuales de interfaz (botones, fragmento) | — | −28 |
| Alarma de Fall en su punto más alto | — | −20 |

- **El limitador no debería actuar** en uso normal.
- **Ningún sonido nuevo se agrega sin medir** el master con el peor caso de su sección.

---

## 7. Fases

Cada fase termina con `pnpm lint`, `pnpm build` y `pnpm test` limpios, sin errores ni advertencias en consola, los criterios cumplidos y **la aprobación de oído del usuario**. Como los sueños ahora suman pocos sonidos cada uno, van de a dos por fase.

### Fase 0: Motor y toggle ✔

Hecha en `snd-phase-0-engine`: bus, motor, primitivas, toggle, ciclo de vida y panel con medidores. Ver `DECISIONS · Sound — Phase 0`. Pendiente de esa fase por la revisión: bajar el tono y el zumbido de prueba a los niveles nuevos (6) — hecho — y renombrar la capa `ambience` a `music` (en la fase 1, cuando la música exista).

### Fase 1: La cinta (música + máquina)

1. **Elegir la música** (2.2): 3 candidatos con licencia verificable; el usuario elige. Recortarla, normalizarla, `CREDITS.md`.
2. `sound/tape.js`: los dos `<audio>` alternados y el loop (2.3), el desbloqueo en el click (3.2), arranque, stop de cinta y rebobinado (4.1).
3. La máquina (4.2), el wow del melt y el silencio del burn (4.3), los puntuales globales (4.4), STOP y eject (4.5).
4. El cambio de `activeTransition` en `ScrollSections` (3.4).
- **Terminado cuando:** recorriendo la noche entera, la música arranca con BEGIN RECORDING, se frena como cinta al entrar al manual y retoma desde el mismo punto al volver, se dobla más fuerte en cada melt, se corta en el blanco antes de Wake, y Wake da STOP + eject; REPLAY la rebobina; el loop no se nota; ocultar la pestaña la pausa; niveles dentro de la tabla 6; sin clics en el panel; Lighthouse igual que `develop`.

### Fase 2: Staircase + Whale (5.1, 5.2)

### Fase 3: House + Ocean (5.3, 5.5)

### Fase 4: Fall + Wake (5.6, 5.7)

Para las fases 2 a 4: **terminado cuando** se cumple el "terminado cuando" de cada sección, los niveles están dentro de la tabla 6 en el peor caso, y el usuario aprobó el sonido. Si un puntual pasa a archivo (2.4), se resuelve dentro de su fase.

### Fase 5: Manual, mezcla final y cierre

- **Manual:** confirmar con el usuario (5.4) y hacerlo.
- **Pasada de mezcla** de la noche entera, de corrido, con el usuario.
- `README.md`: cómo funciona el sonido (bus, motor, cinta, guion), cómo agregarle un puntual a una sección, la música y su licencia, y la nota de iOS.
- Checklist de la sección 8.
- **Terminado cuando:** el checklist está completo y Lighthouse sobre el sitio desplegado sigue en mobile ≥ 80 y 100 en el resto.

---

## 8. Checklist de QA

- [ ] Con el sonido apagado, la noche es idéntica a la de `develop` (navegación, capturas, rendimiento) y la música no se descarga.
- [ ] Encender no suena de golpe (fade-in); apagar y encender no dejan clics.
- [ ] Ocultar la pestaña silencia y pausa la música; volver retoma, solo si estaba encendido.
- [ ] Recargar arranca apagado.
- [ ] La música suena solo mientras la DR-1 graba, se frena como cinta y retoma donde quedó.
- [ ] El loop de la música no se nota.
- [ ] Cada melt dobla la música y más fuerte a medida que avanza la noche; los crossfades, no.
- [ ] El blanco antes de Wake es silencio.
- [ ] Cada sueño suena según su sección 5, y en el peor caso los niveles están dentro de la tabla 6.
- [ ] Reduced motion: sin wow, sin tics de impresora; todo lo demás suena.
- [ ] Sin WebGL2: música, cinta y puntuales globales, sin errores.
- [ ] El toggle es accesible (teclado, lector de pantalla, 44 px en touch) y no tapa nada en 390 px.
- [ ] `CREDITS.md` y el README tienen la música con su licencia.
- [ ] Sin errores ni advertencias en consola, con y sin sonido.
- [ ] Lighthouse desplegado: mobile ≥ 80, desktop sin bajar, 100 en Accessibility, Best Practices y SEO.

---

## 9. Riesgos conocidos

| Riesgo | Mitigación |
| --- | --- |
| El agente no puede escuchar | Panel con medidores y detector de clics (3.8), niveles objetivo (6) y aprobación del usuario por fase. |
| Una grabación "sin copyright" que no lo es | Solo licencias verificables (2.2), con el texto de la licencia citado al proponerla y registrado en `CREDITS.md`. |
| La música pesa y gasta datos en el teléfono | ≤ 3 MB, streaming con `<audio>`, se descarga solo al activar el sonido. |
| El loop se nota a los pocos minutos | Punto de loop elegido en una frase que cierra y crossfade de 3 s entre dos elementos (2.3). |
| Safari iOS no reproduce la música aunque el contexto esté activo | Desbloquear los `<audio>` dentro del click del toggle (3.2); verificar cuando haya dispositivo. |
| El stop de cinta con `playbackRate` por frame suena escalonado | Actualización por `requestAnimationFrame` más un fade que lo tapa; medirlo con el panel y ajustar de oído. |
| Cansa: la misma pieza toda la noche | Nivel bajo, el manual en silencio como respiro, el wow de cada melt la transforma; si aun así cansa, evaluar una segunda pieza en la pasada final (fase 5). |
| Clics al cambiar ganancias o filtros | Solo rampas desde el valor actual (3.3); el detector de clics del panel. |
| iOS: el interruptor de silencio lo apaga | Documentado; no verificable hasta tener dispositivos. |
| El sonido suma peso al primer chunk | Solo `bus.js` y el toggle van en el primer chunk; todo lo demás es lazy (3.1). |
| Los pasos o la alarma se desfasan de la imagen | Los dispara la escena en el mismo frame (`cue`); la alarma usa el mismo cálculo que el REC. |

---

## 10. Fuera de alcance

- Guardar la preferencia de sonido entre visitas (decidido que no, 2).
- Control de volumen (decidido que no: se baja la mezcla, 2).
- Ambientes sintetizados por sueño (reemplazados por la música, 2).
- Una pieza distinta por sueño (se evalúa solo si una sola cansa, fase 5).
- Audio espacial con HRTF (el paneo estéreo simple alcanza).
- Sonido en *Save the tape* o en el póster.

---

## 11. Decisiones abiertas

Se preguntan al usuario cuando llegue su fase:

1. **La pieza de música** (fase 1): entre 3 candidatos con licencia.
2. **Manual** (fase 5): la propuesta es silencio con la cinta frenada (5.4).
3. **Pasos en la escalera** (fase 2): si suman o sobran con la música.
4. **Cada puntual candidato a archivo** (pasos, agua): después de escuchar la versión sintetizada.
