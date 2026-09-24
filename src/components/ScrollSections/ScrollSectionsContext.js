import { createContext, useContext } from 'react';

// Available to any section component rendered inside <ScrollSections> — not
// to siblings of it (ScrollSections also takes an onStateChange callback
// prop for that; see App.jsx, which lifts { currentIndex, activeTransition }
// out to feed the Hud, a sibling rather than a child).
export const ScrollSectionsContext = createContext(null);

// The index of the section a component is rendered inside, so a section
// (or a SceneCanvas deep inside it) can tell where it sits relative to
// currentIndex without every section having to be handed its own index.
export const SectionIndexContext = createContext(null);
// ...and its id from the NIGHT config (e.g. to find its poster).
export const SectionIdContext = createContext(null);

// { currentIndex, activeTransition: {from,to} | null, goTo(idOrIndex) }
export function useScrollSections() {
  const ctx = useContext(ScrollSectionsContext);
  if (!ctx) throw new Error('useScrollSections must be called from a section rendered inside <ScrollSections>');
  return ctx;
}

export const useSectionId = () => useContext(SectionIdContext);

export function useSectionIndex() {
  const index = useContext(SectionIndexContext);
  if (index === null) throw new Error('useSectionIndex must be called from a section rendered inside <ScrollSections>');
  return index;
}
