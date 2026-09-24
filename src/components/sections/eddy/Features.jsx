import './Features.css';

// ripple and melt name real mechanisms already running on this page (the
// RippleDistortion hero and the scroll-morph transition between sections);
// drift is the one plausible feature this particular demo doesn't happen to
// show.
const FEATURES = [
  {
    name: 'ripple',
    desc: "Distorts whatever's underneath in response to touch or the cursor — an image, a video, a gradient."
  },
  {
    name: 'melt',
    desc: 'Blends one section of a page into the next as someone scrolls past it, instead of just swapping one out for the other.'
  },
  {
    name: 'drift',
    desc: 'Lets background elements trail slightly behind the cursor, so a flat layout picks up a little depth.'
  }
];

const Features = () => (
  <section className="eddy-features">
    <p className="eddy-features-intro">Three effects. That's the whole toolkit.</p>
    <div className="eddy-features-list">
      {FEATURES.map(f => (
        <div className="eddy-feature-row" key={f.name}>
          <span className="eddy-feature-name">{f.name}</span>
          <p className="eddy-feature-desc">{f.desc}</p>
        </div>
      ))}
    </div>
  </section>
);

export default Features;
