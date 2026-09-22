import FloatingLines from '../FloatingLines/FloatingLines';
import './FloatingLinesHero.css';

const FloatingLinesHero = () => {
  return (
    <section className="floating-lines-hero">
      <FloatingLines
        enabledWaves={['top', 'middle', 'bottom']}
        lineCount={[10, 15, 20]}
        lineDistance={[8, 6, 4]}
        bendRadius={5.0}
        bendStrength={-3.5}
        interactive={true}
        parallax={true}
      />
    </section>
  );
};

export default FloatingLinesHero;
