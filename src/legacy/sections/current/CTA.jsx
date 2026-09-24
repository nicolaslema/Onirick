import './shared.css';
import './CTA.css';

const CTA = () => (
  <section className="current-cta">
    <h2 className="current-cta-title">Your page is standing still. It doesn't have to.</h2>
    <code className="current-cta-snippet">import {'{'} ripple {'}'} from 'current'</code>
    <div className="current-cta-actions">
      <button type="button" className="current-btn">
        Get started
      </button>
      <button type="button" className="current-btn-secondary">
        Read the docs
      </button>
    </div>
  </section>
);

export default CTA;
