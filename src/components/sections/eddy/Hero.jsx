import RippleDistortion from '../../RippleDistortion/RippleDistortion';
import rippleImage from '../../../assets/Slider/animals-birds-kingfisher-low-poly-wallpaper-790078ad012a3d8b1677f8bfe081d6dd.jpg';
import './eddy-shared.css';
import './Hero.css';

// The ripple background isn't decoration here — it's the product itself,
// demonstrating the thing eddy actually does (a pointer-reactive effect
// dropped onto an arbitrary image) rather than an unrelated flourish.
const Hero = () => (
  <section className="eddy-hero">
    <div className="eddy-hero-bg">
      <RippleDistortion
        src={rippleImage}
        brushSize={180}
        strength={0.25}
        swirl={1.2}
        rings={4}
        grayscale
        tint="#d4af6a"
        tintAmount={0.15}
        trigger="hover"
        quality="medium"
      />
    </div>
    <div className="eddy-hero-mark">eddy</div>
    <div className="eddy-hero-content">
      <h1 className="eddy-hero-headline">Motion that answers the cursor, not a timer.</h1>
      <p className="eddy-hero-sub">
        A small set of pointer-reactive effects — ripple, melt, drift — you drop into a page with one
        import. No shader code, no animation library to learn.
      </p>
      <button type="button" className="eddy-btn">
        Get started
      </button>
    </div>
  </section>
);

export default Hero;
