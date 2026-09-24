import ScrollSections from './components/ScrollSections/ScrollSections'
import Hero from './components/sections/eddy/Hero'
import Features from './components/sections/eddy/Features'
import Process from './components/sections/eddy/Process'
import CTA from './components/sections/eddy/CTA'
import GradualBlur from './components/GradualBlur/GradualBlur'

// eddy: a small toolkit of pointer-reactive effects (ripple, melt, drift)
// for developers to drop into a page. The scroll-morph transition between
// these sections and the RippleDistortion hero background are the only two
// effects actually running here — everything else is plain markup/CSS.
const SECTIONS = [
  { id: 'hero', Component: Hero },
  { id: 'features', Component: Features },
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
