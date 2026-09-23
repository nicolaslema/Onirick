import PlaceholderSection from './PlaceholderSection';

// Four zero-cost stand-ins (solid/gradient CSS only) simulating distinct
// sections, so ScrollSections has something to morph between while the
// animated-background sections (Beams/Strands/LiquidChrome) are out of the
// picture. Content is filler, not final copy.
export const SectionAlpha = () => (
  <PlaceholderSection
    eyebrow="Chapter One"
    title="Alpha"
    body="A quiet signal in an empty room, waiting for the next idea to arrive."
    background="radial-gradient(circle at 30% 30%, #1a1a22, #0b0b10 70%)"
  />
);

export const SectionBeta = () => (
  <PlaceholderSection
    eyebrow="Chapter Two"
    title="Beta"
    body="Somewhere between a draft and a decision, this is where things start to take shape."
    background="radial-gradient(circle at 70% 40%, #241c14, #0b0b10 70%)"
  />
);

export const SectionGamma = () => (
  <PlaceholderSection
    eyebrow="Chapter Three"
    title="Gamma"
    body="Not everything needs a shader. Sometimes a still frame says enough."
    background="radial-gradient(circle at 50% 70%, #14201f, #0b0b10 70%)"
  />
);

export const SectionDelta = () => (
  <PlaceholderSection
    eyebrow="Chapter Four"
    title="Delta"
    body="Last stop on this test run — if this feels smooth, the transition was never the problem."
    background="radial-gradient(circle at 40% 60%, #1c1620, #0b0b10 70%)"
  />
);
