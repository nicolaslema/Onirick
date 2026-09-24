// Fully styled by the shared .onk-hud rules in styles/components.css — no
// component-local CSS needed here (.sr-only lives in styles/global.css).
const STATE_LABEL = { standby: 'Standby', rec: '● Rec', stop: '■ Stop' };

// Driven by App.jsx's lifted ScrollSections state (see the comment there) —
// no longer static: follows the actual current section, including flipping
// into the paper theme on the manual.
const Hud = ({
  hud = { state: 'standby', clock: '11:58 PM', counter: '00:00:00' },
  index = 0,
  total = 8,
  theme = 'night',
  tape,
  title
}) => {
  // The visual HUD is aria-hidden (it's redundant with each section's own
  // content, and a four-corner fixed overlay reads as noise to a screen
  // reader) — this announces the same change in words instead, on every
  // section change. It has to be a sibling of the aria-hidden div, not
  // nested inside it: an aria-hidden ancestor suppresses aria-live
  // descendants too.
  const announce = tape ? `Tape ${String(tape).padStart(2, '0')}, ${title}` : title;

  return (
    <>
      <div className="onk-hud" data-theme={theme} aria-hidden="true">
        <div className="onk-hud-tl">
          <span className="onk-hud-mark">Onirick</span>
          <span>DR-1</span>
        </div>
        <div className="onk-hud-tr">
          <span>{STATE_LABEL[hud.state] ?? hud.state}</span>
          <span>{hud.clock}</span>
        </div>
        <div className="onk-hud-bl" />
        <div className="onk-hud-br">
          <span className="onk-hud-counter">{hud.counter}</span>
          <div className="onk-hud-tapes">
            {Array.from({ length: total - 1 }, (_, i) => (
              <span key={i} data-active={index === i + 1 ? true : undefined} />
            ))}
          </div>
        </div>
      </div>
      <div className="sr-only" aria-live="polite">
        {announce}
      </div>
    </>
  );
};

export default Hud;
