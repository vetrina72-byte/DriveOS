import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiMusic } from 'react-icons/fi';

export default function SpotifyMiniPlayer({ 
    isNight, 
    onArtistClick,
    isAppOpen
}: { 
    isNight: boolean;
    onArtistClick: (artistId: string) => void;
    isAppOpen: boolean;
}) {
  const { playerState, player, isAuthenticated } = useAuth();
  const [progress, setProgress] = useState(0);

  const currentTrack = playerState?.track_window.current_track;
  const isPaused = playerState?.paused;

  useEffect(() => {
    if (!playerState || !currentTrack) return;

    if (isPaused) {
      setProgress((playerState.position / playerState.duration) * 100);
      return;
    }

    const interval = setInterval(() => {
        player?.getCurrentState().then(state => {
            if (state) {
                setProgress((state.position / state.duration) * 100);
            }
        })
    }, 1000);

    return () => clearInterval(interval);
  }, [playerState, currentTrack, isPaused, player]);
  
  const theme = {
    bg: isNight ? 'bg-zinc-800/80' : 'bg-white/90',
    textPrimary: isNight ? 'text-white' : 'text-black',
    textSecondary: isNight ? 'text-zinc-400' : 'text-zinc-600',
    buttonHover: isNight ? 'hover:text-white' : 'hover:text-black',
    backdropBlur: 'backdrop-blur-lg',
  };
  
  const handleArtistClick = (e: React.MouseEvent, artistId: string) => {
      e.stopPropagation();
      onArtistClick(artistId);
  }

  if (!isAuthenticated) {
      return null;
  }
  
  const positionClasses = isAppOpen 
    ? 'left-5 translate-x-0' 
    : 'left-1/2 -translate-x-1/2';

  return (
    <div 
        className={`fixed bottom-5 z-40 rounded-xl shadow-2xl flex items-center p-2 gap-3 w-80 transition-all duration-500 ease-out ${theme.bg} ${theme.backdropBlur} ${positionClasses}`}
    >
      {currentTrack ? (
        <img src={currentTrack.album.images[0].url} alt={currentTrack.album.name} className="w-14 h-14 rounded-md" />
      ) : (
        <div className={`w-14 h-14 rounded-md flex items-center justify-center ${isNight ? 'bg-zinc-700' : 'bg-gray-200'}`}>
            <FiMusic className={theme.textSecondary} size={28}/>
        </div>
      )}
      <div className="flex-grow overflow-hidden relative pt-1">
        <p className={`font-bold whitespace-nowrap ${theme.textPrimary}`}>
            {currentTrack ? currentTrack.name : 'Nessuna riproduzione'}
        </p>
        <p className={`text-sm whitespace-nowrap ${theme.textSecondary}`}>
            {currentTrack ? (
                currentTrack.artists.map((artist, index) => (
                    <React.Fragment key={artist.uri}>
                        <button onClick={(e) => handleArtistClick(e, artist.uri.split(':')[2])} className="hover:underline">
                            {artist.name}
                        </button>
                        {index < currentTrack.artists.length - 1 && ', '}
                    </React.Fragment>
                ))
            ) : 'Controlli Spotify'}
        </p>
        {currentTrack && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gray-500/30">
                <div className="h-full bg-green-500" style={{ width: `${progress}%`, transition: 'width 0.5s linear' }}></div>
            </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <button onClick={() => player?.previousTrack()} className={`p-1 ${theme.textSecondary} ${theme.buttonHover}`} disabled={!currentTrack}>
          <FiSkipBack />
        </button>
        <button onClick={() => player?.togglePlay()} className={`p-1 ${theme.textSecondary} ${theme.buttonHover}`} disabled={!currentTrack}>
          {isPaused ? <FiPlay /> : <FiPause />}
        </button>
        <button onClick={() => player?.nextTrack()} className={`p-1 ${theme.textSecondary} ${theme.buttonHover}`} disabled={!currentTrack}>
          <FiSkipForward />
        </button>
      </div>
    </div>
  );
}
