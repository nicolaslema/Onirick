import ScrollSections from './components/ScrollSections/ScrollSections'
import Hud from './components/Hud/Hud'
import GradualBlur from './components/GradualBlur/GradualBlur'
import { NIGHT } from './night/config'

// Onirick: a night of sleep, told through the scroll-morph transition this
// repo already had. Phase 0 wires up the 8 sections with their final copy
// and the current global melt — per-section melt/plainDuration overrides,
// touch input, lazy 3D mounting and posters are later phases (PLAN.md
// section 7-8). The Hud is static for the same reason (see Hud.jsx).
function App() {
  return (
    <>
      <GradualBlur target="page" position="top" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <GradualBlur target="page" position="bottom" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <Hud />
      <ScrollSections sections={NIGHT} mode="snap" />
    </>
  )
}

export default App
