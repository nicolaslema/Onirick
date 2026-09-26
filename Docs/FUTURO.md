# FUTURO.md — Onirick: lo que quedó para después

> Backlog de lo que **no entró** en `Docs/PLAN-2.md` (fases 0–9, cerradas) y de lo que `DECISIONS.md` dejó abierto al cerrar cada fase. No es un plan todavía: es la lista de la que va a salir el próximo (`PLAN-3.md`).
> Idioma: español. **Todo el texto visible de la web sigue en inglés.**
> Cada ítem dice de dónde sale (`PLAN-2 §N` o `DECISIONS · Fase`), para poder leer el contexto original antes de reabrirlo.

---

## 0. Cómo leer este documento

- **Sección 1**: ideas nuevas que el plan 2 decidió postergar explícitamente (tabla de decisiones §2 y "Fuera de alcance" §12). Son features.
- **Sección 2**: lo que se construyó pero **no se pudo verificar** (dispositivos reales, navegadores, ajuste fino). Son deudas de QA del plan 2, no features nuevas.
- **Sección 3**: rendimiento y deploy.
- **Sección 4**: deuda técnica menor anotada en `DECISIONS.md`.
- **Sección 5**: lo que **no** hay que reabrir (descartado o decidido con el usuario), para no volver a proponerlo.
- **Sección 6**: un orden sugerido.

Las decisiones de `PLAN-2 §13` siguen valiendo. Si alguno de estos ítems las contradice (por ejemplo, lucidez con efecto en las escenas, 13.4), hay que preguntar antes.

---

## 1. Features postergadas

### 1.1 Narrativa definitiva (prerrequisito de casi todo lo demás)

- **El copy del plan 2 es borrador aceptado** (`PLAN-2 §13.3`): frases por beat y progreso, etiquetas de fragmento, pistas, líneas de lucidez de Wake. Está concentrado en `src/night/dreams.js` y `src/night/Wake/Wake.jsx` para retocarlo sin tocar lógica.
- **Una frase ya quedó desfasada:** el log de la escalera dice *"Every landing has the same window, and the same moon in it."*, pero las ventanas ahora son marcos vacíos y la única luna es la que orbita (`DECISIONS · Night 2 — Phase 3, after review`). La frase se puede leer como "la misma luna vista a través de ellas", pero conviene revisarla en la pasada de narrativa.
- La **segunda noche** (1.2) depende de que esta narrativa esté fija.

### 1.2 Segunda noche distinta

`PLAN-2 §2` (Después) y `§12`.

- `recording.js` guarda cuántas noches grabaste, en `localStorage` (hoy la grabación vive **solo en memoria** y recargar empieza de cero, `PLAN-2 §3.5`; la segunda noche necesita persistir **solo el contador de noches**, no los fragmentos, para no romper lo que se decidió en la fase 4 de que cada reacción se pueda volver a ver).
- Los sueños cambian de forma fiel al original. Ejemplos del plan: la ballena no está (*"Neither was the whale"*), la casa tiene una puerta nueva, el HUD dice `NIGHT 02`.
- Hoy `REPLAY THE NIGHT` hace `recording.reset()`: cada noche es una grabación nueva sin memoria de la anterior (`PLAN-2 §3.5`). Hay que decidir si Replay cuenta como "segunda noche" o solo una visita nueva.
- Posible punto de encuentro con 1.7 (lucidez con efecto).

### 1.3 Sonido opt-in

`PLAN-2 §2` (Después) y `§12`.

- Toggle en el HUD, **apagado por defecto**.
- Fuentes propuestas:
  - **Web Audio sintetizado, sin archivos** (recomendado para la mayor parte): hiss de cinta = ruido filtrado; alarma de Fall = oscilador con envolvente (podría seguir el mismo período que el REC, `hud.recTo`); agua = ruido con pasa-bajos.
  - **freesound.org** con licencia **CC0** para ambientes (agua, viento, habitación).
  - **Pixabay Sound Effects** y **Sonniss GDC Game Audio Bundle** (libres de regalías).
