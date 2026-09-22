import './Hero.css';

// Placeholder copy — swap in the real name/role/CTA.
const Hero = () => {
  return (
    <section className="portfolio-hero">
      <div className="portfolio-hero-content">
        <p className="portfolio-hero-eyebrow">Portfolio</p>
        <h1 className="portfolio-hero-title">Your Name</h1>
        <p className="portfolio-hero-subtitle">Designer &amp; developer building things for the web.</p>
        <button type="button" className="portfolio-hero-cta">
          View projects
        </button>
      </div>
    </section>
  );
};

export default Hero;
