import ScrollSections from './components/ScrollSections/ScrollSections'
import Hero from './components/sections/current/Hero'
import Features from './components/sections/current/Features'
import Proof from './components/sections/current/Proof'
import Process from './components/sections/current/Process'
import CTA from './components/sections/current/CTA'
import GradualBlur from './components/GradualBlur/GradualBlur'

// Current: a small toolkit of pointer-reactive effects (ripple, melt, drift)
// for developers to drop into a page. The scroll-morph transition between
// these sections and the RippleDistortion hero background are the only two
// effects actually running here — everything else is plain markup/CSS.
//
// Proof is deliberately a 'scroll'-kind section (see ScrollSections.jsx) —
// a first, minimal proof-of-concept that morph and plain-scroll sections can
// coexist in the same flow: its content scrolls natively and reveals itself
// on scroll instead of melting in, and the transitions on either side of it
// are a plain crossfade rather than the WebGL melt.
const SECTIONS = [
  { id: 'hero', Component: Hero },
  { id: 'features', Component: Features },
  { id: 'proof', Component: Proof, kind: 'scroll' },
  { id: 'process', Component: Process },
  { id: 'cta', Component: CTA }
]

function App() {
  return (
    <>
      <GradualBlur target="page" position="top" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <GradualBlur target="page" position="bottom" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <ScrollSections sections={SECTIONS} mode="snap" />
    </>
  )
}

export default App