- Todo archivo usado va a un `CREDITS.md` con su licencia (hoy no existe porque todo el 3D es procedural, `DECISIONS · Phase 7`).
- Ojo con la regla `PLAN-2 §0.7` "nada de dependencias nuevas": Web Audio es nativo, así que entra sin romperla.

### 1.4 Manual interactivo

`PLAN-2 §2` (Después) y `§12`.

- Hover en la `SpecTable` resalta la pieza correspondiente en una **vista explotada del DR-1**.
- Botones `PLAY TAPE 0N` que saltan a cada sueño.
- Tener en cuenta que el manual hoy es un **desvío** (`detour: true`, `DECISIONS · After release`): saltar desde ahí a un sueño tiene que convivir con esa regla (¿un `PLAY TAPE` termina el desvío como Home/End?).
- Requiere un equivalente en tap para mobile (`PLAN-2 §5.6`: nada depende del hover).

### 1.5 Cursor propio

`PLAN-2 §2` (Después) y `§12`. Uno solo para toda la noche. A definir: si cambia por sueño o por estado (por ejemplo, en la escalera al mantener apretado), y cómo convive con el `pointer.js` window-wide y con reduced motion.

### 1.6 Distorsión del texto bajo el agua (Ocean)

`PLAN-2 §6.4` y `§12`. Un filtro SVG sobre el DOM del título y el log cuando la cámara está bajo la superficie. **Riesgo alto:** `modern-screenshot` puede no capturarlo igual, y el melt de salida mostraría el texto sin distorsión (o distinto). Probar la captura antes de construir nada.

### 1.7 Giroscopio para dirigir la caída en mobile

`PLAN-2 §12`. Nota: desde la revisión de la fase 7, **Fall ya no se dirige con el puntero** (se decidió que la caída se maneja sola porque scrollear y apuntar a la vez era incómodo, `DECISIONS · Night 2 — Phase 7`). Si vuelve el giroscopio, tiene que ser un matiz sobre el recorrido automático, no volver a pedir control. Requiere permiso en iOS (`DeviceOrientationEvent.requestPermission`) y un toggle.

### 1.8 Lucidez con efecto en las escenas o en el melt

`PLAN-2 §12`. **Hoy decidido que no** (`PLAN-2 §13.4`): cambiar niebla o melt contradiría que la noche se intensifica. Solo reabrir junto con la segunda noche, y preguntando.

---

## 2. Verificación pendiente (deuda de QA del plan 2)

Todo el QA del plan 2 se hizo en **Chrome** (headless con GPU, escritorio y 390px). La fase 9 pedía el checklist de `PLAN-2 §10` también en Safari, Firefox, Safari iOS y Chrome Android, y quedó sin hacer por falta de dispositivos (`DECISIONS · Night 2 — Phase 9`, `Phase 7`).

### 2.1 Navegadores y dispositivos reales

- [ ] Checklist de `PLAN-2 §10` en **Safari desktop**, **Firefox desktop**, **Safari iOS** y **Chrome Android**.
- [ ] Checklist de `PLAN.md §9` (noche 1) en los mismos.
- Lo más probable que falle, según lo anotado:
  - `backdrop-filter` en las bandas de `GradualBlur` en Safari (`PLAN.md`, tabla de riesgos).
  - Scroll nativo + bordes del swipe dentro del manual en iOS (`DECISIONS · Phase 4`).
  - Disponibilidad y rendimiento de WebGL2 en teléfonos de gama media.
  - Mantener apretado vs. swipe del scrub en la escalera con un dedo real (solo probado con eventos touch sintéticos, `DECISIONS · Night 2 — Phase 3`).
  - El saludo con el dedo en la ballena en hardware táctil real (`DECISIONS · Night 2 — Phase 4`).
  - La hoja de compartir de *Save the tape* en un teléfono real (`PLAN-2 §7.1`: en desktop se verificó la descarga).

### 2.2 Ajuste fino en dispositivo

`PLAN-2 §0.6`: los números del plan son **puntos de partida**. La fase 9 pedía ajustarlos en un teléfono y anotarlos; quedó pendiente (`DECISIONS · Night 2 — Phase 9`).

