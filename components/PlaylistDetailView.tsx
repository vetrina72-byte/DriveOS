import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../spotifyClient';
import { FiPlay, FiClock, FiMusic, FiHeart } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
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

export type ItemType = 'playlist' | 'album';

interface SavedTrackObject {
    added_at: string;
    track: Track;
}

interface Track {
    id: string;
    name: string;
    artists: { name: string }[];
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

        if (isLikedSongs) {
            onPlay({ uris: tracks.map(t => t.uri), offset: { position: index } }, details);
        } else if (details?.uri) {
            onPlay({ context_uri: details.uri, offset: { position: index } }, details);
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
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 hide-scrollbar">
            {/* Header */}
            <header className="flex items-end gap-6 mb-6 pt-4">
                 {isLikedSongs ? (
                     <div className="w-48 h-48 rounded-md bg-gradient-to-br from-indigo-800 to-purple-800 flex items-center justify-center shadow-2xl flex-shrink-0">
                        <FiHeart className="w-24 h-24 text-white/90" />
                     </div>
                 ) : details.images?.[0]?.url ? (
                    <img src={details.images[0].url} alt={details.name} className="w-48 h-48 rounded-md object-cover shadow-2xl flex-shrink-0" />
                ) : (
                    <div className={`w-48 h-48 rounded-md flex items-center justify-center shadow-2xl flex-shrink-0 ${theme.placeholderBg}`}>
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
            <div className={`grid grid-cols-[3rem_auto_1fr_1fr_5rem] gap-4 px-4 py-2 border-b ${theme.border} text-sm font-medium ${theme.textSecondary}`}>
                <div className="text-center">#</div>
                <div/>
                <div>Titolo</div>
                <div>Album</div>
                <div className="text-right"><FiClock /></div>
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

                    return (
                        <motion.div
                            key={`${track.id}-${index}`}
                            variants={itemVariants}
                            onClick={() => handleTrackPlay(track.uri, index)}
                            className={`grid grid-cols-[3rem_auto_1fr_1fr_5rem] gap-4 items-center p-2 px-4 rounded-md ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`} ${isCurrentTrack ? (isNight ? 'bg-white/5' : 'bg-black/5') : ''}`}
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
                            <div className={`text-sm text-right ${theme.textSecondary}`}>{formatDuration(track.duration_ms)}</div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default PlaylistDetailView;
