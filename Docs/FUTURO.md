# FUTURO.md — Onirick: lo que quedó para después

> Backlog de lo que **no entró** en `Docs/PLAN-2.md` (fases 0–9, cerradas) y de lo que `DECISIONS.md` dejó abierto al cerrar cada fase. No es un plan todavía: es la lista de la que va a salir el próximo (`PLAN-3.md`).
> Idioma: español. **Todo el texto visible de la web sigue en inglés.**
> Cada ítem dice de dónde sale (`PLAN-2 §N` o `DECISIONS · Fase`), para poder leer el contexto original antes de reabrirlo.

---

## 0. Cómo leer este documento

- **Sección 1**: ideas nuevas que el plan 2 decidió postergar explícitamente (tabla de decisiones §2 y "Fuera de alcance" §12). Son features.
- **Sección 2**: ajuste fino de números y verificaciones sueltas que quedaron abiertas. Son deudas de QA del plan 2, no features nuevas.
- **Sección 3**: rendimiento y deploy.
- **Sección 4**: deuda técnica menor anotada en `DECISIONS.md`.
- **Sección 5**: lo que **no** hay que reabrir (descartado o decidido con el usuario), para no volver a proponerlo.
- **Sección 6**: un orden sugerido.

Las decisiones de `PLAN-2 §13` siguen valiendo. Si alguno de estos ítems las contradice, hay que preguntar antes.

---

## 1. Features postergadas

Revisado con el usuario el 2026-09-26: quedan estas cuatro. Lo que se sacó está en la sección 5.

### 1.1 Narrativa

**Por ahora está bien como está.** Si hay cambios, vienen más adelante; no es un pendiente activo.

- El copy del plan 2 quedó como borrador aceptado (`PLAN-2 §13.3`): frases por beat y progreso, etiquetas de fragmento, pistas y líneas de lucidez de Wake. Está concentrado en `src/night/dreams.js` y `src/night/Wake/Wake.jsx`, así que retocarlo no toca lógica.
- Para cuando se revise: el log de la escalera dice *"Every landing has the same window, and the same moon in it."*, pero las ventanas ahora son marcos vacíos y la única luna es la que orbita (`DECISIONS · Night 2 — Phase 3, after review`). Se puede leer como "la misma luna vista a través de ellas".

### 1.2 Sonido opt-in

**En desarrollo: ver `Docs/PLAN-3.md`**, que la divide en fases por sección. `PLAN-2 §2` (Después) y `§12`. Analizada con el usuario el 2026-09-26.

#### Decidido

| Tema | Decisión |
| --- | --- |
| Alcance | **Capa global + un ambiente por sueño.** Se puede construir por fases: la global primero, después sueño por sueño. |
| Toggle | Botón **`SOUND OFF` / `SOUND ON`** en el HUD, siempre visible. **Apagado por defecto.** |
| Origen | **Sintetizado con Web Audio primero** (0 KB, reacciona al estado en tiempo real, sin licencias, coherente con el 3D procedural). **Archivos CC0 solo** para los sonidos que no salgan convincentes sintetizados (probablemente pasos, agua, pájaros); cada uno en un `CREDITS.md` con su licencia. |
| Recordar la preferencia | **No.** El botón está a la vista; cada visita arranca sin sonido. |
| Manual | **A definir.** Silencio o casi (el momento despierto) es una opción, sin decidir. |

#### Contenido propuesto (borrador, se ajusta al construir)

- **Capa global — la DR-1 está grabando:**
  - hiss de cinta y zumbido de motor muy bajos durante toda la noche;
  - **el melt suena como cinta estirada**: *wow/flutter* (el pitch se dobla) durante cada transición, más fuerte a medida que avanza la noche, como los melts (`PLAN.md §5.1`);
  - un "clic" de cinta al guardar un fragmento (`recording.keep`);
  - en Wake: *clack* de STOP y del eject, después silencio.
- **Por sueño:**
  - **Hero:** zumbido de standby; clic de tecla en los botones.
  - **Stair:** pasos lentos cada `T_STEP` (2 s), sincronizados con la figura; al detenerte los pasos paran y la escalera sigue sonando.
  - **Whale:** viento y rumor lejano de ciudad; al saludar, un canto grave de ballena (oscilador con glissando).
  - **House:** el zumbido de una heladera lejana (la cocina inalcanzable); crujido al abrir una puerta.
  - **Manual:** a definir.
  - **Ocean:** agua que golpea bajo y sube con cada beat; bajo el agua, todo tras un pasa-bajos fuerte; con el fragmento, el zumbido de la lámpara.
  - **Fall:** viento que crece con la velocidad; la alarma, pitidos al mismo ritmo que el REC (`hud.recTo`); silencio en el quemado a blanco.
  - **Wake:** el tic de la impresora mientras imprime la grabación; quizá pájaros del amanecer, muy suaves.
- **Descartado de entrada:** un clic por carácter en el tipeo de los logs (cansa rápido). La impresión de Wake es la única excepción.

#### Cómo encaja en el código