| Qué | Valor actual | Dónde se anotó |
| --- | --- | --- |
| Detector de saludo (inversiones, ventana, `minAmp`) | 3 / 1500 ms / 0.06 NDC (sacudida ≈ 12% del ancho) | Phase 0, Phase 4 |
| Mantener apretado | 250 ms, 10 px | Phase 3 |
| Fragmento de la escalera | 5 s detenido; *Stop climbing* 5.5 s | Phase 6, after review |
| Fragmento de la casa | 5 s tras salir una sombra propia | Phase 6, after review |
| Fragmento del océano | 6 s bajo el agua | Phase 6 |
| `beatDuration` de Ocean | 1.6 s | PLAN-2 §8 |
| `length` de los scrubs | 2700 px | PLAN-2 §8 |
| `TOUCH_SCRUB_GAIN` | 2.5 | Phase 1 |
| Tramo de soltarse en Fall | 0.4 → 0.72 (lleno 0.5–0.62) | Phase 7, after review |
| Pérdida de control en Fall | desde 0.75, 4 s (k²) | Phase 7, after review |
| Puertas espontáneas en House | cada 7–12 s | Phase 5 |
| Niebla y luces (luna, lámpara, onda de luz de la ciudad, luz de abajo en Fall) | ver cada fase | Phases 3–7 |
| Riesgo de que la compuerta se sienta "trabada" | — | PLAN-2 §11: si pesa, bajar `length` antes de sumar indicadores |

### 2.3 Otras verificaciones sueltas

- [ ] **Sombras de la escalera en una laptop con iGPU y en un teléfono.** Solo se midió en una RTX 5080 (144 fps). El respaldo (apagar sombras en pantallas chicas) es "una línea" y no se activó (`DECISIONS · Night 2 — Phase 3`).
- [ ] **Un click en un botón nunca abre una puerta** en House: garantizado por construcción (`onTap` ignora destinos interactivos), pero no observable desde el test sin exponer estado (`DECISIONS · Night 2 — Phase 5`).
- [ ] **Un frame de 42 ms en la ballena después de un saludo** (el resto de la noche, p95 7.1 ms). Investigar si es compilación de un shader o material que aparece recién ahí (la onda de luz, la figura del techo) y precalentarlo (`DECISIONS · Night 2 — Phase 9`).
- [ ] **Volver de Wake a Fall**: entrar a Fall hacia atrás lo deja en su final, y el recorrido de vuelta hasta 0 son varios gestos (`DECISIONS · Night 2 — Phase 1`). Es lo diseñado; conviene mirarlo en un teléfono para confirmar que no se siente trabado.

---

## 3. Rendimiento y deploy

- **Lighthouse mobile quedó en 79–80** (la regla del plan es ≥ 80; `DECISIONS · Night 2 — Phase 9`). Noche 1 midió lo mismo en la misma máquina y el mismo día, así que no es una regresión, pero el umbral no se cumple con margen. Pendiente:
  - [ ] **Remedir con PageSpeed Insights sobre el sitio desplegado** (la medición local usa `vite preview`).
  - [ ] **Primer frame de R3F**: compila juntos los shaders del hero y de la escalera (~200 ms sin throttling). Opciones: montar la vecina (escalera) un frame después, o precompilar con `gl.compile` en idle.
  - [ ] **Prueba de WebGL2 antes del FCP** (`lib/webgl.js` pide un contexto real): moverla después del primer paint si se puede sin romper el loader.
  - Apagar las sombras de la escalera **no** cambió nada medible: no es por ahí.
  - LCP 4.0 s es el heading del hero, que pinta cuando se levanta el loader; se mantuvo a propósito (`PLAN.md §5.2`, `DECISIONS · Phase 6`).
