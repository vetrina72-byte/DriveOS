import React, { useRef, useState, useEffect } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

type Props = { children: React.ReactNode; isNight: boolean; };

const HorizontalCarousel: React.FC<Props> = ({ children, isNight }) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkScrollability = React.useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const isScrollable = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(isScrollable && el.scrollLeft > 5);
    setCanScrollRight(isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability);
    
    const resizeObserver = new ResizeObserver(checkScrollability);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
      resizeObserver.disconnect();
    };
  }, [checkScrollability]);

  const scrollBy = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    const amount = (el.clientWidth * 0.8) * dir;
    el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const buttonClasses = `absolute top-1/2 -translate-y-1/2 z-20 p-2 rounded-full transition-all duration-300 opacity-0 group-hover:opacity-100 disabled:opacity-0 disabled:pointer-events-none ${isNight ? 'bg-black/60 hover:bg-black/90 text-white' : 'bg-white/80 hover:bg-white text-black'}`;
  
  return (
    <div className="relative group">
      <button onClick={() => scrollBy(-1)} disabled={!canScrollLeft} className={`${buttonClasses} left-2`} aria-label="Scroll left"><FiChevronLeft size={24} /></button>
      <div ref={ref} className="spotify-carousel gap-4 px-6">
        {React.Children.map(children, child => (
            <div style={{ scrollSnapAlign: 'start' }} className="flex-shrink-0 w-32 sm:w-36 md:w-40 lg:w-44">{child}</div>
        ))}
      </div>
      <button onClick={() => scrollBy(1)} disabled={!canScrollRight} className={`${buttonClasses} right-2`} aria-label="Scroll right"><FiChevronRight size={24} /></button>
    </div>
  );
}

export default HorizontalCarousel;