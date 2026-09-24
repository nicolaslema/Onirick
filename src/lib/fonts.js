// Resolves once the faces the page actually draws are loaded. The Google
// Fonts stylesheet loads without blocking render (index.html), so
// document.fonts.ready alone isn't enough: it can resolve before that sheet
// has even declared the faces, and a melt capture taken then would draw its
// text in a fallback font — which then visibly snaps to the real one when
// the live DOM takes over.
const FACES = [
  '400 1em "Instrument Serif"',
  'italic 400 1em "Instrument Serif"',
  '400 1em "JetBrains Mono"',
  '500 1em "JetBrains Mono"',
  '600 1em "JetBrains Mono"'
];
const SHEET_TIMEOUT_MS = 4000;

function sheetLoaded() {
  const link = document.querySelector('link[data-fonts]');
  if (!link || link.sheet) return Promise.resolve();
  return new Promise(resolve => {
    link.addEventListener('load', resolve, { once: true });
    link.addEventListener('error', resolve, { once: true });
    setTimeout(resolve, SHEET_TIMEOUT_MS);
  });
}

let pending = null;

export function fontsLoaded() {
  if (!document.fonts) return Promise.resolve();
  pending ??= sheetLoaded()
    .then(() => Promise.all(FACES.map(face => document.fonts.load(face).catch(() => null))))
    .then(() => document.fonts.ready)
    .then(() => undefined);
  return pending;
}
