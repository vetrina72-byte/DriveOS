import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay, FiMic } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { PodcastService, Episode } from '../services/PodcastService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { duration: 0.3 } }
};

interface Show {
    id: string;
    name: string;
    publisher: string;
    description: string;
    images: { url: string }[];
    uri: string;
}

interface ShowDetailViewProps {
    showId: string;
    showName?: string;
    isNight: boolean;
    onPlay: (options: { uris?: string[] }) => void;
}

const AnimatedEqualizer = ({ className }: { className?: string; }) => (
    <div className={`flex items-end justify-center w-4 h-4 gap-0.5 ${className}`}>
      <style>{`
        @keyframes equalizer-bar {
          0%, 100% { height: 20%; }
          50% { height: 100%; }
        }
      `}</style>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '0s' }}></span>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.2s' }}></span>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.4s' }}></span>
      <span className="w-1 bg-current" style={{ animation: 'equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.6s' }}></span>
    </div>
);

const formatDuration = (ms: number) => {
    const totalMinutes = Math.floor(ms / 60000);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
        return `${hours} h ${minutes} min`;
    }
    return `${minutes} min`;
};

const ShowDetailView: React.FC<ShowDetailViewProps> = ({ showId, showName, isNight, onPlay }) => {
    const [show, setShow] = useState<Show | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [offset, setOffset] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [playError, setPlayError] = useState<string | null>(null);
    
    const { nowPlaying, isPlayerReady, setNowPlaying, triggerDataRefresh, _setPlayerState } = useAuth();
    const playerState = nowPlaying.spotifyState;
    const isPlayingContext = playerState && !playerState.paused;
    const currentTrackId = playerState?.track_window?.current_track?.id;
    
    useEffect(() => {
        let isMounted = true;
        
        async function loadData() {
            if (!showId) return;
            
            setLoading(true);
            setErrorMessage(null);
            setShow(null);
            setEpisodes([]);
            setOffset(0);
            setHasMore(true);

            try {
                // 1. Fetch Dettagli Show/Playlist (Header)
                const cleanId = showId.replace(/^spotify:(show|playlist|episode):/, '').trim();
                try {
                    // Try to fetch as show first, then fallback to playlist if it fails
                    const showRes = await apiClient.get(`/shows/${cleanId}?market=IT`);
                    if (isMounted) setShow(showRes.data);
                } catch (e) {
                    try {
                        const plRes = await apiClient.get(`/playlists/${cleanId}?market=IT`);
                        if (isMounted) setShow(plRes.data);
                    } catch (err) {
                        console.warn("Header metadata fetch failed:", err);
                    }
                }

                // 2. Fetch Episodi tramite PodcastService
                const data = await PodcastService.getEpisodes(showId);
                
                if (isMounted) {
                    if (data.length === 0) {
                        setErrorMessage(`Nessun episodio trovato per questo podcast (ID: ${showId})`);
                    } else if (data.length < 50) {
                        setHasMore(false);
                    }
                    setEpisodes(data);
                    setLoading(false);
                }
            } catch (err) {
                if (isMounted) {
                    setErrorMessage('Errore critico durante il caricamento del podcast.');
                    setLoading(false);
                }
            }
        }
        
        loadData();
        return () => { isMounted = false; };
    }, [showId]);

    const loadMoreEpisodes = async () => {
        if (!hasMore || loadingMore || !showId) return;
        setLoadingMore(true);

        const nextOffset = offset + 50;
        const newEpisodes = await PodcastService.getEpisodesWithOffset(showId, nextOffset);

        if (newEpisodes.length > 0) {
            setEpisodes(prev => [...prev, ...newEpisodes]);
            setOffset(nextOffset);
            if (newEpisodes.length < 50) setHasMore(false);
        } else {
            setHasMore(false);
        }
        setLoadingMore(false);
    };
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
        border: isNight ? 'border-white/10' : 'border-black/10',
        placeholderBg: isNight ? 'bg-zinc-800' : 'bg-zinc-300',
        placeholderIcon: isNight ? 'text-zinc-500' : 'text-zinc-600',
    };

    const handlePlayEpisode = async (index: number) => {
        if (!isPlayerReady) return;
        const episode = episodes[index];
        if (!episode?.uri) return;
        setPlayError(null);
        
        // Optimistic UI update: Insert a safe mock state into the Player to avoid rendering null
        if (_setPlayerState) {
            _setPlayerState({
                context: { uri: show?.uri || '' } as any,
                track_window: {
                    current_track: {
                        id: episode.id,
                        uri: episode.uri,
                        name: episode.title || episode.name,
                        album: { name: show?.name || 'Podcast', images: [{ url: episode.image || show?.image || '' }] },
                        images: [{ url: episode.image || show?.image || '' }],
                        artists: [{ name: show?.publisher || 'Podcast' }]
                    } as any,
                    next_tracks: [],
                    previous_tracks: []
                },
                position: 0,
                duration: episode.duration_ms,
                paused: false,
                shuffle: false,
                repeat_mode: 0,
                disallows: { pausing: false, skipping_next: false, skipping_prev: false }
            } as any);
        }

        try {
            const deviceId = localStorage.getItem('spotify_device_id') || playerState?.device?.id;
            const sessionId = localStorage.getItem('auth_session_id');
            if (deviceId) {
                 await fetch('/api/transfer-player', {
                     method: 'POST',
                     headers: { 'Content-Type': 'application/json' },
                     body: JSON.stringify({ device_id: deviceId, sessionId })
                 });
            }

            await apiClient.put('/me/player/play', {
                uris: [episode.uri]
            });
            onPlay({ uris: [episode.uri] });
            
            setTimeout(async () => {
                try {
                    const stateRes = await apiClient.get('/me/player');
                    if (stateRes.data && setNowPlaying) {
                        setNowPlaying(prev => ({
                            ...prev,
                            spotifyState: stateRes.data
                        }));
                    }
                    if (triggerDataRefresh) {
                        triggerDataRefresh();
                    }
                } catch (e) {
                    console.error("Failed to fetch remote player state after play", e);
                }
            }, 800);
        } catch (err: any) {
            console.error("Failed to play episode:", err);
            const status = err?.response?.status;
            if (status === 403 || status === 400 || status === 404) {
                setPlayError('Contenuto non disponibile per il player remoto o Spotify Premium richiesto.');
            } else {
                setPlayError('Impossibile avviare la riproduzione dell\'episodio.');
            }
            const urisToPlay = episodes.slice(index).map(e => e.uri);
            if (urisToPlay.length > 0) {
                onPlay({ uris: urisToPlay });
            }
        }
    };
    
    const sanitizedShowDescription = show?.description ? show.description.replace(/<[^>]*>?/gm, '') : '';

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Header */}
            {show && (
                <header className="flex items-end gap-6 mb-6 pt-4">
                    {show?.images?.[0]?.url ? (
                        <img src={show.images[0].url} alt={show?.name || 'Show'} className="w-48 h-48 rounded-md object-cover shadow-2xl" />
                    ) : (
                        <div className={`w-48 h-48 rounded-md flex items-center justify-center flex-shrink-0 ${theme.placeholderBg}`}>
                            <FiMic className={`w-16 h-16 ${theme.placeholderIcon}`} />
                        </div>
                    )}
                    <div className="flex flex-col gap-3 self-end">
                        <span className={`text-sm font-bold uppercase ${theme.textSecondary}`}>Podcast</span>
                        <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{show?.name || showName || ''}</h1>
                        <p className={`text-lg font-semibold ${theme.textPrimary}`}>{show?.publisher || ''}</p>
                    </div>
                </header>
            )}
            
            {sanitizedShowDescription && (
                <p className={`mb-6 ${theme.textSecondary}`}>{sanitizedShowDescription}</p>
            )}

            {playError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
                    <span>{playError}</span>
                    <button onClick={() => setPlayError(null)} className="text-xs font-bold px-2 py-1 bg-red-500/20 rounded hover:bg-red-500/30">Chiudi</button>
                </div>
            )}

            {/* UI Feedback come richiesto */}
            {loading && (
                <div className="flex flex-col items-center justify-center my-12 gap-4">
                    <div className={`w-10 h-10 rounded-full border-4 border-t-transparent animate-spin ${isNight ? 'border-white' : 'border-black'}`} />
                    <span className={`font-semibold ${theme.textSecondary}`}>Caricamento episodi in corso...</span>
                </div>
            )}

            {!loading && errorMessage && episodes.length === 0 && (
                <div className="p-4 bg-red-500/20 border border-red-500 rounded-md text-red-400 font-bold mb-4 text-center shadow-lg">
                    {errorMessage}
                </div>
            )}

            {/* Episode List */}
            {!loading && episodes.length > 0 && (
                <>
                    <div className="flex justify-between items-center mb-4">
                        <h2 className={`text-2xl font-bold ${theme.textPrimary}`}>Episodi</h2>
                    </div>
                    
                    <motion.div
                        className="flex flex-col gap-2"
                        variants={containerVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        {episodes.map((episode, index) => {
                            const isPlaying = isPlayingContext && episode?.id === currentTrackId;
                            const activeColor = isNight ? 'text-green-400' : 'text-green-600';
                            
                            return (
                                <motion.div
                                    key={`${episode.id}-${index}`}
                                    variants={itemVariants}
                                    onClick={() => handlePlayEpisode(index)}
                                    className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center p-2 px-4 rounded-md ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`}`}
                                >
                                    {episode.image ? (
                                        <img src={episode.image} alt={episode.title} className="w-16 h-16 rounded object-cover flex-shrink-0"/>
                                    ) : (
                                        <div className={`w-16 h-16 rounded flex items-center justify-center flex-shrink-0 ${theme.placeholderBg}`}>
                                            <FiMic className={`w-8 h-8 ${theme.placeholderIcon}`} />
                                        </div>
                                    )}
                                    <div className="flex flex-col overflow-hidden">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {isPlaying && <AnimatedEqualizer className={`w-4 h-4 flex-shrink-0 ${activeColor}`} />}
                                            <span className={`font-bold truncate ${isPlaying ? activeColor : theme.textPrimary}`}>{episode.title}</span>
                                        </div>
                                        <span className={`text-sm mt-1 text-ellipsis overflow-hidden line-clamp-2 ${theme.textSecondary}`}>{episode.description}</span>
                                        <div className={`flex items-center gap-2 mt-2 text-xs ${theme.textSecondary}`}>
                                            {episode.release_date && <span>{new Date(episode.release_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                            {episode.release_date && episode.duration_ms > 0 && <span>•</span>}
                                            {episode.duration_ms > 0 && <span>{formatDuration(episode.duration_ms)}</span>}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePlayEpisode(index); }}
                                        disabled={!isPlayerReady}
                                        className="bg-green-500 text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        <FiPlay className="w-5 h-5 ml-0.5" />
                                    </button>
                                </motion.div>
                            );
                        })}
                    </motion.div>
                    
                    {hasMore && (
                        <div className="flex justify-center mt-8 mb-4">
                            <button 
                                onClick={loadMoreEpisodes}
                                disabled={loadingMore}
                                className={`px-6 py-3 rounded-full font-bold transition-all ${
                                    isNight 
                                        ? 'bg-white/10 hover:bg-white/20 text-white' 
                                        : 'bg-black/5 hover:bg-black/10 text-black'
                                } disabled:opacity-50 flex items-center gap-2`}
                            >
                                {loadingMore ? (
                                    <>
                                        <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin border-current" />
                                        Caricamento...
                                    </>
                                ) : 'Carica altri episodi'}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ShowDetailView;
