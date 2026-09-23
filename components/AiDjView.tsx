import React, { useState, useEffect } from 'react';
import { Play, Pause, Radio, Sparkles, Volume2, Music, Disc, Activity } from 'lucide-react';
import { officialSpotifyDjLogoUrl } from './TopNavBar';
import { useAuth } from '../context/AuthContext';
import { SpotifyItem as MediaItem } from './PlaylistItem';
import ContentCarousel from './ContentCarousel';
import { isSpotifyAiDj, isSpotifyAiDjPlaying, aiDjAudioAnalyzer } from '../services/AiDjAudioAnalyzer';
import { AiDjAudioMonitor } from './AiDjAudioMonitor';

interface AiDjViewProps {
  isNight: boolean;
  onSelectItem: (item: MediaItem) => void;
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

export const AiDjView: React.FC<AiDjViewProps> = ({ isNight, onSelectItem }) => {
  const { nowPlaying, play, pauseSpotify, madeForYouPlaylists, continueListeningItems } = useAuth();

  // Filter out any duplicate DJ items from history carousels
  const filteredContinue = React.useMemo(() => filterDjItems(continueListeningItems), [continueListeningItems]);
  const filteredMadeForYou = React.useMemo(() => filterDjItems(madeForYouPlaylists), [madeForYouPlaylists]);

  // Check if current playback is Spotify AI DJ
  const isDjActive = React.useMemo(() => {
    if (!nowPlaying?.spotifyState) return false;
    return isSpotifyAiDj(nowPlaying.spotifyState);
  }, [nowPlaying]);

  const isDjPlaying = React.useMemo(() => {
    return isDjActive && isSpotifyAiDjPlaying(nowPlaying?.spotifyState);
  }, [isDjActive, nowPlaying]);

  const currentTrack = nowPlaying?.spotifyState?.track_window?.current_track;

  const handleToggleDj = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    console.log('[AI DJ FLOW] USER CLICK -> AI DJ START HANDLER (AiDjView hero button)');
    if (!aiDjAudioAnalyzer.isLoopbackActive()) {
      aiDjAudioAnalyzer.startLoopbackCapture().catch((err) => {
        console.error('[AI DJ CAPTURE] startLoopbackCapture rejected from AiDjView:', err);
      });
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
        description: 'La tua guida musicale con selezione intelligente di brani e commenti AI',
        imageUrl: officialSpotifyDjLogoUrl,
      };
      play({ context_uri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq' }, djItem);
    }
  };

  const djFeatures = [
    {
      icon: <Radio className="w-5 h-5" />,
      title: 'Voce & Commenti AI',
      description: 'L\'AI DJ introduce i brani in italiano con curiosità sugli artisti, aneddoti e novità musicali.',
    },
    {
      icon: <Activity className="w-5 h-5 text-emerald-400" />,
      title: 'Glow Smeraldo Esclusivo',
      description: 'Il player si illumina con l\'iconico glow verde smeraldo quando Spotify AI DJ è attivo.',
    },
    {
      icon: <Disc className="w-5 h-5" />,
      title: 'Cambia Atmosfera al Volo',
      description: 'Tocca il pulsante Cambia Mood durante la riproduzione per passare ad un nuovo genere musicale.',
    },
  ];

  // Internal debug flag: keep false in production so no diagnostic UI is visible
  const SHOW_DEBUG_AUDIO_MONITOR = false;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto pb-10 hide-scrollbar px-6 pt-2">
      {/* Hero Banner Container - Strict Spotify Black & White Aesthetic */}
      <div 
        className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 border mb-8 transition-all duration-300 ${
          isNight 
            ? 'bg-[#121212] border-zinc-800 shadow-xl' 
            : 'bg-white border-zinc-200 shadow-md'
        }`}
      >
        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Left: Artwork & Details */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
            <div className="relative flex-shrink-0">
              <img 
                src={officialSpotifyDjLogoUrl} 
                alt="Spotify AI DJ" 
                className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl object-cover shadow-2xl border border-white/10"
                referrerPolicy="no-referrer"
              />
              {isDjPlaying && (
                <div className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full bg-[#1db954] text-black text-[10px] font-extrabold uppercase tracking-wider flex items-center shadow-md">
                  Live
                </div>
              )}
            </div>

            <div className="flex flex-col justify-center">
              <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                  isDjPlaying 
                    ? 'bg-[#1db954]/20 text-[#1db954] border border-[#1db954]/30' 
                    : isDjActive 
                      ? 'bg-zinc-800 text-zinc-300 border border-zinc-700' 
                      : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                }`}>
                  {isDjPlaying ? 'In riproduzione' : isDjActive ? 'In pausa' : 'Pronto'}
                </span>
                <span className={`text-xs font-semibold flex items-center gap-1 ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  <Sparkles className="w-3.5 h-3.5 text-[#1db954]" /> AI DJ
                </span>
              </div>

              <h1 className={`text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 ${isNight ? 'text-white' : 'text-zinc-900'}`}>
                Spotify AI DJ
              </h1>

              <p className={`text-xs sm:text-sm max-w-lg leading-relaxed ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                La tua guida musicale personalizzata in tempo reale. Ascolta brani selezionati per te con commenti vocali dedicati agli artisti che ami.
              </p>
            </div>
          </div>

          {/* Right: Primary Action Button & Loopback Audio Toggle */}
          <div className="flex-shrink-0 w-full sm:w-auto flex flex-col items-center sm:items-end gap-2.5">
            <button
              onClick={handleToggleDj}
              className={`w-full sm:w-auto px-8 py-3.5 rounded-full font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2.5 active:scale-95 cursor-pointer shadow-lg ${
                isDjPlaying
                  ? 'bg-white hover:bg-zinc-200 text-black'
                  : 'bg-[#1db954] hover:bg-[#1ed760] text-black shadow-[#1db954]/20'
              }`}
            >
              {isDjPlaying ? (
                <>
                  <Pause className="w-5 h-5 fill-current" />
                  <span>Metti in pausa DJ</span>
                </>
              ) : isDjActive ? (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Riprendi DJ</span>
                </>
              ) : (
                <>
                  <Play className="w-5 h-5 fill-current" />
                  <span>Avvia Spotify AI DJ</span>
                </>
              )}
            </button>

            <span className={`text-[11px] font-medium ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`}>
              {isDjActive ? (isDjPlaying ? 'In riproduzione' : 'In pausa') : 'Tocca per iniziare'}
            </span>
          </div>
        </div>

        {/* Current DJ Track Bar (If Active) */}
        {isDjActive && currentTrack && (
          <div className={`mt-6 pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-4 ${
            isNight ? 'border-zinc-800' : 'border-zinc-200'
          }`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
                {currentTrack.album?.images?.[0]?.url ? (
                  <img src={currentTrack.album.images[0].url} alt={currentTrack.name} className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 text-zinc-400 m-auto mt-2.5" />
                )}
              </div>
              <div>
                <span className={`block text-xs font-bold line-clamp-1 ${isNight ? 'text-white' : 'text-zinc-900'}`}>
                  {currentTrack.name}
                </span>
                <span className={`block text-[11px] ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {currentTrack.artists?.[0]?.name || 'Artista'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                isDjPlaying
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : isNight 
                    ? 'bg-zinc-800 text-zinc-400 border-zinc-700' 
                    : 'bg-zinc-100 text-zinc-600 border-zinc-300'
              }`}>
                <Volume2 className={`w-3.5 h-3.5 ${isDjPlaying ? 'text-emerald-400' : 'text-zinc-400'}`} />
                {isDjPlaying ? 'Sessione DJ attiva' : 'In pausa'}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Internal diagnostic monitor (rendered only if SHOW_DEBUG_AUDIO_MONITOR is true) */}
      {SHOW_DEBUG_AUDIO_MONITOR && (
        <div className="mb-8">
          <AiDjAudioMonitor isDjActive={isDjActive} isDjPlaying={isDjPlaying} isNight={isNight} />
        </div>
      )}

      {/* Feature Explanation Section */}
      <div className="mb-10">
        <h2 className={`text-base font-bold mb-4 ${isNight ? 'text-white' : 'text-zinc-900'}`}>
          Come funziona Spotify AI DJ
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {djFeatures.map((feat, idx) => (
            <div 
              key={idx}
              className={`p-5 rounded-xl border transition-all ${
                isNight 
                  ? 'bg-[#121212] border-zinc-800/80 hover:border-zinc-700' 
                  : 'bg-white border-zinc-200 hover:border-zinc-300'
              }`}
            >
              <div className={`p-2.5 rounded-lg w-fit mb-3 ${isNight ? 'bg-zinc-800 text-emerald-400' : 'bg-emerald-50 text-emerald-600'}`}>
                {feat.icon}
              </div>
              <h3 className={`font-bold text-sm mb-1.5 ${isNight ? 'text-white' : 'text-zinc-900'}`}>
                {feat.title}
              </h3>
              <p className={`text-xs leading-relaxed ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {feat.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Mixes & Playlists for DJ listeners */}
      {filteredMadeForYou.length > 0 && (
        <div className="mb-8">
          <ContentCarousel 
            title="Mix e Playlist per te" 
            items={filteredMadeForYou} 
            isNight={isNight} 
            onSelectItem={onSelectItem} 
            keyPrefix="dj-recommended-mixes" 
          />
        </div>
      )}

      {filteredContinue.length > 0 && (
        <div>
          <ContentCarousel 
            title="Per il tuo ascolto" 
            items={filteredContinue} 
            isNight={isNight} 
            onSelectItem={onSelectItem} 
            keyPrefix="dj-recent-history" 
          />
        </div>
      )}
    </div>
  );
};

export default AiDjView;

