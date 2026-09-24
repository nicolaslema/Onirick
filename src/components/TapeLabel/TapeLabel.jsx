// The device's voice: one uppercase mono line, with a blinking rec dot when
// live. Takes raw text rather than structured tape/time/stage fields since
// the actual copy varies by section (a dream's "Tape 02 · 03:12 AM · REM 3"
// vs. the hero's "DR-1 · Dream recorder · 1986" or the manual's
// "03:40 AM · You woke up") — uppercase transform is handled by .onk-tape in
// components.css, so this is passed in normal case.
const TapeLabel = ({ live = false, children }) => (
  <span className="onk-tape" data-live={live || undefined}>
    {live && <span className="onk-rec" />}
    {children}
  </span>
);

export default TapeLabel;
