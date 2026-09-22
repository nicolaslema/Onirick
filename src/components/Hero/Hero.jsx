import Beams from '../Beams/Beams';
import './Hero.css';

const Hero = () => {
  return (
    <section className="hero-section">
      <div className="hero-beams">
        <Beams
          beamWidth={2}
          beamHeight={15}
          beamNumber={20}
          lightColor="#de1111"
          speed={2}
          noiseIntensity={1.75}
          scale={0.2}
          rotation={0}
        />
      </div>
      <div className="hero-content">
        <h1 className="hero-title">Nicolas Lema</h1>
        <p className="hero-subtitle">Build something extraordinary.</p>
      </div>
    </section>
  );
};

export default Hero;
