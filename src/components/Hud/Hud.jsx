// Fully styled by the shared .onk-hud rules in styles/components.css — no
// component-local CSS needed here.
const STATE_LABEL = { standby: 'Standby', rec: '● Rec', stop: '■ Stop' };

// Phase 0: static — shows a fixed hud entry (the hero's, by default) and a
// fixed tape strip. Following which section is actually current, and
// flipping into the paper theme on the manual, needs NightContext
// (PLAN.md section 7.4), which is Phase 1 work; this component's props
// already take that shape so wiring it up later doesn't change this file.
const Hud = ({ hud = { state: 'standby', clock: '11:58 PM', counter: '00:00:00' }, index = 0, total = 8, theme = 'night' }) => (
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
);

export default Hud;
