import React from 'react';
import ContentCarousel from './ContentCarousel';
import { SpotifyItem as MediaItem } from './PlaylistItem';
import type { SpotifyUser } from '@/context/AuthContext';

// Helper for dynamic greeting
const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Buongiorno";
  if (hour < 18) return "Buon pomeriggio";
  return "Buonasera";
};

const SkeletonCarousel = ({ isNight }: { isNight: boolean }) => {
    const bgColor = isNight ? 'bg-white/5' : 'bg-black/5';
    return (
        <div className="mb-8 px-6 animate-pulse">
            <div className={`h-8 w-1/3 rounded-md mb-4 ${bgColor}`}></div>
            <div className="flex gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className={`flex-shrink-0 w-44`}>
                        <div className={`w-full aspect-square rounded-md ${bgColor}`}></div>
                        <div className={`h-4 w-full rounded-md mt-3 ${bgColor}`}></div>
                        <div className={`h-3 w-2/3 rounded-md mt-2 ${bgColor}`}></div>
                    </div>
                ))}
            </div>
        </div>
    );
};

interface ContentAreaProps {
    isNight: boolean;
    onSelectItem: (item: MediaItem) => void;
    loading: boolean;
    error: string | null;
    user: SpotifyUser | null;
    continueListeningItems: MediaItem[];
    newReleases: MediaItem[];
    userPlaylists: MediaItem[];
    madeForYouPlaylists: MediaItem[];
    topArtists: MediaItem[];
    chartsPlaylists: MediaItem[];
    genresCategories: MediaItem[];
    recommendedShows: MediaItem[];
    partyPlaylists: MediaItem[];
    topTracks: MediaItem[];
    artistRadioTracks: MediaItem[];
    trackRecommendations: MediaItem[];
    savedAlbums: MediaItem[];
    madeForYou: MediaItem[];
}

// Main Component
const ContentArea = ({ 
    isNight, 
    onSelectItem, 
    loading,
    error,
    user,
    continueListeningItems,
    newReleases,
    userPlaylists,
    madeForYouPlaylists,
    topArtists,
    chartsPlaylists,
    genresCategories,
    recommendedShows,
    partyPlaylists,
    topTracks,
    artistRadioTracks,
    trackRecommendations,
    savedAlbums,
    madeForYou,
}: ContentAreaProps) => {
  
  const greeting = getGreeting();

  if (loading) {
      return (
          <div className="flex-1 min-h-0 overflow-y-auto pb-6 hide-scrollbar">
              <h1 className="text-3xl font-bold mb-8 px-6 text-transparent animate-pulse bg-gray-600/20 w-1/2 rounded-md h-9">.</h1>
              <SkeletonCarousel isNight={isNight} />
              <SkeletonCarousel isNight={isNight} />
              <SkeletonCarousel isNight={isNight} />
          </div>
      );
  }

  if (error) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-6 hide-scrollbar">
      <h1 
        className="text-3xl font-bold mb-8 px-6"
        style={{ color: 'var(--heading-color)' }}
      >
        {greeting}, {user?.display_name}!
      </h1>
      
      {continueListeningItems.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '100ms' }}>
              <ContentCarousel title="Continua ad ascoltare" items={continueListeningItems} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="continue-listening" />
          </div>
      )}
       {madeForYou.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '120ms' }}>
              <ContentCarousel title="Realizzato per te" items={madeForYou} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you-new" />
          </div>
      )}
       {madeForYouPlaylists.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '150ms' }}>
              <ContentCarousel title="Le playlist create per te" items={madeForYouPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you" />
          </div>
      )}
      {userPlaylists.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '200ms' }}>
              <ContentCarousel title="Le tue playlist" items={userPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-playlists" />
          </div>
      )}
      {chartsPlaylists.length > 0 && (
           <div className="animate-fadeInUp" style={{ animationDelay: '250ms' }}>
              <ContentCarousel title="Classifiche" items={chartsPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="charts" />
          </div>
      )}
      {partyPlaylists.length > 0 && (
        <div className="animate-fadeInUp" style={{ animationDelay: '280ms' }}>
            <ContentCarousel 
                title="Musica da cantare" 
                items={partyPlaylists} 
                isNight={isNight} 
                onSelectItem={onSelectItem} 
                keyPrefix="party-playlists" 
            />
        </div>
      )}
      {topArtists.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '300ms' }}>
              <ContentCarousel title="I tuoi artisti del momento" items={topArtists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artists" />
          </div>
      )}
      {newReleases.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '350ms' }}>
              <ContentCarousel title="Nuove uscite" items={newReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
          </div>
      )}
      {recommendedShows.length > 0 && (
           <div className="animate-fadeInUp" style={{ animationDelay: '400ms' }}>
              <ContentCarousel title="Podcast consigliati" items={recommendedShows} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="rec-shows" />
          </div>
      )}
      {topTracks.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '500ms' }}>
              <ContentCarousel title="Un tuffo nel passato" items={topTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-tracks" />
          </div>
      )}
      {artistRadioTracks.length > 0 && topArtists.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '550ms' }}>
              <ContentCarousel title={`Radio di ${topArtists[0].name}`} items={artistRadioTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="artist-radio" />
          </div>
      )}
      {trackRecommendations.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '600ms' }}>
              <ContentCarousel title="Potrebbe piacerti anche" items={trackRecommendations} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="track-recs" />
          </div>
      )}
      {savedAlbums.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '650ms' }}>
              <ContentCarousel title="I tuoi album salvati" items={savedAlbums} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="saved-albums" />
          </div>
      )}
      {genresCategories.length > 0 && (
          <div className="animate-fadeInUp" style={{ animationDelay: '450ms' }}>
              <ContentCarousel title="Esplora per generi e mood" items={genresCategories} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="genres" />
          </div>
      )}
    </div>
  );
};

export default ContentArea;