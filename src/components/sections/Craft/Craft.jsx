import LiquidChrome from '../../LiquidChrome/LiquidChrome';
import SpotlightCard from '../../SpotlightCard/SpotlightCard';
import './Craft.css';

const DETAILS = [
  { title: 'Aerospace-grade aluminum', blurb: 'Machined from a single billet, finished by hand.' },
  { title: 'Precision-milled hinges', blurb: 'Zero-play articulation, rated for 100,000 cycles.' },
  { title: 'Acoustic leather', blurb: 'Breathable, sound-tuned ear cushions.' }
];

// Placeholder copy — swap in real product/material details.
const Craft = () => {
  return (
    <section className="nova-craft">
      <div className="nova-craft-bg">
        <LiquidChrome baseColor={[0.06, 0.06, 0.07]} speed={0.35} amplitude={0.25} frequencyX={2.4} frequencyY={2.4} interactive={true} />
      </div>
      <div className="nova-craft-content">
        <p className="nova-craft-eyebrow">Craft</p>
        <h2 className="nova-craft-title">Built without compromise.</h2>
        <div className="nova-craft-grid">
          {DETAILS.map(detail => (
            <SpotlightCard key={detail.title} className="nova-craft-card" spotlightColor="rgba(212, 175, 106, 0.25)">
              <h3 className="nova-craft-card-title">{detail.title}</h3>
              <p className="nova-craft-card-blurb">{detail.blurb}</p>
            </SpotlightCard>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Craft;
