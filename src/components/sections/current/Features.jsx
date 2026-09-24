import './shared.css';
import './Features.css';

// ripple and melt name real mechanisms already running on this page (the
// RippleDistortion hero and the scroll-morph transition between sections);
// drift is the one plausible feature this particular demo doesn't happen to
// show. Each row leaves a placeholder where a real build would show that
// effect running on a small live example instead of describing it in prose.
const FEATURES = [
  {
    name: 'ripple',
    desc: "Distorts whatever's underneath in response to touch or the cursor — an image, a video, a gradient.",
    placeholder: 'live demo'
  },
  {
    name: 'melt',
    desc: 'Blends one section of a page into the next as someone scrolls past it, instead of just swapping one out for the other.',
    placeholder: 'live demo'
  },
  {
    name: 'drift',
    desc: 'Lets background elements trail slightly behind the cursor, so a flat layout picks up a little depth.',
    placeholder: 'live demo'
  }
];

const Features = () => (
  <section className="current-features">
    <div className="current-features-header">
      <p className="current-features-intro">Three effects. That's the whole toolkit.</p>
      <p className="current-features-sub">
        Each one ships as a standalone function — use one, or all three, without pulling in the others.
      </p>
    </div>
    <div className="current-features-list">
      {FEATURES.map(f => (
        <div className="current-feature-row" key={f.name}>
          <div className="current-feature-text">
            <span className="current-feature-name">{f.name}</span>
            <p className="current-feature-desc">{f.desc}</p>
          </div>
          <div className="current-placeholder current-feature-demo">
            <span className="current-placeholder-label">{f.placeholder}</span>
          </div>
        </div>
      ))}
    </div>
  </section>
);

export default Features;
