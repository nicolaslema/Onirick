import ScrollSections from './components/ScrollSections/ScrollSections'
import Hero from './components/sections/Hero/Hero'
import Sound from './components/sections/Sound/Sound'
import Craft from './components/sections/Craft/Craft'
import GradualBlur from './components/GradualBlur/GradualBlur'

const SECTIONS = [
  { id: 'hero', Component: Hero },
  { id: 'sound', Component: Sound },
  { id: 'craft', Component: Craft }
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
