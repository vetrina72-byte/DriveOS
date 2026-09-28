import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import ContentCarousel from './ContentCarousel';
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


interface SearchResults {
    tracks?: { items: SpotifyItem[] };
    artists?: { items: SpotifyItem[] };
    albums?: { items: SpotifyItem[] };
    playlists?: { items: SpotifyItem[] };
}

interface SearchResultsViewProps {
    query: string;
    isNight: boolean;
    onSelectItem: (item: SpotifyItem) => void;
    onPlay: (options: { uris?: string[], offset?: any }, itemForOptimisticUpdate?: SpotifyItem) => void;
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

const topResultVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.3 } },
};

const SearchResultsView: React.FC<SearchResultsViewProps> = ({ query, isNight, onSelectItem, onPlay }) => {
    const [results, setResults] = useState<SearchResults>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { nowPlaying, isPlayerReady } = useAuth();
    const playerState = nowPlaying.spotifyState;

    const isPlayingContext = playerState && !playerState.paused;
    const currentTrackId = playerState?.track_window?.current_track?.id;

    // Track IDs that have been recently queued (for animated checkmark feedback)
    const [queuedTrackIds, setQueuedTrackIds] = useState<{ [id: string]: boolean }>({});
    const [queueToast, setQueueToast] = useState<string | null>(null);
    const toastTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleAddToQueue = async (e: React.MouseEvent, track: SpotifyItem) => {
        e.stopPropagation();
        try {
            window.dispatchEvent(new CustomEvent('spotify-queue-add', { detail: { uri: track.uri, name: track.name } }));
            await apiClient.post(`/me/player/queue?uri=${encodeURIComponent(track.uri)}`);
        } catch (err) {
            console.warn('Queue request notice:', err);
        }
        setQueuedTrackIds(prev => ({ ...prev, [track.id]: true }));
        setQueueToast(`Aggiunto alla coda: ${track.name}`);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => {
            setQueueToast(null);
        }, 2800);
        setTimeout(() => {
            setQueuedTrackIds(prev => {
                const next = { ...prev };
                delete next[track.id];
                return next;
            });
        }, 1500);
    };

    useEffect(() => {
        if (!query) return;

        const performSearch = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/search', {
                    params: {
                        q: query,
                        type: 'track,artist,album,playlist',
                        limit: 20
                    }
                });
                setResults(response.data);
            } catch (err) {
                console.error('Search failed', err);
                setError('Search failed.');
            } finally {
                setLoading(false);
            }
        };

        performSearch();
    }, [query]);

    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
    };
    
    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    const topResult = results.tracks?.items[0];
    const trackResults = results.tracks?.items.slice(1, 5) || []; // Top 4 tracks after the main one
    const trackUris = results.tracks?.items.map(t => t.uri) || [];

    const noResultsFound = Object.values(results).every((res: any) => !res || res.items.length === 0);
    if(noResultsFound) {
        return <div className="flex-grow flex justify-center items-center text-lg">Nessun risultato per "{query}"</div>
    }

    const isTopResultPlaying = isPlayingContext && topResult?.id === currentTrackId;
    const activeColor = isNight ? 'text-green-400' : 'text-green-600';

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {topResult && (
                    <motion.div
                      className="md:col-span-1"
                      variants={topResultVariants}
                      initial="hidden"
                      animate="visible"
                    >
                        <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Miglior risultato</h2>
                        <div onClick={() => onSelectItem(topResult)} className={`p-4 rounded-lg transition-colors duration-200 cursor-pointer flex flex-col gap-4 ${isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'}`}>
                            {topResult.album?.images?.[0] && (
                                <img src={topResult.album.images[0].url} alt={topResult.name} className="w-24 h-24 rounded-md shadow-lg" />
                            )}
                            <div className="flex-grow">
                                <div className="flex items-center gap-2">
                                    {isTopResultPlaying && <AnimatedEqualizer className={`w-6 h-6 flex-shrink-0 ${activeColor}`} />}
                                    <h3 className={`text-3xl font-bold truncate ${isTopResultPlaying ? activeColor : theme.textPrimary}`}>{topResult.name}</h3>
                                </div>
                                <p className={`text-sm ${theme.textSecondary}`}>
                                    {topResult.explicit && <span className="mr-2 bg-zinc-500/50 text-white text-[0.625rem] rounded-sm px-1 py-0.5">E</span>}
                                    {topResult.artists?.map(a => a.name).join(', ')}
                                </p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onPlay({ uris: [topResult.uri] }, topResult); }}
                                disabled={!isPlayerReady}
                                className="bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform self-start disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            >
                                <FiPlay className="w-7 h-7 ml-1" />
                            </button>
                        </div>
                    </motion.div>
                )}
                {trackResults.length > 0 && (
                     <div className="md:col-span-1">
                        <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Brani</h2>
                        <motion.div
                          className="flex flex-col gap-2"
                          variants={containerVariants}
                          initial="hidden"
                          animate="visible"
                        >
                              {trackResults.map((track, index) => {
                                const isPlaying = isPlayingContext && track.id === currentTrackId;
                                return (
                                    <motion.div
                                      key={track.id}
                                      variants={itemVariants}
                                      onClick={() => isPlayerReady && onPlay({ uris: trackUris, offset: { position: index + 1 } }, track)}
                                      className={`flex items-center gap-3 p-2 rounded-md ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`}`}
                                    >
                                        <img src={track.album?.images?.[2]?.url || track.images?.[0]?.url} alt={track.album?.name || track.name} className="w-10 h-10 rounded object-cover flex-shrink-0"/>
                                        <div className="flex-grow overflow-hidden min-w-0">
                                            <div className="flex items-center gap-2">
                                                {isPlaying && <AnimatedEqualizer className={`w-4 h-4 flex-shrink-0 ${activeColor}`} />}
                                                <p className={`font-bold truncate ${isPlaying ? activeColor : theme.textPrimary}`}>{track.name}</p>
                                            </div>
                                            <p className={`text-xs truncate ${theme.textSecondary}`}>{track.artists?.map(a => a.name).join(', ')}</p>
                                        </div>
                                        {/* Aggiungi alla coda */}
                                        <button
                                            onClick={(e) => handleAddToQueue(e, track)}
                                            title="Aggiungi alla coda"
                                            aria-label="Aggiungi alla coda"
                                            className={`p-2 rounded-full transition-all duration-200 active:scale-90 flex-shrink-0 ${
                                                queuedTrackIds[track.id]
                                                    ? 'text-green-400 bg-green-500/10'
                                                    : `${theme.textSecondary} hover:text-white hover:bg-white/10`
                                            }`}
                                        >
                                            {queuedTrackIds[track.id] ? (
                                                <svg className="w-4 h-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="20 6 9 17 4 12" />
                                                </svg>
                                            ) : (
                                                <svg className="w-4 h-4 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="3" y1="6" x2="16" y2="6" />
                                                    <line x1="3" y1="12" x2="14" y2="12" />
                                                    <line x1="3" y1="18" x2="11" y2="18" />
                                                    <line x1="18" y1="15" x2="18" y2="21" />
                                                    <line x1="15" y1="18" x2="21" y2="18" />
                                                </svg>
                                            )}
                                        </button>
                                    </motion.div>
                                );
                             })}
                        </motion.div>
                     </div>
                )}
            </div>
            
            {results.artists && results.artists.items.length > 0 && (
                <ContentCarousel 
                    title="Artisti" 
                    items={results.artists.items.map(item => ({...item, description: "Artista"}))} 
                    isNight={isNight} 
                    onSelectItem={onSelectItem}
                    keyPrefix="search-artists"
                />
            )}
            {results.albums && results.albums.items.length > 0 && (
                <ContentCarousel 
                    title="Album" 
                    items={results.albums.items}
                    isNight={isNight} 
                    onSelectItem={onSelectItem}
                    keyPrefix="search-albums"
                />
            )}
            {results.playlists && results.playlists.items.length > 0 && (
                <ContentCarousel 
                    title="Playlist" 
                    items={results.playlists.items}
                    isNight={isNight} 
                    onSelectItem={onSelectItem}
                    keyPrefix="search-playlists"
                />
            )}

            {/* Confirmation Toast for Add to Queue */}
            {queueToast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2.5 rounded-xl bg-zinc-900/95 text-white border border-white/15 shadow-2xl text-xs font-semibold backdrop-blur-md flex items-center gap-2.5 animate-slide-up pointer-events-none">
                    <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 fill-none stroke-current" viewBox="0 0 24 24" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>
                    <span className="truncate max-w-[280px]">{queueToast}</span>
                </div>
            )}
        </div>
    );
};

export default SearchResultsView;