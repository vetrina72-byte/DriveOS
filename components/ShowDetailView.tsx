import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay, FiMic, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.3
    }
  }
};

interface Show {
    id: string;
    name: string;
    publisher: string;
    description: string;
    images: { url: string }[];
    uri: string;
    episodes: {
        total: number;
    }
}

interface Episode {
    id: string;
    name: string;
    description: string;
    duration_ms: number;
    release_date: string;
    uri: string;
    images: { url: string }[];
}

interface ShowDetailViewProps {
    showId: string;
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

const ShowDetailView: React.FC<ShowDetailViewProps> = ({ showId, isNight, onPlay }) => {
    const [show, setShow] = useState<Show | null>(null);
    const [episodes, setEpisodes] = useState<Episode[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { nowPlaying, isPlayerReady, setNowPlaying, triggerDataRefresh } = useAuth();
    const playerState = nowPlaying.spotifyState;
    
    const [totalEpisodes, setTotalEpisodes] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [playError, setPlayError] = useState<string | null>(null);
    const limit = 50;

    const isPlayingContext = playerState && !playerState.paused;
    const currentTrackId = playerState?.track_window.current_track?.id;
    
    useEffect(() => {
        let isMounted = true;
        setShow(null);
        setEpisodes([]);
        setTotalEpisodes(0);
        setCurrentPage(1);
        setLoading(true);

        const fetchShowInfo = async () => {
            try {
                const showRes = await apiClient.get(`/shows/${showId}`);
                if (isMounted) {
                    const responseData = showRes.data;
                    setShow(responseData || null);
                    setTotalEpisodes(responseData?.episodes?.total || 0);

                    // Estrazione episodi con ripiegamento
                    let episodeList = responseData?.episodes?.items ?? responseData?.items ?? [];
                    if (episodeList.length === 0) {
                        try {
                            const fallbackRes = await apiClient.get(`/shows/${showId}/episodes?limit=50`);
                            episodeList = fallbackRes.data?.items ?? [];
                        } catch (e) {
                            console.error("Fallback episodes fetch failed", e);
                        }
                    }
                    setEpisodes(episodeList);
                    setLoading(false);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError('Could not load show details.');
                    setLoading(false);
                }
            }
        };
        fetchShowInfo();
        return () => { isMounted = false; };
    }, [showId]);

    useEffect(() => {
        let isMounted = true;
        if (totalEpisodes === 0) {
            if (show && isMounted) { // Show is loaded but has 0 episodes
                setLoading(false);
            }
            return;
        }

        const fetchEpisodes = async () => {
            setLoading(true);
            setError(null);

            const totalPages = Math.ceil(totalEpisodes / limit);
            const pageToFetch = totalPages - currentPage;
            const offset = Math.max(0, pageToFetch * limit);

            try {
                const episodesRes = await apiClient.get(`/shows/${showId}/episodes?limit=${limit}&offset=${offset}`);
                if (isMounted) {
                    setEpisodes(episodesRes.data?.items ? [...episodesRes.data.items].reverse() : []);
                }
            } catch (err) {
                console.error(err);
                if (isMounted) {
                    setError('Could not load episodes.');
                    setEpisodes([]);
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        fetchEpisodes();
        return () => { isMounted = false; };
    }, [showId, currentPage, totalEpisodes, show]);
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
        border: isNight ? 'border-white/10' : 'border-black/10',
        placeholderBg: isNight ? 'bg-zinc-800' : 'bg-zinc-300',
        placeholderIcon: isNight ? 'text-zinc-500' : 'text-zinc-600',
    };

    if (loading && episodes.length === 0) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error || !show) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Show not found.'}</div>;
    }
    
    const handlePlayEpisode = async (index: number) => {
        if (!isPlayerReady) return;
        const episode = episodes[index];
        if (!episode?.uri) return;
        setPlayError(null);
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

    const PaginationControls = () => {
        const buttonClasses = `px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'}`;
        const totalPages = Math.ceil(totalEpisodes / limit);
    
        return (
            <div className="flex justify-center items-center gap-4">
                <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1 || loading} className={buttonClasses} style={{ color: 'var(--text-primary)'}}>
                    <FiChevronLeft className="w-5 h-5"/>
                    Precedente
                </button>
                 <span className={theme.textSecondary}>Pagina {currentPage} di {totalPages > 0 ? totalPages : 1}</span>
                <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage >= totalPages || loading} className={buttonClasses} style={{ color: 'var(--text-primary)'}}>
                    Successivo
                    <FiChevronRight className="w-5 h-5"/>
                </button>
            </div>
        );
    };

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            {/* Header */}
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
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{show?.name || ''}</h1>
                    <p className={`text-lg font-semibold ${theme.textPrimary}`}>{show?.publisher || ''}</p>
                </div>
            </header>
            
            <p className={`mb-6 ${theme.textSecondary}`}>{sanitizedShowDescription}</p>

            {playError && (
                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center justify-between">
                    <span>{playError}</span>
                    <button onClick={() => setPlayError(null)} className="text-xs font-bold px-2 py-1 bg-red-500/20 rounded hover:bg-red-500/30">Chiudi</button>
                </div>
            )}

            {/* Episode List Header */}
            <div className="flex justify-between items-center mb-4">
                <h2 className={`text-2xl font-bold ${theme.textPrimary}`}>Episodi</h2>
            </div>
            
            {/* Episode List */}
            <motion.div
              className="flex flex-col gap-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {(() => {
                    const validEpisodes = Array.isArray(episodes) ? episodes.filter(ep => ep && ep.id) : [];
                    return validEpisodes.map((episode, index) => {
                        const isPlaying = isPlayingContext && episode?.id === currentTrackId;
                        const activeColor = isNight ? 'text-green-400' : 'text-green-600';
                        const epName = episode?.name ?? 'Episodio';
                        const rawDescription = (episode as any)?.description ?? (episode as any)?.html_description ?? '';
                        const cleanDescription = rawDescription.replace(/<[^>]*>?/gm, '');
                        const epDate = episode?.release_date ? new Date(episode.release_date).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
                        const epDuration = episode?.duration_ms ? formatDuration(episode.duration_ms) : '';
                        const coverImage = episode?.images?.[0]?.url ?? show?.images?.[0]?.url ?? '';

                        return (
                            <motion.div
                                key={`${episode.id}-${index}`}
                                variants={itemVariants}
                                onClick={() => handlePlayEpisode(index)}
                                className={`grid grid-cols-[auto_1fr_auto] gap-4 items-center p-2 px-4 rounded-md ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`}`}
                            >
                                {coverImage ? (
                                    <img src={coverImage} alt={epName} className="w-16 h-16 rounded object-cover flex-shrink-0"/>
                                ) : (
                                    <div className={`w-16 h-16 rounded flex items-center justify-center flex-shrink-0 ${theme.placeholderBg}`}>
                                        <FiMic className={`w-8 h-8 ${theme.placeholderIcon}`} />
                                    </div>
                                )}
                                <div className="flex flex-col overflow-hidden">
                                    <div className="flex items-center gap-2 min-w-0">
                                        {isPlaying && <AnimatedEqualizer className={`w-4 h-4 flex-shrink-0 ${activeColor}`} />}
                                        <span className={`font-bold truncate ${isPlaying ? activeColor : theme.textPrimary}`}>{epName}</span>
                                    </div>
                                    <span className={`text-sm mt-1 text-ellipsis overflow-hidden line-clamp-2 ${theme.textSecondary}`}>{cleanDescription}</span>
                                    <div className={`flex items-center gap-2 mt-2 text-xs ${theme.textSecondary}`}>
                                        {epDate && <span>{epDate}</span>}
                                        {epDate && epDuration && <span>•</span>}
                                        {epDuration && <span>{epDuration}</span>}
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
                    });
                })}
            </motion.div>

            {totalEpisodes > limit && (
                <div className="mt-6">
                    <PaginationControls />
                </div>
            )}
        </div>
    );
};

export default ShowDetailView;