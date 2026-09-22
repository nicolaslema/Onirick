import MorphSlider from '../MorphSlider/MorphSlider';
import kingfisherImg from '../../assets/Slider/animals-birds-kingfisher-low-poly-wallpaper-790078ad012a3d8b1677f8bfe081d6dd.jpg';
import digitalArtImg from '../../assets/Slider/digital-digital-art-artwork-painting-drawing-hd-wallpaper-f4f3c52c24b9b5c33430781cded1b351.jpg';
import pixelArtImg from '../../assets/Slider/artistic-pixel-art-8-bit-wallpaper-5930082d711aed1bd6f7f82fd021962d.jpg';
import './SliderHero.css';

const items = [
  { image: kingfisherImg, caption: 'Low Poly' },
  { image: digitalArtImg, caption: 'Digital Art' },
  { image: pixelArtImg, caption: 'Pixel Art' }
];

const SliderHero = () => {
  return (
    <section className="slider-hero">
      <MorphSlider items={items} transition="melt" intensity={0.55} aberration={0.35} drift={0.4} autoplay />
    </section>
  );
};

export default SliderHero;
