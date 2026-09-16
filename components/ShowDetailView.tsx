import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay, FiPause, FiMic, FiCheck, FiClock } from 'react-icons/fi';
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
    onPlay: (options: { uris?: string[] }, itemForOptimisticUpdate?: any) => void;
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
    const [isSwitching, setIsSwitching] = useState<boolean>(false);
    const [switchingEpisodeId, setSwitchingEpisodeId] = useState<string | null>(null);
    const [, setHistoryTick] = useState<number>(0);
    const [, setLiveTick] = useState<number>(0);

    useEffect(() => {
        const handleHistoryUpdated = () => {
            setHistoryTick(t => t + 1);
        };
        window.addEventListener('podcast_history_updated', handleHistoryUpdated);
        return () => window.removeEventListener('podcast_history_updated', handleHistoryUpdated);
    }, []);
    
    const { nowPlaying, isPlayerReady, setNowPlaying, triggerDataRefresh, _setPlayerState, play, pauseSpotify } = useAuth();
    const playerState = nowPlaying.spotifyState;
    const isPlayingContext = playerState && !playerState.paused && nowPlaying.source === 'spotify';
    const currentTrack = playerState?.track_window?.current_track ?? playerState?.item ?? null;
    const currentTrackId = currentTrack?.id;
    const currentTrackUri = currentTrack?.uri;

    // Real-time live percentage progression while listening
    useEffect(() => {
        if (!isPlayingContext || !currentTrackId) return;

        const interval = setInterval(() => {
            setLiveTick(t => t + 1);
            if (currentTrack?.uri?.includes('episode') || (currentTrack as any)?.type === 'episode') {
                const elapsed = playerState?.timestamp ? Math.max(0, Date.now() - playerState.timestamp) : 0;
                const curPos = Math.min(playerState?.duration || 0, Math.max(0, (playerState?.position || 0) + elapsed));
                if (playerState?.duration) {
                    PodcastService.updateEpisodeProgress(currentTrackId, curPos, playerState.duration);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPlayingContext, currentTrackId, playerState, currentTrack]);
    
    useEffect(() => {
        let isMounted = true;
        
        async function loadData() {
            if (!showId) return;
            
            if (!showId) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setErrorMessage(null);
            setShow(null);
            setEpisodes([]);
            setOffset(0);
            setHasMore(true);

            try {
                // 1. Fetch Dettagli Show/Playlist (Header)
                const cleanId = (showId || '').replace(/^spotify:(show|playlist|episode):/, '').trim();
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

    // 1. OPTIMISTIC UPDATE: Inietta immediatamente i dati del nuovo episodio con flag di caricamento
    const playEpisode = async (episode: any) => {
        if (!episode?.uri) return;

        const optimisticTrack: any = {
            id: episode.id,
            name: episode.title || episode.name || 'Episodio in riproduzione',
            artists: [{ name: show?.publisher || show?.name || 'Podcast' }],
            album: { 
                name: show?.name || 'Podcast', 
                images: [{ url: episode.image || show?.image || '' }] 
            },
            images: [{ url: episode.image || show?.image || '' }],
            duration_ms: episode.duration_ms,
            uri: episode.uri
        };

        const optimisticState: any = {
            isLoading: true, // Aggiungi questo flag per mostrare lo spinner sulla cover
            is_playing: true,
            context: { uri: show?.uri || '' },
            item: optimisticTrack,
            track_window: {
                current_track: optimisticTrack,
                next_tracks: [],
                previous_tracks: []
            },
            position: 0,
            duration: episode.duration_ms,
            paused: false,
            shuffle: false,
            repeat_mode: 0,
            disallows: { pausing: false, skipping_next: false, skipping_prev: false },
            timestamp: Date.now()
        };

        // 1. OPTIMISTIC UPDATE: Aggiorna subito la UI in attesa di Spotify
        if (setNowPlaying) {
            setNowPlaying(prev => ({
                ...prev,
                source: 'spotify',
                isLoading: true,
                spotifyState: optimisticState
            }));
        } else if (_setPlayerState) {
            _setPlayerState(optimisticState);
        }

        // 2. Esegui la chiamata API reale
        try {
            const deviceId = localStorage.getItem('spotify_device_id') || (playerState as any)?.device?.id;
            await apiClient.put('/v1/me/player/play', 
                { uris: [episode.uri] },
                { params: deviceId ? { device_id: deviceId } : undefined }
            );
        } catch (error) {
            console.error("Errore Playback:", error);
            onPlay({ uris: [episode.uri] }, optimisticTrack);
        }
    };

    // 2. Debounce sul pulsante di Play (Prevenzione "Audio Doppio")
    const handlePlayClick = async (episode: any) => {
        if (!episode?.uri) return;

        const isCurrentTrack = Boolean(
            (currentTrackId && episode.id === currentTrackId) ||
            (currentTrackUri && episode.uri === currentTrackUri)
        );

        // Se l'episodio cliccato è quello attualmente in riproduzione o in pausa, fa toggle play/pause istantaneo senza riavviare da capo
        if (isCurrentTrack) {
            if (isPlayingContext) {
                pauseSpotify();
            } else {
                play();
            }
            return;
        }

        if (isSwitching || !isPlayerReady) return; // Blocca click multipli se sta caricando un nuovo brano

        setIsSwitching(true);
        setSwitchingEpisodeId(episode.id);
        setPlayError(null);

        // Registra subito l'episodio in PodcastService così compare all'istante in "In Corso / Già Ascoltati"
        PodcastService.recordEpisodePlayed({
            id: episode.id,
            name: episode.title || (episode as any).name || 'Episodio',
            title: episode.title,
            description: episode.description || '',
            duration_ms: episode.duration_ms || 1800000,
            release_date: episode.release_date || '',
            uri: episode.uri,
            image: episode.image || show?.images?.[0]?.url || '',
            images: episode.image ? [{ url: episode.image }] : (show?.images || []),
            type: 'episode',
            show: show ? {
                id: show.id,
                name: show.name,
                publisher: show.publisher,
                images: show.imagess
            } : undefined,
            resume_point: {
                fully_played: false,
                resume_position_ms: 1000
            }
        }, show);

        try {
            await playEpisode(episode);
        } catch (err: any) {
            console.error("Errore Playback:", err);
            const status = err?.response?.status;
            if (status === 403 || status === 400 || status === 404) {
                setPlayError('Contenuto non disponibile per il player remoto o Spotify Premium richiesto.');
            } else {
                setPlayError('Impossibile avviare la riproduzione dell\'episodio.');
            }
        } finally {
            // Sblocca il tasto dopo 1 secondo, dando tempo all'SDK di allinearsi
            setTimeout(() => {
                setIsSwitching(false);
                setSwitchingEpisodeId(null);
            }, 1000);
        }
    };

    const handlePlayEpisode = (index: number) => {
        const episode = episodes[index];
        if (episode) handlePlayClick(episode);
    };
    
    const sanitizedShowDescription = show?.description ? show.description.replace(/<[^>]*>?/gm, '') : '';

    return (
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 pb-6 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Header */}
            {show && (
                <header className="flex items-end gap-6 mb-6 pt-4">
                    {show?.images?.[0]?.url ? (
                        <img src={show.imagess[0].url} alt={show?.name || 'Show'} className="w-48 h-48 rounded-md object-cover shadow-2xl" />
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
                            const isCurrentTrack = Boolean(
                                (currentTrackId && episode.id === currentTrackId) ||
                                (currentTrackUri && episode.uri === currentTrackUri)
                            );
                            const isPlaying = isPlayingContext && isCurrentTrack;
                            const isThisEpisodeSwitching = isSwitching && switchingEpisodeId === episode.id;
                            const activeColor = isNight ? 'text-green-400' : 'text-green-600';
                            
                            // Calcolo dello stato di ascolto e percentuale perfettamente sincronizzato al 100%
                            const status = PodcastService.getEpisodeStatus(episode, isCurrentTrack ? playerState : undefined);
                            
                            return (
                                <motion.div
                                    key={`${episode.id}-${index}`}
                                    variants={itemVariants}
                                    onClick={() => handlePlayEpisode(index)}
                                    className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center p-2 px-4 rounded-md ${!isPlayerReady || isSwitching ? 'opacity-75 cursor-wait' : `cursor-pointer ${theme.hover}`}`}
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
                                            {isPlaying && !isThisEpisodeSwitching && <AnimatedEqualizer className={`w-4 h-4 flex-shrink-0 ${activeColor}`} />}
                                            <span className={`font-bold truncate ${isPlaying ? activeColor : theme.textPrimary}`}>{episode.title}</span>
                                            {status.fully_played ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        PodcastService.toggleEpisodeCompleted(episode.id, status.duration_ms);
                                                    }}
                                                    title="Segna come da riascoltare"
                                                    className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 transition-colors cursor-pointer"
                                                >
                                                    <FiCheck className="w-3 h-3 stroke-[3]" />
                                                    Ascoltato
                                                </button>
                                            ) : status.resume_position_ms > 0 ? (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        PodcastService.markEpisodeCompleted(episode.id, status.duration_ms);
                                                    }}
                                                    title="Clicca per segnare come già ascoltato"
                                                    className="flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30 hover:bg-amber-500/30 transition-colors cursor-pointer"
                                                >
                                                    <FiClock className="w-3 h-3" />
                                                    In corso ({status.progress_percent}%)
                                                </button>
                                            ) : null}
                                        </div>
                                        <span className={`text-sm mt-1 text-ellipsis overflow-hidden line-clamp-2 ${theme.textSecondary}`}>{episode.description}</span>
                                        <div className={`flex items-center gap-2 mt-2 text-xs ${theme.textSecondary}`}>
                                            {episode.release_date && <span>{new Date(episode.release_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })}</span>}
                                            {episode.release_date && status.duration_ms > 0 && <span>•</span>}
                                            {status.duration_ms > 0 && <span>{formatDuration(status.duration_ms)}</span>}
                                            {!status.fully_played && status.resume_position_ms > 0 && (
                                                <>
                                                    <span>•</span>
                                                    <span className="text-amber-400 font-medium">
                                                        {status.duration_ms - status.resume_position_ms > 60000
                                                            ? `${Math.ceil((status.duration_ms - status.resume_position_ms) / 60000)} min rimanenti`
                                                            : `${Math.max(1, Math.round((status.duration_ms - status.resume_position_ms) / 1000))} sec rimanenti`}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {!status.fully_played && status.resume_position_ms > 0 && (
                                            <div className={`w-full max-w-xs h-1 rounded-full overflow-hidden mt-1.5 ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>
                                                <div className="h-full bg-amber-400 rounded-full transition-all duration-300" style={{ width: `${status.progress_percent}%` }} />
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handlePlayEpisode(index); }}
                                        disabled={!isPlayerReady || isSwitching}
                                        className="bg-green-500 text-black w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                                    >
                                        {isThisEpisodeSwitching ? (
                                            <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                        ) : isPlaying ? (
                                            <FiPause className="w-5 h-5" />
                                        ) : (
                                            <FiPlay className="w-5 h-5 ml-0.5" />
                                        )}
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
