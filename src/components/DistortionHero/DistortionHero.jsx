import GridDistortion from '../GridDistortion/GridDistortion';
import heroImg from '../../assets/hero.png';
import './DistortionHero.css';

const DistortionHero = () => {
  return (
    <section className="distortion-hero">
      <GridDistortion
        imageSrc={heroImg}
        grid={10}
        mouse={0.1}
        strength={0.15}
        relaxation={0.9}
      />
    </section>
  );
};

export default DistortionHero;
