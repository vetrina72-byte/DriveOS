import React, { useState, useEffect, useCallback, useMemo } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay, FiMusic, FiAlertTriangle, FiHeart, FiPlus, FiCheck } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion, AnimatePresence } from 'framer-motion';
import ContentCarousel from './ContentCarousel';
import AnimatedEqualizer from './AnimatedEqualizer';

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

interface Artist {
    id: string;
    name: string;
    images: { url: string }[];
    followers: { total: number };
    uri: string;
    type: 'artist';
}

interface Track {
    id:string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    duration_ms: number;
    uri: string;
    explicit: boolean;
}

interface DiscographyItem extends SpotifyItem {
    album_type: 'album' | 'single' | 'compilation';
    release_date: string;
}


interface ArtistDetailViewProps {
    artistId: string;
    isNight: boolean;
    onPlay: (options: { uris?: string[], context_uri?: string, offset?: any }, itemForOptimisticUpdate?: SpotifyItem) => void;
    onSelectItem: (item: SpotifyItem) => void;
    onFollowChange: () => void;
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

const formatFollowers = (count: number) => {
    return new Intl.NumberFormat('it-IT').format(count);
};

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ artistId, isNight, onPlay, onSelectItem, onFollowChange }) => {
    const [artist, setArtist] = useState<Artist | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [discography, setDiscography] = useState<DiscographyItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFollowing, setIsFollowing] = useState(false);
    const [queuedTrackId, setQueuedTrackId] = useState<string | null>(null);
    const [queueToast, setQueueToast] = useState<{ show: boolean; name: string } | null>(null);
    const { nowPlaying, isPlayerReady } = useAuth();
    const playerState = nowPlaying.spotifyState;

    const isPlayingContext = playerState && !playerState.paused;
    const currentTrackId = playerState?.track_window?.current_track?.id;

    const handleAddToQueue = async (e: React.MouseEvent, track: Track) => {
        e.stopPropagation();
        setQueuedTrackId(track.id);
        try {
            window.dispatchEvent(new CustomEvent('spotify-queue-add', { detail: { uri: track.uri, name: track.name } }));
            await apiClient.post(`/me/player/queue?uri=${encodeURIComponent(track.uri)}`);
        } catch (err) {
            console.warn('Queue request notice:', err);
        }
        setQueueToast({ show: true, name: track.name });
        setTimeout(() => setQueuedTrackId(null), 1800);
        setTimeout(() => setQueueToast(null), 2600);
    };

    const fetchDetails = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        setTracks([]);
        setDiscography([]);

        try {
            const [
                artistRes,
                topTracksRes,
                discographyRes,
                followingStatusRes,
            ] = await Promise.allSettled([
                apiClient.get(`/artists/${artistId}`),
                apiClient.get(`/artists/${artistId}/top-tracks?market=IT`),
                apiClient.get(`/artists/${artistId}/albums?include_groups=album,single,appears_on,compilation&limit=50&market=IT`),
                apiClient.get(`/me/following/contains?type=artist&ids=${artistId}`),
            ]);

            if (artistRes.status === 'rejected') {
                console.error("Failed to fetch artist details:", artistRes.reason);
                throw new Error("Impossibile caricare i dati dell'artista.");
            }
            setArtist(artistRes.value.data);

            if (topTracksRes.status === 'fulfilled' && topTracksRes.value.data.tracks) {
                setTracks(topTracksRes.value.data.tracks);
            }

            if (discographyRes.status === 'fulfilled' && discographyRes.value.data.items) {
                 const uniqueItems = [...new Map((discographyRes.value.data.items as DiscographyItem[]).filter(Boolean).map((item) => [item.id, item])).values()];
                 setDiscography(uniqueItems);
            }
            
            if (followingStatusRes.status === 'fulfilled' && followingStatusRes.value.data) {
                setIsFollowing(followingStatusRes.value.data[0]);
            }

        } catch (err: any) {
            console.error("Error loading artist details:", err);
            setError("Impossibile caricare i dettagli dell'artista in questo momento.");
        } finally {
            setIsLoading(false);
        }
    }, [artistId]);

    useEffect(() => {
        fetchDetails();
    }, [fetchDetails]);

    const handleToggleFollow = async () => {
        if (!artist) return;
        const shouldFollow = !isFollowing;
        setIsFollowing(shouldFollow); // Optimistic UI update
    
        try {
            if (shouldFollow) {
                await apiClient.put(`/me/following?type=artist&ids=${artistId}`);
            } else {
                await apiClient.delete(`/me/following?type=artist&ids=${artistId}`);
            }
            onFollowChange();
        } catch (e) {
            console.error("Failed to toggle follow status", e);
            setIsFollowing(!shouldFollow); // Revert on error
        }
    };
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
    };

    const discographyItems = useMemo(() => discography.map(item => ({
        ...item,
        description: `${new Date(item.release_date).getFullYear()} • ${item.album_type}`
    })), [discography]);

    if (isLoading) {
        const loadingIndicatorText = isNight ? 'text-zinc-400' : 'text-zinc-600';
        return (
            <div className="flex-grow flex flex-col justify-center items-center">
                <div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} />
                <p className={`mt-4 ${loadingIndicatorText}`}>Caricamento dettagli artista...</p>
            </div>
        );
    }

    if (error) {
        const errorButtonClasses = isNight
            ? 'mt-6 px-6 py-2 bg-blue-500/60 hover:bg-blue-500/80 text-white rounded-full font-semibold transition-colors'
            : 'mt-6 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-full font-semibold transition-colors';
        return (
          <div className="flex-grow flex flex-col justify-center items-center text-center p-4">
            <FiAlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <p className={`font-semibold ${theme.textPrimary}`}>{error}</p>
            <button onClick={fetchDetails} className={errorButtonClasses}>Riprova</button>
          </div>
        );
    }

    if (!artist) {
        return <div className="flex-grow flex justify-center items-center text-red-400">Artist not found.</div>;
    }
    
    const trackUris = tracks.map(t => t.uri);

    return (
        <div className="flex-1 min-h-0 overflow-y-auto pb-6 hide-scrollbar relative">
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

            <header className="flex items-end gap-6 mb-6 pt-4 px-6">
                {artist.images?.[0]?.url ? (
                    <img src={artist.images[0].url} alt={artist.name} className="w-48 h-48 rounded-full object-cover shadow-2xl" />
                ) : (
                    <div className="w-48 h-48 rounded-full bg-zinc-800 flex items-center justify-center shadow-2xl">
                        <FiMusic className="w-24 h-24 text-zinc-500" />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{artist.name}</h1>
                    <p className={`text-sm ${theme.textSecondary}`}>{formatFollowers(artist.followers.total)} followers</p>
                    <div className="flex items-center gap-4 mt-4">
                        {tracks.length > 0 && (
                            <button onClick={() => isPlayerReady && onPlay({ uris: trackUris }, artist)} disabled={!isPlayerReady} className="bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                                <FiPlay className="w-7 h-7 ml-1" />
                            </button>
                        )}
                        <button
                            onClick={handleToggleFollow}
                            disabled={isFollowing && artist.followers.total <= 1} // Can't unfollow if you're the only one
                            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label={isFollowing ? 'Smetti di seguire' : 'Segui'}
                        >
                            <FiHeart className={`w-8 h-8 transition-all ${isFollowing ? 'fill-current text-green-400' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>
            
            <div className="px-6">
                <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Popolari</h2>
                <motion.div
                  className="flex flex-col gap-1"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                    {tracks.slice(0, 5).map((track, index) => {
                        const isPlaying = isPlayingContext && track.id === currentTrackId;
                        const activeColor = isNight ? 'text-green-400' : 'text-green-600';
                        const trackItemForOptimistic = {
                            id: track.id,
                            name: track.name,
                            type: 'track' as const,
                            uri: track.uri,
                            images: track.album?.images || artist.images || [],
                            album: track.album,
                            artists: [{ name: artist.name }],
                            duration_ms: track.duration_ms
                        };
                        const isQueued = queuedTrackId === track.id;
                        return (
                            <motion.div
                                key={track.id}
                                variants={itemVariants}
                                onClick={() => isPlayerReady && onPlay({ uris: trackUris, offset: { position: index } }, trackItemForOptimistic)}
                                className={`flex items-center gap-4 p-2 rounded-md ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`}`}
                            >
                                <span className={`w-6 text-center font-medium ${theme.textSecondary}`}>{index + 1}</span>
                                <img src={track.album.images[2].url} alt={track.album.name} className="w-10 h-10 rounded" />
                                <div className="flex-grow flex items-center gap-2 overflow-hidden">
                                    {isPlaying && <AnimatedEqualizer className={`w-4 h-4 flex-shrink-0 ${activeColor}`} />}
                                    <span className={`font-medium truncate ${isPlaying ? activeColor : theme.textPrimary}`}>{track.name}</span>
                                    {track.explicit && <span className="flex-shrink-0 text-xs bg-zinc-500/50 text-white rounded-sm px-1 py-0.5">E</span>}
                                </div>
                                <span className={`text-sm text-right ${theme.textSecondary}`}>{formatDuration(track.duration_ms)}</span>
                                <button
                                    onClick={(e) => handleAddToQueue(e, track)}
                                    title="Aggiungi alla coda"
                                    aria-label="Aggiungi alla coda"
                                    className={`p-2 rounded-full transition-all duration-200 active:scale-90 flex-shrink-0 ${
                                        isQueued 
                                            ? 'text-emerald-400 bg-emerald-500/20' 
                                            : (isNight ? 'text-zinc-400 hover:text-white hover:bg-white/10' : 'text-zinc-500 hover:text-black hover:bg-black/10')
                                    }`}
                                >
                                    {isQueued ? <FiCheck className="w-4 h-4 text-emerald-400" /> : <FiPlus className="w-4 h-4" />}
                                </button>
                            </motion.div>
                        );
                    })}
                </motion.div>
            </div>

            <div className="mt-8">
                <ContentCarousel
                    title="Discografia"
                    items={discographyItems}
                    isNight={isNight}
                    onSelectItem={onSelectItem}
                    keyPrefix="artist-discog"
                />
            </div>
        </div>
    );
};

export default ArtistDetailView;
