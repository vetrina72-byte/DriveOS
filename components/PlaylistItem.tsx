import React from 'react';
import { FiMusic, FiMic, FiUser, FiHeart } from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa';

export interface SpotifyItem {
  id: string;
  name: string;
  uri: string;
  images?: { url: string }[];
  artists?: { name: string }[];
  description?: string;
  publisher?: string;
  type: 'playlist' | 'album' | 'track' | 'artist' | 'show' | 'category';
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
  // This property is specific to category items from the API
  icons?: { url: string }[];
  customImageUrl?: string;
}

const PlaylistItem = ({ item, isNight, onSelectItem, contextInfo }: { item: SpotifyItem, isNight: boolean, onSelectItem: (item: SpotifyItem) => void, contextInfo?: string }) => {
  const textColorPrimary = isNight ? 'text-white' : 'text-zinc-800';
  const textColorSecondary = isNight ? 'text-[#b3b3b3]' : 'text-zinc-500';
  const bgColor = isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10';
  const placeholderBg = isNight ? 'bg-zinc-800' : 'bg-zinc-300';
  const placeholderIconColor = isNight ? 'text-zinc-500' : 'text-zinc-600';

  // NEW: Render a special card for genres with custom images
  if (item.type === 'category' && item.customImageUrl) {
    return (
        <div
            onClick={() => onSelectItem(item)}
            className="relative w-44 h-56 rounded-lg overflow-hidden cursor-pointer group shadow-lg flex-shrink-0"
        >
            <div
                className="absolute inset-0 bg-cover bg-center transition-transform duration-300 ease-in-out group-hover:scale-110"
                style={{ backgroundImage: `url(${item.customImageUrl})` }}
                aria-hidden="true"
            />
            <div
                className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"
                aria-hidden="true"
            />
            <div className="relative h-full flex items-end justify-start p-3">
                <h3 className="text-white text-lg font-bold break-words" style={{ textShadow: '0 2px 5px rgba(0,0,0,0.6)' }}>
                    {item.name}
                </h3>
            </div>
        </div>
    );
  }


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
      default: return <FiMusic className={`w-10 h-10 ${placeholderIconColor}`} />;
    }
  }

  return (
    <div onClick={() => onSelectItem(item)} className={`p-3 rounded-lg transition-colors duration-200 cursor-pointer w-44 flex-shrink-0 ${bgColor}`}>
      <div className="relative w-full aspect-square mb-3">
        {imageUrl ? (
          <img src={imageUrl} alt={item.name} className="w-full h-full rounded-md object-cover shadow-lg" />
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