- Un módulo `night/sound.js` que **se suscribe a las señales que ya existen**, sin tocar las escenas:
  - `night/stage.js` (`currentId`, `settled`): qué ambiente suena;
  - `onStateChange` de ScrollSections (`activeTransition {from, to}`): crossfade entre ambientes y el *wow/flutter* del melt, con la duración de cada melt de `config.js` (no hay `progress` por frame, `DECISIONS · Phase 1`);
  - `night/play.js` (`subscribeTarget`, `trigger`, `act`): progreso del scrub, beats, `wave`, `let-go`;
  - `night/recording.js` (`keep`): el clic de fragmento.
- **Dos escenas tienen que exponer algo:** Ocean, el nivel real del agua (para el pasa-bajos al cruzar la superficie), y Stair, el ritmo de los pasos (vive en la escena, no en `play.js`).
- **Carga:** import dinámico al activar el toggle (como *Save the tape*), fuera del primer chunk. Lighthouse no se entera hasta que alguien lo activa (presupuesto de 3.3).
- **Autoplay:** el `AudioContext` se crea en el click del toggle, que ya es el gesto que exige el navegador.
- **Pestaña oculta:** suspender el `AudioContext`.
- **Dependencias:** ninguna; Web Audio es nativo (`PLAN-2 §0.7`).

#### Accesibilidad y casos borde

- El toggle es un `<button>` real con `aria-pressed`, enfocable, con el foco visible de los botones. **No puede ir dentro del `div` del HUD**, que es `aria-hidden`: va como hermano, igual que sus regiones `aria-live`.
- Opt-in y con control visible: cumple WCAG 1.4.2 (control del audio).
- **Reduced motion** no dice nada del audio: el sonido no cambia, salvo el *wow/flutter* del melt, que pasa a ser un crossfade simple (como la imagen).
- **Sin WebGL2:** los ambientes funcionan igual, con crossfades entre pósters.
- **iOS:** Web Audio respeta el interruptor de silencio del iPhone (con el switch en silencio no suena). No verificable hasta la verificación en dispositivos reales, que quedó para más adelante.

### 1.3 Manual interactivo

**Feature futura.** `PLAN-2 §2` (Después) y `§12`.

- Hover en la `SpecTable` resalta la pieza correspondiente en una **vista explotada del DR-1**.
- Botones `PLAY TAPE 0N` que saltan a cada sueño.
- Tener en cuenta que el manual hoy es un **desvío** (`detour: true`, `DECISIONS · After release`): saltar desde ahí a un sueño tiene que convivir con esa regla (¿un `PLAY TAPE` termina el desvío como Home/End?).
- Requiere un equivalente en tap para mobile (`PLAN-2 §5.6`: nada depende del hover).

### 1.4 Cursor propio

**Sin decidir; queda por ahora.** `PLAN-2 §2` (Después) y `§12`. Uno solo para toda la noche. A definir: si cambia por sueño o por estado (por ejemplo, en la escalera al mantener apretado), y cómo convive con el `pointer.js` window-wide y con reduced motion.

---

## 2. Verificación pendiente (deuda de QA del plan 2)

Todo el QA del plan 2 se hizo en **Chrome** (headless con GPU, escritorio y 390px). La verificación en otros navegadores y en dispositivos reales (Safari, Firefox, iOS, Android) se sacó de este documento (usuario, 2026-09-26): vendrá más adelante, cuando haya tiempo y recursos.

### 2.1 Ajuste fino en dispositivo

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

### 2.2 Otras verificaciones sueltas

- [ ] **Sombras de la escalera en una laptop con iGPU y en un teléfono.** Solo se midió en una RTX 5080 (144 fps). El respaldo (apagar sombras en pantallas chicas) es "una línea" y no se activó (`DECISIONS · Night 2 — Phase 3`).
- [ ] **Un click en un botón nunca abre una puerta** en House: garantizado por construcción (`onTap` ignora destinos interactivos), pero no observable desde el test sin exponer estado (`DECISIONS · Night 2 — Phase 5`).
- [ ] **Un frame de 42 ms en la ballena después de un saludo** (el resto de la noche, p95 7.1 ms). Investigar si es compilación de un shader o material que aparece recién ahí (la onda de luz, la figura del techo) y precalentarlo (`DECISIONS · Night 2 — Phase 9`).
- [ ] **Volver de Wake a Fall**: entrar a Fall hacia atrás lo deja en su final, y el recorrido de vuelta hasta 0 son varios gestos (`DECISIONS · Night 2 — Phase 1`). Es lo diseñado; conviene mirarlo en un teléfono para confirmar que no se siente trabado.

---

## 3. Rendimiento y deploy

### 3.1 Estado actual

Medido por el usuario con Lighthouse sobre el sitio desplegado (`https://onirick.vercel.app/`), 2026-09-26:

| | Performance | Accessibility | Best Practices | SEO |
| --- | --- | --- | --- | --- |
| Mobile | 83 | 100 | 100 | 100 |
| Desktop | 99 | 100 | 100 | 100 |

Cumple la regla del plan (mobile ≥ 80, Accessibility 100). Las mediciones de 79–80 de `DECISIONS · Night 2 — Phase 9` eran locales (`vite preview`) y quedan superadas. El `charset` que marcaba Lighthouse en local ya no aparece en el sitio desplegado (Best Practices 100).

