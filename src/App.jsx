import { lazy, Suspense, useCallback, useState } from 'react'
import ScrollSections from './components/ScrollSections/ScrollSections'
import Hud from './components/Hud/Hud'
import GradualBlur from './components/GradualBlur/GradualBlur'
import Grain from './components/Grain/Grain'
import Loader from './components/Loader/Loader'
import { IntroContext } from './components/Loader/IntroContext'
import { NIGHT } from './night/config'

// Dev only, with ?debug (PLAN-2.md 4.5). import.meta.env.DEV is a literal
// false in a production build, so the import below is dead code there and
// the panel never ships.
const DebugPanel =
  import.meta.env.DEV && new URLSearchParams(window.location.search).has('debug')
    ? lazy(() => import('./components/DebugPanel/DebugPanel'))
    : null

// Onirick: a night of sleep, told through the scroll-morph transition this
// repo already had. Hud is a sibling of <ScrollSections>, not a child, so it
// can't reach ScrollSectionsContext directly — ScrollSections' onStateChange
// prop mirrors { currentIndex, activeTransition } out here instead, which
// this then resolves against NIGHT for the Hud's actual per-section data.
function App() {
  const [nightState, setNightState] = useState({ currentIndex: 0, activeTransition: null })
  const handleStateChange = useCallback(state => setNightState(state), [])
  const [ready, setReady] = useState(false)
  const handleReady = useCallback(() => setReady(true), [])

  const current = NIGHT[nightState.currentIndex]

  return (
    <>
      <GradualBlur target="page" position="top" height="6rem" strength={2} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <GradualBlur target="page" position="bottom" height="2rem" strength={1} divCount={5} curve="bezier" exponential={true} opacity={1} />
      <Grain />
      <Hud
        hud={current?.hud}
        theme={current?.theme ?? 'night'}
        index={nightState.currentIndex}
        total={NIGHT.length}
        tape={current?.tape}
        title={current?.title}
      />
      <IntroContext.Provider value={ready}>
        <ScrollSections sections={NIGHT} mode="snap" onStateChange={handleStateChange} onReady={handleReady} />
      </IntroContext.Provider>
      <Loader ready={ready} />
      {DebugPanel && (
        <Suspense fallback={null}>
          <DebugPanel currentId={current?.id} />
        </Suspense>
      )}
    </>
  )
}

export default App
