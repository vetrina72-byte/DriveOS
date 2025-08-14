
import React from 'react';
import { FiMusic } from 'react-icons/fi';

export interface SpotifyItem {
  id: string;
  name: string;
  uri: string;
  images: { url: string }[];
  artists?: { name: string }[];
  description?: string;
  type: 'playlist' | 'album' | 'track';
}

const PlaylistItem = ({ item, isNight, onSelectItem }: { item: SpotifyItem, isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
  const textColorPrimary = isNight ? 'text-white' : 'text-zinc-800';
  const textColorSecondary = isNight ? 'text-[#b3b3b3]' : 'text-zinc-500';
  const bgColor = isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10';
  const placeholderBg = isNight ? 'bg-zinc-800' : 'bg-zinc-300';
  const placeholderIconColor = isNight ? 'text-zinc-500' : 'text-zinc-600';

  let descriptionText = '';
  if (item.type === 'track' && item.artists) {
    descriptionText = item.artists.map(a => a.name).join(', ');
  } else if (item.description) {
    descriptionText = item.description;
  } else if (item.type === 'album' && item.artists) {
     descriptionText = item.artists.map(a => a.name).join(', ');
  }

  // Sanitize description to remove HTML tags that sometimes appear in Spotify descriptions
  const sanitizedDescription = descriptionText.replace(/<[^>]*>?/gm, '');

  return (
    <div onClick={() => onSelectItem(item)} className={`p-3 rounded-lg transition-colors duration-200 cursor-pointer w-44 flex-shrink-0 ${bgColor}`}>
      <div className="relative w-full aspect-square mb-3">
        {item.images?.[0]?.url ? (
          <img src={item.images[0].url} alt={item.name} className="w-full h-full rounded-md object-cover shadow-lg" />
        ) : (
          <div className={`w-full h-full rounded-md flex items-center justify-center ${placeholderBg}`}>
            <FiMusic className={`w-10 h-10 ${placeholderIconColor}`} />
          </div>
        )}
      </div>
      <h3 className={`font-bold truncate ${textColorPrimary}`}>{item.name}</h3>
      <p className={`text-sm truncate ${textColorSecondary}`}>{sanitizedDescription}</p>
    </div>
  );
};

export default PlaylistItem;