- **`og:image` sigue relativo** (`/posters/hero.webp` en `index.html`). Pasarlo a absoluto con el dominio de Vercel (el README dice dónde) — `DECISIONS · Phase 6/7`.
- **Header `charset`**: la nota de Lighthouse viene de `vite preview`; confirmar que Vercel lo manda (`DECISIONS · Phase 6`, `Night 2 — Phase 9`).
- **Consola:** los avisos de `THREE.Clock` se filtran en `three/console.js`. Cuando salga una versión de R3F que no use `THREE.Clock`, sacar el filtro (`DECISIONS · Phase 6`).

---

## 4. Deuda técnica menor

- **Títulos repetidos en tres lugares**: `src/night/config.js` (`tape`/`title`, para el anuncio del HUD), `src/night/dreams.js` (para el log de Wake y *Save the tape*) y cada `DreamX.jsx`. Unificarlos en `dreams.js` y que `config.js` los reexporte, cuidando el ciclo de imports `config.js` → secciones → escenas → `play.js` (`DECISIONS · Phase 1`, `Night 2 — Phase 0`, `Night 2 — Phase 8`). Conviene hacerlo **antes** de la pasada de narrativa (1.1), así un título se cambia en un solo lugar.
- **`src/legacy/`** sigue en el repo (`Proof.jsx` y compañía, de antes de la noche 1; `DECISIONS · Phase 4`). Decidir si se borra.
- **`activeTransition` sin `progress`** (`DECISIONS · Phase 1`): solo revisar si algo nuevo (sonido, 1.3, que podría querer seguir el melt) necesita el progreso cuadro a cuadro. Si hace falta, exponerlo como ref, no como estado de React.
- **Póster de Wake** hornea la etiqueta de la fecha en que se generó (`DECISIONS · Night 2 — Phase 9`). Solo se ve sin WebGL2, donde la cuenta es 0/5; si molesta, generar ese póster con la etiqueta vacía.
- **Estado de escena que se pierde al desmontar** (dónde quedó la figura de la escalera, qué puertas estaban abiertas en House). Decidido aceptable (`PLAN-2 §3.3`, `§13.5`); anotado por si la segunda noche lo necesita.

---

## 5. Lo que no hay que reabrir

Descartado o decidido con el usuario. Si alguno vuelve, preguntar primero.

- **Rebobinar en vez de derretir hacia atrás** — descartado: el melt se queda en las dos direcciones (`PLAN-2 §2`).
- **Baranda tibia en la escalera** — descartada, reemplazada por la figura y la luna (`PLAN-2 §2`).
- **Scrub de "caminar sin llegar" en House** — no; House queda libre y la cocina se estira con un click (`PLAN-2 §13.1`).
- **Glitches del transcript** — sacados en la fase 2: movían el título (`PLAN-2 §4.1`, `DECISIONS · Night 2 — Phase 2`).
- **Grabación persistida entre recargas** — no: recargar es una noche nueva, para que cada reacción se pueda volver a ver (`PLAN-2 §3.5`).
- **Fall dirigida con el puntero / "quedarse quieto 3 s"** — reemplazado por la caída automática y el tramo de soltarse (`DECISIONS · Night 2 — Phase 7`).
- **Ventanas con luna pintada en la escalera** — sacadas: la única luna es la que orbita (`DECISIONS · Night 2 — Phase 3`).
- **Un cuarto botón en Wake para el portfolio** — no: el nombre del autor es el link (`DECISIONS · Wake`).

---

## 6. Orden sugerido

1. **QA en dispositivos reales + ajuste de números** (2.1, 2.2, 2.3). Es deuda del plan 2 y puede cambiar valores que las features nuevas van a heredar.
2. **Deploy y rendimiento** (3): `og:image` absoluto, PageSpeed sobre el sitio real, primer frame de R3F.
3. **Títulos en un solo lugar** (4, primer ítem), y después **narrativa definitiva** (1.1).
4. **Sonido opt-in** (1.3): independiente de la narrativa, alto impacto, sin dependencias nuevas.
5. **Manual interactivo** (1.4) y **cursor propio** (1.5).
6. **Segunda noche** (1.2), con la narrativa ya fija; ahí evaluar 1.8.
7. Experimentales, con prueba de captura primero: **distorsión bajo el agua** (1.6) y **giroscopio** (1.7).
