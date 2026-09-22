import { useState } from 'react'
import Hero from './components/Hero/Hero'
import SliderHero from './components/SliderHero/SliderHero'


import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
    
      <Hero />
      <SliderHero />  
     
    </>
  )
}

export default App
