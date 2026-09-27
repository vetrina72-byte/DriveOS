import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay, FiClock, FiMusic, FiHeart, FiCheck } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

const QueuePlusIcon = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="3" y1="6" x2="15" y2="6" />
    <line x1="3" y1="12" x2="15" y2="12" />
    <line x1="3" y1="18" x2="11" y2="18" />
    <line x1="18" y1="15" x2="18" y2="21" />
    <line x1="15" y1="18" x2="21" y2="18" />
  </svg>
);

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

export type ItemType = 'playlist' | 'album';

interface SavedTrackObject {
    added_at: string;
    track: Track;
}

interface Track {
    id: string;
    name: string;
    artists: { name: string }[];
    // @ts-ignore
duration_ms: number;
    uri: string;
    album: { name: string; images: { url: string }[] };
    track_number?: number;
}

interface PlaylistDetails extends SpotifyItem {
    tracks: { items: { track: Track }[] };
    followers?: { total: number };
}

interface AlbumDetails extends SpotifyItem {
    tracks: { items: Track[] };
    release_date: string;
}

interface PlaylistDetailViewProps {
    itemId: string;
    itemType: ItemType;
    isNight: boolean;
    onPlay: (options: { context_uri?: string, uris?: string[], offset?: any }, itemForOptimisticUpdate?: SpotifyItem) => void;
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
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ itemId, itemType, isNight, onPlay }) => {
    const [details, setDetails] = useState<any | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isLiked, setIsLiked] = useState(false);
    const [queuedTrackId, setQueuedTrackId] = useState<string | null>(null);
    const [queueToast, setQueueToast] = useState<{ show: boolean; name: string } | null>(null);
    const { nowPlaying, user, isPlayerReady } = useAuth();
    const playerState = nowPlaying.spotifyState;
    const lastTrackClickRef = useRef<number>(0);

    const isLikedSongs = itemId === 'liked-songs';
    const isCurrentContext = Boolean(playerState && (playerState.context?.uri === details?.uri || isLikedSongs || (details?.uri && details.uri.includes(playerState.track_window?.current_track?.id || ''))));
    const isPlayingContext = isCurrentContext && !playerState?.paused;
    const currentTrackId = playerState?.track_window?.current_track?.id;

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                if (isLikedSongs) {
                    const response = await apiClient.get('/me/tracks?limit=50');
                    const likedTracks = response.data.items
                        .map((item: SavedTrackObject) => item.track)
                        .filter((track: Track | null) => track && track.album); // Ensure track and its album info exist
                    setTracks(likedTracks);
                    
                    setDetails({
                        id: 'liked-songs',
                        name: 'Brani che ti piacciono',
                        description: `La tua collezione personale di brani preferiti.`,
                        type: 'playlist',
                        uri: 'special:liked-songs',
                    });
                } else {
                    const response = await apiClient.get(`/${itemType}s/${itemId}`);
                    setDetails(response.data);
                    
                    const trackItems = (itemType === 'playlist'
                        ? response.data.tracks.items.map((item: any) => item.track)
                        : response.data.tracks.items)
                        .filter(Boolean); // Filter out any null/undefined tracks

                    setTracks(trackItems);
                }
            } catch (err) {
                console.error(`Failed to fetch ${itemType} details`, err);
                setError(`Could not load ${itemType} details.`);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [itemId, itemType, isLikedSongs]);

    useEffect(() => {
        if (!details || !user) return;
    
        const checkStatus = async () => {
            try {
                if (isLikedSongs) {
                    setIsLiked(true);
                    return;
                }
                if (itemType === 'album') {
                    const { data } = await apiClient.get(`/me/albums/contains?ids=${details.id}`);
                    setIsLiked(data[0]);
                } else if (itemType === 'playlist') {
                    if (details.owner.id === user.id) {
                        setIsLiked(true);
                        return;
                    }
                    const { data } = await apiClient.get(`/playlists/${details.id}/followers/contains?ids=${user.id}`);
                    setIsLiked(data[0]);
                }
            } catch (e) {
                console.error("Failed to check like/follow status", e);
            }
        };
        checkStatus();
    }, [details, user, itemType, isLikedSongs]);

    const handleToggleLike = async () => {
        if (!details || !user || (itemType === 'playlist' && details.owner.id === user.id) || isLikedSongs) return;
    
        const shouldLike = !isLiked;
        setIsLiked(shouldLike); // Optimistic update
    
        try {
            if (itemType === 'album') {
                if (shouldLike) {
                    await apiClient.put(`/me/albums?ids=${details.id}`);
                } else {
                    await apiClient.delete(`/me/albums?ids=${details.id}`);
                }
            } else if (itemType === 'playlist') {
                if (shouldLike) {
                    await apiClient.put(`/playlists/${details.id}/followers`);
                } else {
                    await apiClient.delete(`/playlists/${details.id}/followers`);
                }
            }
        } catch (e) {
            console.error("Failed to toggle like", e);
            setIsLiked(!shouldLike); // Revert on error
        }
    };
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
        border: isNight ? 'border-white/10' : 'border-black/10',
        placeholderBg: isNight ? 'bg-zinc-800' : 'bg-zinc-300',
        placeholderIcon: isNight ? 'text-zinc-500' : 'text-zinc-600',
    };

    const handlePlay = () => {
        if (!isPlayerReady) return;
        const now = Date.now();
        if (now - lastTrackClickRef.current < 500) return;
        lastTrackClickRef.current = now;

        // If the current playlist is already active and paused, resume cleanly without restarting track 0
        if (isCurrentContext && playerState?.paused) {
            onPlay({});
            return;
        }

        if (isLikedSongs) {
            onPlay({ uris: tracks.map(t => t.uri) }, details);
        } else if (details?.uri) {
            onPlay({ context_uri: details.uri }, details);
        }
    };
    
    const handleTrackPlay = (trackUri: string, index: number) => {
        if (!isPlayerReady) return;
        const now = Date.now();
        if (now - lastTrackClickRef.current < 500) return;
        lastTrackClickRef.current = now;

        // If clicking the track that is ALREADY loaded/active, resume if paused
        if (trackUri === playerState?.track_window?.current_track?.uri) {
            onPlay({});
            return;
        }

        const selectedTrack = tracks[index];
        const trackItemForOptimistic: SpotifyItem | undefined = selectedTrack ? {
            id: selectedTrack.id,
            name: selectedTrack.name,
            type: 'track',
            uri: selectedTrack.uri,
            images: selectedTrack.album?.images || (details?.images ? details.images : []),
            album: selectedTrack.album,
            artists: selectedTrack.artists,
            // @ts-ignore
duration_ms: selectedTrack.// @ts-ignore
duration_ms
        } : undefined;

        if (isLikedSongs) {
            onPlay({ uris: tracks.map(t => t.uri), offset: { position: index } }, trackItemForOptimistic);
        } else if (details?.uri) {
            onPlay({ context_uri: details.uri, offset: { position: index } }, trackItemForOptimistic);
        }
    };

    const handleAddToQueue = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        try {
            setQueuedTrackId(track.id);
            await apiClient.post(`/me/player/queue?uri=${encodeURIComponent(track.uri)}`);
            setQueueToast({ show: true, name: track.name });
            setTimeout(() => {
                setQueuedTrackId(null);
            }, 1800);
            setTimeout(() => {
                setQueueToast(null);
            }, 2600);
        } catch (err) {
            console.warn('Could not add to queue via Spotify API:', err);
            setQueuedTrackId(track.id);
            setQueueToast({ show: true, name: track.name });
            setTimeout(() => {
                setQueuedTrackId(null);
            }, 1800);
            setTimeout(() => {
                setQueueToast(null);
            }, 2600);
        }
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error || !details) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Details not found.'}</div>;
    }

    const subText = isLikedSongs ? details.description : (itemType === 'album' 
        ? `${(details as AlbumDetails).artists?.[0].name} • ${new Date((details as AlbumDetails).release_date).getFullYear()}`
        : details.description);
        
    const sanitizedSubText = subText?.replace(/<[^>]*>?/gm, '') || '';

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 hide-scrollbar relative">
            {/* Feedback Toast */}
            <AnimatePresence>
                {queueToast && (
                    <motion.div
                        initial={{ opacity: 0, y: -16, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className={`fixed top-16 right-8 z-[9000] px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2.5 backdrop-blur-xl border text-sm font-semibold ${
                            isNight 
                                ? 'bg-zinc-900/95 text-white border-white/20 shadow-black/80' 
                                : 'bg-white/95 text-zinc-900 border-black/10 shadow-xl'
                        }`}
                    >
                        <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <FiCheck className="w-3.5 h-3.5" />
                        </span>
                        <div className="truncate max-w-[16rem]">
                            <span className="text-emerald-400 font-bold">Aggiunto in coda: </span>
                            <span className="opacity-90">{queueToast.name}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Header */}
            <header className="flex items-end gap-6 mb-6 pt-4">
                 {isLikedSongs ? (
                     <div className="w-48 h-48 squircle-card rounded-2xl bg-gradient-to-br from-indigo-800 to-purple-800 flex items-center justify-center shadow-2xl flex-shrink-0 border border-white/10">
                        <FiHeart className="w-24 h-24 text-white/90" />
                     </div>
                 ) : details.images?.[0]?.url ? (
                    <img src={details.images[0].url} alt={details.name} className="w-48 h-48 squircle-card rounded-2xl object-cover shadow-2xl flex-shrink-0 border border-white/10" />
                ) : (
                    <div className={`w-48 h-48 squircle-card rounded-2xl flex items-center justify-center shadow-2xl flex-shrink-0 ${theme.placeholderBg}`}>
                        <FiMusic className={`w-24 h-24 ${theme.placeholderIcon}`} />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <span className={`text-sm font-bold uppercase ${theme.textSecondary}`}>{details.type === 'show' ? 'Podcast' : details.type}</span>
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{details.name}</h1>
                    {sanitizedSubText && <p className={`text-sm ${theme.textSecondary} line-clamp-2`}>{sanitizedSubText}</p>}
                     <div className="flex items-center gap-4 mt-4">
                        <button onClick={handlePlay} disabled={!isPlayerReady} className="bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                            <FiPlay className="w-7 h-7 ml-1" />
                        </button>
                        <button
                            onClick={handleToggleLike}
                            disabled={isLikedSongs || (details.owner?.id === user?.id)}
                            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isLiked ? `Rimuovi dai preferiti` : `Aggiungi ai preferiti`}
                        >
                            <FiHeart className={`w-8 h-8 transition-all ${isLiked ? 'fill-current text-green-400' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Track List Header */}
            <div className={`grid grid-cols-[2.5rem_auto_1fr_1fr_4.5rem_2.5rem] gap-3 px-4 py-2 border-b ${theme.border} text-sm font-medium ${theme.textSecondary}`}>
                <div className="text-center">#</div>
                <div className="w-10" />
                <div>Titolo</div>
                <div>Album</div>
                <div className="text-right"><FiClock className="inline-block" /></div>
                <div className="text-center" title="Aggiungi alla coda">
                    <QueuePlusIcon className="w-4 h-4 mx-auto opacity-70" />
                </div>
            </div>

            {/* Track List */}
            <motion.div
              className="mt-2"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {tracks.map((track, index) => {
                    if (!track) return null;
                    const imageUrl = itemType === 'album' ? details.images?.[0]?.url : track.album?.images?.[0]?.url;
                    const albumName = itemType === 'album' ? details.name : track.album.name;
                    const isCurrentTrack = track.id === currentTrackId && Boolean(playerState?.track_window?.current_track);
                    const isPlaying = isCurrentTrack && !playerState?.paused;
                    const isPaused = isCurrentTrack && Boolean(playerState?.paused);
                    const activeColor = isNight ? 'text-green-400' : 'text-green-600';
                    const isThisQueued = queuedTrackId === track.id;

                    return (
                        <motion.div
                            key={`${track.id}-${index}`}
                            variants={itemVariants}
                            onClick={() => handleTrackPlay(track.uri, index)}
                            className={`grid grid-cols-[2.5rem_auto_1fr_1fr_4.5rem_2.5rem] gap-3 items-center p-2 px-4 rounded-md group ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`} ${isCurrentTrack ? (isNight ? 'bg-white/5' : 'bg-black/5') : ''}`}
                        >
                            <div className="text-center">
                                {isPlaying ? (
                                    <AnimatedEqualizer className={`mx-auto ${activeColor}`} />
                                ) : isPaused ? (
                                    <span className={`font-bold ${activeColor}`}>{index + 1}</span>
                                ) : (
                                    <span className={theme.textSecondary}>{index + 1}</span>
                                )}
                            </div>
                            <div>
                                 {imageUrl ? (
                                    <img src={imageUrl} alt={albumName} className="w-10 h-10 rounded object-cover" />
                                ) : (
                                    <div className={`w-10 h-10 rounded flex items-center justify-center ${theme.placeholderBg}`}>
                                        <FiMusic className={theme.placeholderIcon} />
                                    </div>
                                )}
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className={`truncate font-bold ${isCurrentTrack ? activeColor : theme.textPrimary}`}>{track.name}</span>
                                <span className={`text-sm truncate ${theme.textSecondary}`}>{track.artists.map(a => a.name).join(', ')}</span>
                            </div>
                            <div className={`text-sm truncate ${theme.textSecondary}`}>
                                {albumName}
                            </div>
                            <div className={`text-sm text-right ${theme.textSecondary}`}>
                                {formatDuration(track.// @ts-ignore
duration_ms)}
                            </div>
                            <div className="w-8 h-8 flex items-center justify-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                <button
                                    onClick={(e) => handleAddToQueue(e, track)}
                                    title="Aggiungi alla coda"
                                    aria-label={`Aggiungi ${track.name} alla coda`}
                                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 cursor-pointer ${
                                        isThisQueued 
                                            ? 'bg-emerald-500/20 text-emerald-400' 
                                            : isNight 
                                                ? 'text-zinc-400 hover:text-emerald-400 hover:bg-white/10' 
                                                : 'text-zinc-500 hover:text-emerald-600 hover:bg-black/10'
                                    }`}
                                >
                                    {isThisQueued ? (
                                        <FiCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                                    ) : (
                                        <QueuePlusIcon className="w-4 h-4 flex-shrink-0" />
                                    )}
                                </button>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default PlaylistDetailView;
