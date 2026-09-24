import { createContext, useContext } from 'react';

// Available to any section component rendered inside <ScrollSections> — not
// to siblings of it (ScrollSections also takes an onStateChange callback
// prop for that; see App.jsx, which lifts { currentIndex, activeTransition }
// out to feed the Hud, a sibling rather than a child).
export const ScrollSectionsContext = createContext(null);

// { currentIndex, activeTransition: {from,to} | null, goTo(idOrIndex) }
export function useScrollSections() {
  const ctx = useContext(ScrollSectionsContext);
  if (!ctx) throw new Error('useScrollSections must be called from a section rendered inside <ScrollSections>');
  return ctx;
}
