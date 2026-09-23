import Strands from '../../Strands/Strands';
import Counter from '../../Counter/Counter';
import './Sound.css';

const STATS = [
  { value: 360, suffix: '°', label: 'Spatial Field' },
  { value: 40, suffix: 'kHz', label: 'Frequency Range' },
  { value: 30, suffix: 'h', label: 'Battery Life' }
];

// Placeholder copy — swap in real product specs.
const Sound = () => {
  return (
    <section className="nova-sound">
      <div className="nova-sound-bg">
        <Strands
          colors={['#d4af6a', '#ffffff', '#8ec5ff']}
          count={4}
          speed={0.45}
          amplitude={1}
          waviness={1.1}
          thickness={0.6}
          glow={2.8}
          taper={3}
          spread={1.1}
          intensity={0.55}
          saturation={1.3}
          opacity={0.85}
          scale={1.6}
        />
      </div>
      <div className="nova-sound-content">
        <p className="nova-sound-eyebrow">Sound</p>
        <h2 className="nova-sound-title">Hear everything, exactly where it happens.</h2>
        <div className="nova-sound-stats">
          {STATS.map(stat => (
            <div key={stat.label} className="nova-sound-stat">
              <div className="nova-sound-stat-value">
                <Counter
                  value={stat.value}
                  fontSize={56}
                  fontWeight={800}
                  textColor="#ffffff"
                  gap={2}
                  padding={2}
                  gradientHeight={0}
                />
                <span className="nova-sound-stat-suffix">{stat.suffix}</span>
              </div>
              <p className="nova-sound-stat-label">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Sound;
