import './PlaceholderSection.css';

// Plain CSS-only stand-in for a real section — no canvas, no shader, nothing
// that renders its own frame loop. Used to isolate the scroll-morph
// transition itself from the animated-background sections, to check whether
// the transition is smooth on its own.
const PlaceholderSection = ({ eyebrow, title, body, background }) => {
  return (
    <section className="placeholder-section" style={{ background }}>
      <div className="placeholder-section-content">
        <p className="placeholder-section-eyebrow">{eyebrow}</p>
        <h1 className="placeholder-section-title">{title}</h1>
        <p className="placeholder-section-body">{body}</p>
      </div>
    </section>
  );
};

export default PlaceholderSection;
