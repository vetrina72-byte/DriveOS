
import React, { useRef } from 'react';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';

const ContentCarousel = ({ title, items, isNight, onSelectItem, keyPrefix }: { title: string, items: SpotifyItem[], isNight: boolean, onSelectItem: (item: SpotifyItem) => void, keyPrefix: string }) => {
  const validItems = Array.isArray(items) ? items.filter(item => item && item.id) : [];

  if (validItems.length === 0) return null;
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const textColor = isNight ? 'text-white' : 'text-zinc-900';
  const buttonBg = isNight ? 'bg-black/60 hover:bg-black/90' : 'bg-white/80 hover:bg-white';
  const buttonIconColor = isNight ? 'text-white' : 'text-black';

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
        const scrollAmount = direction === 'left' ? -500 : 500;
        scrollRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="mb-8 relative group">
      <h2 className={`text-2xl font-bold mb-4 px-6 ${textColor}`}>{title}</h2>

      <button
          onClick={() => scroll('left')}
          className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full shadow-md transition-all duration-300 opacity-0 group-hover:opacity-100 disabled:opacity-0 ${buttonBg}`}
          aria-label="Scroll left"
      >
          <FiChevronLeft className={`w-6 h-6 ${buttonIconColor}`} />
      </button>
      <button
          onClick={() => scroll('right')}
          className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full shadow-md transition-all duration-300 opacity-0 group-hover:opacity-100 disabled:opacity-0 ${buttonBg}`}
          aria-label="Scroll right"
      >
          <FiChevronRight className={`w-6 h-6 ${buttonIconColor}`} />
      </button>

      <div ref={scrollRef} className="spotify-carousel gap-4 px-6">
        {validItems.map((item, index) => (
          <PlaylistItem key={`${keyPrefix}-${item.id || index}`} item={item} isNight={isNight} onSelectItem={onSelectItem} />
        ))}
      </div>
    </section>
  );
};

export default ContentCarousel;
