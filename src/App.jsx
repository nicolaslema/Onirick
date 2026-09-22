import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import Hero from './components/Hero/Hero'
import DistortionHero from './components/DistortionHero/DistortionHero'
import LiquidHero from './components/LiquidHero/LiquidHero'
import FloatingLinesHero from './components/FloatingLinesHero/FloatingLinesHero'
import SliderHero from './components/SliderHero/SliderHero'
import GradualBlur from './components/GradualBlur/GradualBlur'
import FluidGlass from './components/FluidGlass/FluidGlass'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <GradualBlur target="page" position="top" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <GradualBlur target="page" position="bottom" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <FluidGlass
        mode="lens"
        lensProps={{ scale: 0.25, ior: 1.15, thickness: 5, chromaticAberration: 0.1, anisotropy: 0.01 }}
      />

      <Hero />
      <DistortionHero />
      <LiquidHero />
      <FloatingLinesHero />
      <SliderHero />

  

     
    </>
  )
}

export default App
