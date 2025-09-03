import React, { useState, useEffect } from 'react';
import { FiMusic, FiMic, FiUser, FiHeart, FiRadio } from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa';

export interface SpotifyItem {
  id: string;
  name: string;
  uri: string;
  images?: { url: string }[];
  artists?: { name: string }[];
  description?: string;
  publisher?: string;
  type: 'playlist' | 'album' | 'track' | 'artist' | 'show' | 'category' | 'station';
  album?: { name: string; images: { url: string }[] };
  explicit?: boolean;
  context?: {
      type: string;
      uri: string;
  };
  owner?: {
    display_name: string;
    id: string;
  };
  icons?: { url: string }[];
}

const PlaylistItem = ({ item, isNight, onSelectItem, contextInfo }: { item: SpotifyItem, isNight: boolean, onSelectItem: (item: SpotifyItem) => void, contextInfo?: string }) => {
  const [imageError, setImageError] = useState(false);
  const textColorPrimary = isNight ? 'text-white' : 'text-zinc-800';
  const textColorSecondary = isNight ? 'text-[#b3b3b3]' : 'text-zinc-500';
  const bgColor = isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10';
  const placeholderBg = isNight ? 'bg-zinc-800' : 'bg-zinc-300';
  const placeholderIconColor = isNight ? 'text-zinc-500' : 'text-zinc-600';
  
  // Reset image error state if the item changes
  useEffect(() => {
    setImageError(false);
  }, [item.id]);

  const handleImageError = () => {
    setImageError(true);
  };

  const getContextualDescription = (): string => {
    if (contextInfo) return contextInfo;

    switch (item.type) {
        case 'track':
            return item.artists?.map(a => a.name).join(', ') ?? '';
        case 'album':
            const artists = item.artists?.map(a => a.name).join(', ') ?? 'Artista Sconosciuto';
            return `Album • ${artists}`;
        case 'playlist':
            return item.description || `Di ${item.owner?.display_name ?? 'Spotify'}`;
        case 'artist':
            return 'Artista';
        case 'show':
            return item.publisher ?? 'Podcast';
        case 'category':
             return 'Genere';
        case 'station':
            return item.description || 'Stazione Radio';
        default:
            return item.description ?? '';
    }
  };

  const descriptionText = getContextualDescription();
  const sanitizedDescription = descriptionText.replace(/<[^>]*>?/gm, '');

  const imageUrl = item.images?.[0]?.url || item.album?.images?.[0]?.url || item.icons?.[0]?.url;

  // Special rendering for the "Liked Songs" playlist
  if (item.id === 'liked-songs') {
      return (
          <div onClick={() => onSelectItem(item)} className="p-3 rounded-lg transition-all duration-200 cursor-pointer w-44 flex-shrink-0 bg-gradient-to-br from-indigo-800 to-purple-800 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-105">
              <div className="relative w-full aspect-square mb-3 flex items-center justify-center">
                  <FiHeart className="w-16 h-16 text-white/90" />
              </div>
              <h3 className="font-bold truncate text-white">{item.name}</h3>
              <p className="text-sm truncate text-gray-300">{sanitizedDescription}</p>
          </div>
      );
  }

  const getPlaceholderIcon = () => {
    switch (item.type) {
      case 'artist': return <FiUser className={`w-10 h-10 ${placeholderIconColor}`} />;
      case 'show': return <FiMic className={`w-10 h-10 ${placeholderIconColor}`} />;
      case 'playlist': return <FaSpotify className={`w-10 h-10 ${placeholderIconColor}`} />;
      case 'category': return <FiMusic className={`w-10 h-10 ${placeholderIconColor}`} />;
      case 'station': return <FiRadio className={`w-10 h-10 ${placeholderIconColor}`} />;
      default: return <FiMusic className={`w-10 h-10 ${placeholderIconColor}`} />;
    }
  }

  return (
    <div onClick={() => onSelectItem(item)} className={`p-3 rounded-lg transition-colors duration-200 w-44 flex-shrink-0 ${bgColor} cursor-pointer`}>
      <div className="relative w-full aspect-square mb-3">
        {imageUrl && !imageError ? (
          <img 
            src={imageUrl} 
            alt={item.name} 
            className="w-full h-full rounded-md object-cover shadow-lg"
            loading="lazy"
            onError={handleImageError}
          />
        ) : (
          <div className={`w-full h-full rounded-md flex items-center justify-center ${placeholderBg}`}>
            {getPlaceholderIcon()}
          </div>
        )}
      </div>
      <h3 className={`font-bold truncate ${textColorPrimary}`}>{item.name}</h3>
      <p className={`text-sm truncate ${textColorSecondary}`}>{sanitizedDescription}</p>
    </div>
  );
};

export default PlaylistItem;