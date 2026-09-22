import AccordionGallery from '../../AccordionGallery/AccordionGallery';
import heroImg from '../../../assets/hero.png';
import kingfisherImg from '../../../assets/Slider/animals-birds-kingfisher-low-poly-wallpaper-790078ad012a3d8b1677f8bfe081d6dd.jpg';
import digitalArtImg from '../../../assets/Slider/digital-digital-art-artwork-painting-drawing-hd-wallpaper-f4f3c52c24b9b5c33430781cded1b351.jpg';
import pixelArtImg from '../../../assets/Slider/artistic-pixel-art-8-bit-wallpaper-5930082d711aed1bd6f7f82fd021962d.jpg';
import './Gallery.css';

// Placeholder items — swap in real work samples.
const ITEMS = [
  { image: kingfisherImg, label: 'Low Poly' },
  { image: digitalArtImg, label: 'Digital Art' },
  { image: pixelArtImg, label: 'Pixel Art' },
  { image: heroImg, label: 'Vite Hero' }
];

const Gallery = () => {
  return (
    <section className="portfolio-gallery">
      <h2 className="portfolio-gallery-title">Gallery</h2>
      <div className="portfolio-gallery-stage">
        <AccordionGallery items={ITEMS} defaultIndex={1} expandRatio={0.5} height={520} trigger="hover" />
      </div>
    </section>
  );
};

export default Gallery;