### 3.2 Pendiente

- [ ] **`og:image` absoluto:** hoy es `/posters/hero.webp` en `index.html`. Pasarlo a `https://onirick.vercel.app/posters/hero.webp`, porque las vistas previas de links (WhatsApp, X, LinkedIn) pueden no resolver una URL relativa. El README dice dónde (`DECISIONS · Phase 6/7`).
- [ ] **`og:url`:** no existe. Sumarlo con `https://onirick.vercel.app/`, junto al anterior.
- Si el dominio cambia (por ejemplo, a uno propio), se actualizan los dos.

### 3.3 Presupuesto para lo que viene

Mantener **mobile ≥ 80 y 100 en Accessibility, Best Practices y SEO** al sumar cualquier feature de la sección 1 (sonido, manual interactivo, cursor). El margen en mobile es de 3 puntos: medir en el sitio desplegado después de cada una.

### 3.4 Opcional: solo si mobile baja de 80

Ideas que quedaron de la fase 9 para ganar puntos de Performance. Con 83 no hacen falta, y tocan partes delicadas (montaje de vecinas, loader):

- **Primer frame de R3F:** compila juntos los shaders del hero y de la escalera (~200 ms sin throttling). Opciones: montar la vecina (escalera) un frame después, o precompilar con `gl.compile` en idle.
- **Prueba de WebGL2 antes del primer paint** (`lib/webgl.js` pide un contexto real): moverla después, si se puede sin romper el loader.
- Por dónde **no** ir: apagar las sombras de la escalera no cambió nada medible, y el LCP es el heading del hero, que pinta cuando se levanta el loader a propósito (`PLAN.md §5.2`, `DECISIONS · Phase 6`).

---

## 4. Deuda técnica menor

- **Títulos repetidos en tres lugares**: `src/night/config.js` (`tape`/`title`, para el anuncio del HUD), `src/night/dreams.js` (para el log de Wake y *Save the tape*) y cada `DreamX.jsx`. Unificarlos en `dreams.js` y que `config.js` los reexporte, cuidando el ciclo de imports `config.js` → secciones → escenas → `play.js` (`DECISIONS · Phase 1`, `Night 2 — Phase 0`, `Night 2 — Phase 8`). Conviene hacerlo **antes** de cualquier retoque de narrativa (1.1), así un título se cambia en un solo lugar.
- **`src/legacy/`** sigue en el repo (`Proof.jsx` y compañía, de antes de la noche 1; `DECISIONS · Phase 4`). Decidir si se borra.
- **`activeTransition` sin `progress`** (`DECISIONS · Phase 1`): solo revisar si algo nuevo (sonido, 1.2, que podría querer seguir el melt) necesita el progreso cuadro a cuadro. Si hace falta, exponerlo como ref, no como estado de React.
- **Póster de Wake** hornea la etiqueta de la fecha en que se generó (`DECISIONS · Night 2 — Phase 9`). Solo se ve sin WebGL2, donde la cuenta es 0/5; si molesta, generar ese póster con la etiqueta vacía.
- **Filtro de avisos de `THREE.Clock`** en `three/console.js`: R3F 9 construye su reloj con `THREE.Clock`, que three r183+ marca como deprecado. Cuando salga una versión de R3F que no lo use, sacar el filtro (`DECISIONS · Phase 6`).
- **Estado de escena que se pierde al desmontar** (dónde quedó la figura de la escalera, qué puertas estaban abiertas en House). Decidido aceptable (`PLAN-2 §3.3`, `§13.5`); sin acción.

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
- **Segunda noche distinta** — no va a haber (usuario, 2026-09-26). Era `PLAN-2 §12`: contador de noches en `localStorage`, sueños que cambian, `NIGHT 02` en el HUD.
- **Distorsión del texto bajo el agua en Ocean** — no va a estar (usuario, 2026-09-26). Era `PLAN-2 §6.4` y `§12`.
- **Giroscopio para dirigir la caída en mobile** — no va a estar (usuario, 2026-09-26). Era `PLAN-2 §12`; además, Fall ya se maneja sola desde la fase 7.
- **Lucidez con efecto en las escenas o en el melt** — no va a estar (`PLAN-2 §13.4`, confirmado por el usuario el 2026-09-26). La lucidez solo cambia el HUD y la línea de Wake.

---

## 6. Orden sugerido

1. **Ajuste de números y verificaciones sueltas** (2.1, 2.2). Es deuda del plan 2 y puede cambiar valores que las features nuevas van a heredar.
2. **`og:image` absoluto y `og:url`** (3.2): dos líneas en `index.html`, el dominio ya se conoce.
3. **Títulos en un solo lugar** (4, primer ítem), para que cualquier retoque de narrativa futuro (1.1) toque un solo archivo.
4. **Sonido opt-in** (1.2): primero la capa global, después un ambiente por sueño. Alto impacto, sin dependencias nuevas.
5. **Manual interactivo** (1.3).
6. **Cursor propio** (1.4), si se confirma.
