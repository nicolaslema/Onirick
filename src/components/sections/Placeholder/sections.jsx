import PlaceholderSection from './PlaceholderSection';
import RippleDistortion from '../../RippleDistortion/RippleDistortion';
// The other Slider wallpaper (digital-art one) is ~2MB — heavy enough that
// its onload regularly landed after ScrollSections' capture timeout,
// leaving the morph texture permanently black until a later refresh caught
// up. This one is ~100KB and loads near-instantly.
import rippleImage from '../../../assets/Slider/animals-birds-kingfisher-low-poly-wallpaper-790078ad012a3d8b1677f8bfe081d6dd.jpg';

// Four zero-cost stand-ins (solid/gradient CSS only) simulating distinct
// sections, so ScrollSections has something to morph between while the
// animated-background sections (Beams/Strands/LiquidChrome) are out of the
// picture. Content is filler, not final copy.
//
// Alpha keeps one live WebGL background (RippleDistortion) on purpose, as a
// controlled re-introduction of a shader after the earlier lag investigation
// — its own frame loop only starts once this section mounts, same as the
// other shader components had, so it's worth watching for the same
// persistent-background-render-loop cost if it's ever moved off Alpha.
export const SectionAlpha = () => (
  <PlaceholderSection
    eyebrow="Chapter One"
    title="Alpha"
    body="A quiet signal in an empty room, waiting for the next idea to arrive."
    background="#0b0b10"
    bg={
      <RippleDistortion
      enabled={true}
        src={rippleImage}
        brushSize={100}
        strength={0.000}
        swirl={0.5 }
        rings={4}
        grayscale={false}
        tint="#5e5b5b3d"
        tintAmount={0.15}
        clickStrength={10}
        trigger="both"
        quality="medium"
      />
    }
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
