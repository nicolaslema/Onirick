// The piece on the tape (PLAN-3.md 2.2): Chopin, from the Études Op. 10, from
// Musopen, public domain — see CREDITS.md. Its own module, tiny, because the
// first chunk needs the URL: the <audio> elements are unlocked inside the
// click that turns sound on (sound/bus.js), before the score loads.
//
// Measured (DECISIONS.md, Sound — Phase 1): 172.5 s, −25.6 dB RMS, sound from
// 0.5 s, fading to nothing by ~166 s — the quietest moments of the piece are
// its ends, so the loop crosses there.
export const MUSIC = {
  url: '/sound/night.mp3',
  loopStart: 0.5,
  loopEnd: 166,
  crossfade: 3,
  // Slow and gentle, so the crests (≈ −20 dB RMS in the file, against −37 in
  // its quiet passages) stay background; then a trim, because Web Audio's
  // compressor adds its own makeup gain. Rendered offline through this chain
  // at a −11.5 trim: ≈ −36 dB RMS overall, quiet passages ≈ −41, crests ≈ −32.
  // Lowered 6 dB after the user's listen (phase 1): background, accompanying,
  // ≈ −42 dB RMS on the music layer.
  compress: { threshold: -34, ratio: 2.5, knee: 6, attack: 0.3, release: 1 },
  trimDb: -17.5
};
