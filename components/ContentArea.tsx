import React from 'react';
import { Play, Pause, Sparkles, ArrowRight } from 'lucide-react';
import ContentCarousel from './ContentCarousel';
import { SpotifyItem as MediaItem } from './PlaylistItem';
import { useAuth, type SpotifyUser } from '@/context/AuthContext';
import { wikiSpotifyLogoUrl, officialSpotifyDjLogoUrl } from './TopNavBar';
import { isSpotifyAiDj, isSpotifyAiDjPlaying } from '../services/AiDjVisualState';

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
    onPlayDJ?: () => void;
    onOpenDjView?: () => void;
}

// Helper to filter out DJ items from standard carousels
const filterDjItems = (items: MediaItem[]) => {
  if (!Array.isArray(items)) return [];
  return items.filter(item => 
    item && 
    item.id !== 'spotify-dj' && 
    !item.uri?.includes('37i9dQZF1EYkqdzj48dyYq') &&
    !item.name?.toLowerCase().includes('spotify dj') &&
    item.name?.trim().toLowerCase() !== 'dj' &&
    item.name?.trim().toLowerCase() !== 'dj spotify'
  );
};

// Main Component
const ContentArea = React.memo(({ 
    isNight, 
    onSelectItem, 
    onPlayDJ,
    onOpenDjView,
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
  const { nowPlaying, play, pauseSpotify } = useAuth();

  const isDjActive = React.useMemo(() => {
    if (!nowPlaying?.spotifyState) return false;
    return isSpotifyAiDj(nowPlaying.spotifyState);
  }, [nowPlaying]);

  const isDjPlaying = React.useMemo(() => {
    return isDjActive && isSpotifyAiDjPlaying(nowPlaying?.spotifyState);
  }, [isDjActive, nowPlaying]);

  const handleToggleDjPlayback = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onPlayDJ) {
      onPlayDJ();
      return;
    }
    if (isDjPlaying) {
      pauseSpotify();
    } else if (isDjActive) {
      play({ context_uri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq' });
    } else {
      const djItem: MediaItem = {
        id: 'spotify-dj',
        name: 'DJ Spotify',
        type: 'playlist',
        uri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq',
        description: 'Spotify AI DJ',
        imageUrl: officialSpotifyDjLogoUrl,
      };
      play({ context_uri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq' }, djItem);
    }
  };

  const filteredContinue = React.useMemo(() => filterDjItems(continueListeningItems), [continueListeningItems]);
  const filteredMadeForYou = React.useMemo(() => filterDjItems(madeForYou), [madeForYou]);
  const filteredMadeForYouPlaylists = React.useMemo(() => filterDjItems(madeForYouPlaylists), [madeForYouPlaylists]);
  const filteredUserPlaylists = React.useMemo(() => filterDjItems(userPlaylists), [userPlaylists]);
  const filteredCharts = React.useMemo(() => filterDjItems(chartsPlaylists), [chartsPlaylists]);
  const filteredParty = React.useMemo(() => filterDjItems(partyPlaylists), [partyPlaylists]);
  const filteredTopArtists = React.useMemo(() => filterDjItems(topArtists), [topArtists]);
  const filteredNewReleases = React.useMemo(() => filterDjItems(newReleases), [newReleases]);
  const filteredShows = React.useMemo(() => filterDjItems(recommendedShows), [recommendedShows]);
  const filteredTopTracks = React.useMemo(() => filterDjItems(topTracks), [topTracks]);
  const filteredArtistRadio = React.useMemo(() => filterDjItems(artistRadioTracks), [artistRadioTracks]);
  const filteredTrackRecs = React.useMemo(() => filterDjItems(trackRecommendations), [trackRecommendations]);
  const filteredSavedAlbums = React.useMemo(() => filterDjItems(savedAlbums), [savedAlbums]);
  const filteredGenres = React.useMemo(() => filterDjItems(genresCategories), [genresCategories]);

  const hasAnyContent = (
    filteredContinue.length > 0 ||
    filteredMadeForYou.length > 0 ||
    filteredUserPlaylists.length > 0 ||
    filteredNewReleases.length > 0 ||
    filteredCharts.length > 0
  );

  if (loading && !hasAnyContent) {
      return (
          <div className="flex-1 min-h-0 overflow-y-auto pb-6 hide-scrollbar">
              <h1 className="text-3xl font-bold mb-8 px-6 text-transparent animate-pulse bg-gray-600/20 w-1/2 rounded-md h-9">.</h1>
              <SkeletonCarousel isNight={isNight} />
              <SkeletonCarousel isNight={isNight} />
              <SkeletonCarousel isNight={isNight} />
          </div>
      );
  }

  if (error && !hasAnyContent) {
      return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-6 hide-scrollbar">
      <h1 
        className="text-xl sm:text-2xl md:text-3xl font-bold mb-4 sm:mb-6 px-3 sm:px-6"
        style={{ color: 'var(--heading-color)' }}
      >
        {greeting}, {user?.display_name}!
      </h1>

      {/* Spotify DJ Feature Card with Clean Black & White Aesthetic */}
      <div className="px-3 sm:px-6 mb-6 sm:mb-8">
        <div 
          className={`relative overflow-hidden rounded-2xl p-3.5 sm:p-5 border transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 ${
            isNight 
              ? 'bg-[#121212] border-zinc-800 hover:border-zinc-700 shadow-lg' 
              : 'bg-white border-zinc-200 hover:border-zinc-300 shadow-sm'
          }`}
        >
          <div 
            onClick={() => onOpenDjView?.()}
            className="flex items-center gap-3 sm:gap-4 relative z-10 cursor-pointer group min-w-0"
          >
            <div className="flex-shrink-0 relative">
              <img 
                src={officialSpotifyDjLogoUrl} 
                alt="Spotify AI DJ Logo" 
                className="w-10 h-10 sm:w-14 sm:h-14 rounded-xl flex-shrink-0 object-cover shadow-md border border-white/10 group-hover:scale-105 transition-transform" 
                referrerPolicy="no-referrer" 
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-0.5 sm:mb-1 flex-wrap">
                <span className={`text-sm sm:text-base font-bold group-hover:text-[#1db954] transition-colors ${isNight ? 'text-white' : 'text-zinc-900'}`}>
                  Spotify AI DJ
                </span>
                {isDjActive && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    isNight 
                      ? 'bg-zinc-800 text-zinc-300 border-zinc-700' 
                      : 'bg-zinc-100 text-zinc-700 border-zinc-300'
                  }`}>
                    {isDjPlaying ? 'In riproduzione' : 'In pausa'}
                  </span>
                )}
              </div>
              <p className={`text-[11px] sm:text-xs ${isNight ? 'text-zinc-400' : 'text-zinc-600'} max-w-md leading-relaxed truncate sm:whitespace-normal`}>
                La tua guida musicale personale con selezione intelligente dei brani e commenti vocali dedicati.
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => onOpenDjView?.()}
              className={`px-3.5 py-2 rounded-full font-bold text-xs transition-colors border cursor-pointer ${
                isNight 
                  ? 'bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700' 
                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300'
              }`}
            >
              Scopri AI DJ
            </button>

            <button
              onClick={handleToggleDjPlayback}
              className={`flex-shrink-0 px-5 py-2.5 rounded-full font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 text-black cursor-pointer ${
                isDjPlaying
                  ? 'bg-white hover:bg-zinc-200 shadow-md'
                  : 'bg-[#1db954] hover:bg-[#1ed760] active:scale-95 shadow-md shadow-emerald-500/10'
              }`}
            >
              {isDjPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  Pausa
                </>
              ) : isDjActive ? (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Riprendi
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  Avvia DJ
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {filteredContinue.length > 0 && (
          <div>
              <ContentCarousel title="Continua ad ascoltare" items={filteredContinue} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="continue-listening" />
          </div>
      )}
       {filteredMadeForYou.length > 0 && (
          <div>
              <ContentCarousel title="Realizzato per te" items={filteredMadeForYou} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you-new" />
          </div>
      )}
       {filteredMadeForYouPlaylists.length > 0 && (
          <div>
              <ContentCarousel title="Le playlist create per te" items={filteredMadeForYouPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="made-for-you" />
          </div>
      )}
      {filteredUserPlaylists.length > 0 && (
          <div>
              <ContentCarousel title="Le tue playlist" items={filteredUserPlaylists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="user-playlists" />
          </div>
      )}
      {filteredCharts.length > 0 && (
          <div>
              <ContentCarousel title="Classifiche" items={filteredCharts} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="charts" />
          </div>
      )}
      {filteredParty.length > 0 && (
        <div>
            <ContentCarousel 
                title="Musica da cantare" 
                items={filteredParty} 
                isNight={isNight} 
                onSelectItem={onSelectItem} 
                keyPrefix="party-playlists" 
            />
        </div>
      )}
      {filteredTopArtists.length > 0 && (
          <div>
              <ContentCarousel title="I tuoi artisti del momento" items={filteredTopArtists} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-artists" />
          </div>
      )}
      {filteredNewReleases.length > 0 && (
          <div>
              <ContentCarousel title="Nuove uscite" items={filteredNewReleases} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="new-releases" />
          </div>
      )}
      {filteredShows.length > 0 && (
          <div>
              <ContentCarousel title="Podcast consigliati" items={filteredShows} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="rec-shows" />
          </div>
      )}
      {filteredTopTracks.length > 0 && (
          <div>
              <ContentCarousel title="Un tuffo nel passato" items={filteredTopTracks} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="top-tracks" />
          </div>
      )}
      {filteredArtistRadio.length > 0 && topArtists.length > 0 && (
          <div>
              <ContentCarousel title={`Radio di ${topArtists[0].name}`} items={filteredArtistRadio} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="artist-radio" />
          </div>
      )}
      {filteredTrackRecs.length > 0 && (
          <div>
              <ContentCarousel title="Potrebbe piacerti anche" items={filteredTrackRecs} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="track-recs" />
          </div>
      )}
      {filteredSavedAlbums.length > 0 && (
          <div>
              <ContentCarousel title="I tuoi album salvati" items={filteredSavedAlbums} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="saved-albums" />
          </div>
      )}
      {filteredGenres.length > 0 && (
          <div>
              <ContentCarousel title="Esplora per generi e mood" items={filteredGenres} isNight={isNight} onSelectItem={onSelectItem} keyPrefix="genres" />
          </div>
      )}
    </div>
  );
});

ContentArea.displayName = 'ContentArea';

export default ContentArea;