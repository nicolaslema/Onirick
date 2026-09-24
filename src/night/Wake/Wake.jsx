import TapeLabel from '../../components/TapeLabel/TapeLabel';
import './Wake.css';

// Phase 0: placeholder. Phase 2/5 add the DR-1 on a nightstand, dawn light,
// the ejected tape labelled TAPE 05.
const Wake = () => (
  <section className="night-wake" aria-label="Wake">
    <div className="night-wake-content">
      <TapeLabel>07:02 AM · Recording saved</TapeLabel>
      <h1 className="night-wake-display">Did you keep anything?</h1>
      <p className="night-wake-body">
        The DR-1 isn&rsquo;t real. Neither was the whale. Onirick is a design experiment in
        scroll-driven motion by Nicolás Lema.
      </p>
      <div className="night-wake-actions">
        <button type="button" className="onk-btn">
          Replay the night
        </button>
        <a
          className="onk-btn-secondary"
          href="https://github.com/nicolaslema/Onirick"
          target="_blank"
          rel="noreferrer"
        >
          View source →
        </a>
      </div>
    </div>
  </section>
);

export default Wake;
