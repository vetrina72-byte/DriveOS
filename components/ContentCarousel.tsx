import React, { useRef, useState, useEffect, useCallback } from 'react';
import PlaylistItem, { SpotifyItem as MediaItem } from './PlaylistItem';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const ContentCarousel = React.memo(({ title, items, isNight, onSelectItem, keyPrefix }: { title: string, items: MediaItem[], isNight: boolean, onSelectItem: (item: MediaItem, context?: MediaItem[]) => void, keyPrefix: string }) => {
  const validItems = Array.isArray(items) ? items.filter(item => item && item.id) : [];

  if (validItems.length === 0) return null;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const buttonBg = isNight ? 'bg-black/60 hover:bg-black/90' : 'bg-white/80 hover:bg-white';
  const buttonIconColor = isNight ? 'text-white' : 'text-black';

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isScrollable = el.scrollWidth > el.clientWidth;
    setCanScrollLeft(isScrollable && el.scrollLeft > 5);
    setCanScrollRight(isScrollable && el.scrollLeft < el.scrollWidth - el.clientWidth - 5);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollability();
    el.addEventListener('scroll', checkScrollability, { passive: true });
    window.addEventListener('resize', checkScrollability, { passive: true });

    return () => {
      el.removeEventListener('scroll', checkScrollability);
      window.removeEventListener('resize', checkScrollability);
    };
  }, [checkScrollability, validItems.length]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
        const scrollAmount = (scrollRef.current.clientWidth * 0.8) * (direction === 'left' ? -1 : 1);
        scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-6 sm:mb-8 relative content-auto">
      <h2 
        className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4 px-3 sm:px-6" 
        style={{ color: `var(--heading-color)` }}
      >
        {title}
      </h2>

      <button
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className={`absolute left-1 sm:left-2 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full shadow-md transition-opacity duration-300 disabled:opacity-0 disabled:pointer-events-none ${buttonBg}`}
          aria-label="Scroll left"
      >
          <FiChevronLeft className={`w-4 h-4 sm:w-6 sm:h-6 ${buttonIconColor}`} />
      </button>
      <button
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className={`absolute right-1 sm:right-2 top-1/2 -translate-y-1/2 z-10 p-2 sm:p-3 rounded-full shadow-md transition-opacity duration-300 disabled:opacity-0 disabled:pointer-events-none ${buttonBg}`}
          aria-label="Scroll right"
      >
          <FiChevronRight className={`w-4 h-4 sm:w-6 sm:h-6 ${buttonIconColor}`} />
      </button>

      <div
        ref={scrollRef}
        className="spotify-carousel gap-2.5 sm:gap-4 px-3 sm:px-6 overflow-x-auto flex scroll-smooth hide-scrollbar"
      >
        {validItems.map((item, index) => (
          <div className="py-1.5 sm:py-2 flex-shrink-0 w-32 sm:w-36 md:w-44 carousel-card-contain" key={`${keyPrefix}-${item.id || index}`}>
            <PlaylistItem item={item} isNight={isNight} onSelectItem={(selectedItem) => onSelectItem(selectedItem, items)} />
          </div>
        ))}
      </div>
    </section>
  );
});

ContentCarousel.displayName = 'ContentCarousel';

export default ContentCarousel;

