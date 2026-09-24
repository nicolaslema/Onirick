import { useScrollSections, useSectionIndex } from '../ScrollSections/ScrollSectionsContext';

// PLAN.md 3.2: which sections keep a live R3F context.
// - 'active': the current section, or either side of an in-flight
//   transition (it has to keep animating while it's being melted).
// - 'neighbor': current ± 1 — the only sections the next gesture can melt
//   into, mounted so their capture is ready; rendered on demand only.
// - 'offstage': everything else, unmounted (poster in Phase 6).
// During a non-adjacent jump (always a plain crossfade), only its two ends
// stay live, so current + neighbours + jump target never exceed 3 contexts
// on top of the melt engine's own.
export function useSectionPresence() {
  const { currentIndex, activeTransition } = useScrollSections();
  const index = useSectionIndex();

  const inTransition = !!activeTransition && (activeTransition.from === index || activeTransition.to === index);
  if (index === currentIndex || inTransition) return 'active';

  const isJump = !!activeTransition && Math.abs(activeTransition.to - activeTransition.from) > 1;
  if (!isJump && Math.abs(index - currentIndex) === 1) return 'neighbor';
  return 'offstage';
}
