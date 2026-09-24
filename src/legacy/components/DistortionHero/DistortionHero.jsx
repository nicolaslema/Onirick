import GridDistortion from '../GridDistortion/GridDistortion';
import heroImg from '../../assets/nicoymagui.jpg';
import './DistortionHero.css';

const DistortionHero = () => {
  return (
    <section className="distortion-hero">
      <GridDistortion
        imageSrc={heroImg}
        grid={30}
        mouse={0.1}
        strength={2.15}
        relaxation={0.9}
      />
    </section>
  );
};

export default DistortionHero;
