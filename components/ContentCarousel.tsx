
import React from 'react';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';

const ContentCarousel = ({ title, items, isNight, onPlay }: { title: string, items: SpotifyItem[], isNight: boolean, onPlay: (uri: string) => void }) => {
  if (!items || items.length === 0) return null;
  
  const textColor = isNight ? 'text-white' : 'text-zinc-900';

  return (
    <section className="mb-8">
      <h2 className={`text-2xl font-bold mb-4 px-6 ${textColor}`}>{title}</h2>
      <div className="flex gap-4 overflow-x-auto carousel-scrollbar-hidden px-6">
        {items.map((item, index) => (
          <PlaylistItem key={item.id || index} item={item} isNight={isNight} onPlay={onPlay} />
        ))}
      </div>
    </section>
  );
};

export default ContentCarousel;
