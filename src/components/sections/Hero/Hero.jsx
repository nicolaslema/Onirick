import Beams from '../../Beams/Beams';
import ShinyText from '../../ShinyText/ShinyText';
import './Hero.css';

// Placeholder copy — swap in real product name/tagline/CTA.
const Hero = () => {
  return (
    <section className="nova-hero">
      <div className="nova-hero-bg">
        <Beams beamWidth={2} beamHeight={18} beamNumber={14} lightColor="#ffffff" speed={1.6} noiseIntensity={1.6} scale={0.22} rotation={12} />
      </div>
      <div className="nova-hero-content">
        <p className="nova-hero-eyebrow">Introducing</p>
        <h1 className="nova-hero-title">
          <ShinyText text="NOVA" speed={2.4} color="#7a7a82" shineColor="#ffffff" spread={110} direction="left" />
        </h1>
        <p className="nova-hero-tagline">Spatial audio. Redefined.</p>
        <button type="button" className="nova-hero-cta">
          Pre-order now
        </button>
      </div>
    </section>
  );
};

export default Hero;
