import { useState } from 'react'
import heroImg from './assets/hero.png'
import reactLogo from './assets/react.svg'
import viteLogo from './assets/vite.svg'
import Hero from './components/Hero/Hero'
import DistortionHero from './components/DistortionHero/DistortionHero'
import LiquidHero from './components/LiquidHero/LiquidHero'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <Hero />
      <DistortionHero />
      <LiquidHero />

  

     
    </>
  )
}

export default App
