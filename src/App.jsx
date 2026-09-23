import ScrollSections from './components/ScrollSections/ScrollSections'
import { SectionAlpha, SectionBeta, SectionGamma, SectionDelta } from './components/sections/Placeholder/sections'
import GradualBlur from './components/GradualBlur/GradualBlur'

// Temporarily swapped in for the shader-backed sections (Hero/Sound/Craft —
// still on disk, unused) to isolate the scroll-morph transition itself from
// the animated WebGL backgrounds while chasing a performance issue.
const SECTIONS = [
  { id: 'alpha', Component: SectionAlpha },
  { id: 'beta', Component: SectionBeta },
  { id: 'gamma', Component: SectionGamma },
  { id: 'delta', Component: SectionDelta }
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
