import React, { useRef } from 'react';
import PlaylistItem, { SpotifyItem as MediaItem } from './PlaylistItem';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.3
    }
  }
};

const ContentCarousel = ({ title, items, isNight, onSelectItem, keyPrefix }: { title: string, items: MediaItem[], isNight: boolean, onSelectItem: (item: MediaItem, context?: MediaItem[]) => void, keyPrefix: string }) => {
  const validItems = Array.isArray(items) ? items.filter(item => item && item.id) : [];

  if (validItems.length === 0) return null;
  
  const scrollRef = useRef<HTMLDivElement>(null);
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
      <h2 
        className="text-2xl font-bold mb-4 px-6" 
        style={{ color: `var(--heading-color)` }}
      >
        {title}
      </h2>

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

      <motion.div
        ref={scrollRef}
        className="spotify-carousel gap-4 px-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {validItems.map((item, index) => (
          <motion.div variants={itemVariants} key={`${keyPrefix}-${item.id || index}`}>
            <PlaylistItem item={item} isNight={isNight} onSelectItem={(selectedItem) => onSelectItem(selectedItem, items)} />
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};

export default ContentCarousel;