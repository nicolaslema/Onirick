// Window-wide pointer position, normalized to [-1, 1] (y up), shared by
// every scene. R3F's own state.pointer only updates for events that reach
// its canvas, and each section's text sits on top of its canvas — tracking
// the window keeps parallax/tilt continuous no matter what's under the
// cursor. One listener for the whole page, installed on first use.
export const pointer = { x: 0, y: 0 };

let installed = false;

export function trackPointer() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener(
    'pointermove',
    e => {
      pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.y = -((e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true }
  );
}
