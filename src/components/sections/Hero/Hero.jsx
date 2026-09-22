import Beams from '../../Beams/Beams';
import RotatingText from '../../RotatingText/RotatingText';
import './Hero.css';

const ROLES = ['Musician', 'Designer', 'Artist', 'Developer', 'Entrepreneur'];

// Placeholder copy — swap in the real name/bio/CTA.
const Hero = () => {
  return (
    <section className="portfolio-hero">
      <div className="portfolio-hero-bg">
        <Beams beamWidth={2} beamHeight={18} beamNumber={14} lightColor="#ffffff" speed={1.6} noiseIntensity={1.6} scale={0.22} rotation={12} />
      </div>
      <div className="portfolio-hero-content">
        <p className="portfolio-hero-eyebrow">Portfolio</p>
        <h1 className="portfolio-hero-title">Your Name</h1>
        <p className="portfolio-hero-role">
          I work as a{' '}
          <RotatingText
            texts={ROLES}
            mainClassName="portfolio-hero-role-rotate"
            staggerFrom="last"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '-120%' }}
            staggerDuration={0.02}
            splitLevelClassName="portfolio-hero-role-split"
            transition={{ type: 'spring', damping: 30, stiffness: 400 }}
            rotationInterval={2200}
          />
        </p>
        <button type="button" className="portfolio-hero-cta">
          View work
        </button>
      </div>
    </section>
  );
};

export default Hero;
