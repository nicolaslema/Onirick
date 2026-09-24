import { useEffect, useRef } from 'react';
import './Reveal.css';

// Reveal-on-scroll (PLAN.md 5.2, reused from the old Proof section): fades
// in and rises 16px the first time 35% of it is in view, then stays.
// Visible from the start under reduced motion. `as` lets it be a table row
// or list item instead of a wrapper div.
const Reveal = ({ as: Tag = 'div', className = '', children, ...props }) => {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add('is-visible');
          observer.disconnect();
        }
      },
      { threshold: 0.35 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <Tag ref={ref} className={`onk-reveal ${className}`.trim()} {...props}>
      {children}
    </Tag>
  );
};

export default Reveal;
