import React, { useState, useEffect } from 'react';
import { FiChevronLeft, FiPlay, FiMusic, FiHeart } from 'react-icons/fi';
import type { YouTubeTrackInfo } from '../types';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { isDemoMode, getPlaylistTracksMock } from '../lib/youtubeDemoFallback';

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || "AIzaSyArzF2ad4FR6Ic_MFtd6JQ1cALR8j960sk";

const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.03 } }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { duration: 0.3 } }
};

interface YouTubePlaylistDetailViewProps {
    playlist: { id: string; name: string; images?: { url: string }[]; description?: string; };
    isNight: boolean;
    onBack: () => void;
    onPlayTrack: (track: YouTubeTrackInfo, playlistContext: YouTubeTrackInfo[]) => void;
    onQuotaError: (error: Error) => void;
}

const AnimatedEqualizer = ({ className = '' }: { className?: string }) => (
    <div className={`flex items-end gap-[2px] h-3.5 w-3.5 ${className}`}>
      <style>{`
        @keyframes yt-equalizer-bar {
          0%, 100% { height: 25%; }
          50% { height: 100%; }
        }
      `}</style>
      <span className="w-0.5 bg-current" style={{ animation: 'yt-equalizer-bar 1.2s ease-in-out infinite', animationDelay: '0s' }}></span>
      <span className="w-0.5 bg-current" style={{ animation: 'yt-equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.2s' }}></span>
      <span className="w-0.5 bg-current" style={{ animation: 'yt-equalizer-bar 1.2s ease-in-out infinite', animationDelay: '-0.4s' }}></span>
    </div>
);

const YouTubePlaylistDetailView: React.FC<YouTubePlaylistDetailViewProps> = ({ playlist, isNight, onBack, onPlayTrack, onQuotaError }) => {
    const [tracks, setTracks] = useState<YouTubeTrackInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { nowPlaying, youTubeFavorites, onToggleYouTubeFavorite } = useAuth();
    
    const currentTrackId = nowPlaying.source === 'youtube' ? nowPlaying.youtubeTrack?.videoId : null;
    const isFavorite = youTubeFavorites.includes(playlist.id);

    useEffect(() => {
        const fetchPlaylistItems = async () => {
            setLoading(true);
            setError(null);
            if (isDemoMode(YOUTUBE_API_KEY)) {
                setTimeout(() => {
                    setTracks(getPlaylistTracksMock(playlist.id));
                    setLoading(false);
                }, 300);
                return;
            }
            try {
                const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlist.id}&maxResults=50&key=${YOUTUBE_API_KEY}`);
                if (!response.ok) {
                    const errorData = await response.json();
                    console.error("YouTube API Error:", errorData);
                    if (errorData.error?.errors?.[0]?.reason === 'quotaExceeded' || errorData.error?.message.toLowerCase().includes('quota')) {
                        throw new Error("quotaExceeded");
                    }
                    throw new Error('Failed to fetch playlist items');
                }
                const data = await response.json();
                const mappedTracks = data.items
                    .map((item: any): YouTubeTrackInfo | null => {
                        if (!item.snippet?.resourceId?.videoId) return null;
                        return {
                            videoId: item.snippet.resourceId.videoId,
                            title: item.snippet.title,
                            channelTitle: item.snippet.videoOwnerChannelTitle || playlist.description || 'YouTube',
                            thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
                            playlistId: playlist.id,
                        };
                    })
                    .filter((track): track is YouTubeTrackInfo => track !== null && track.title !== 'Private video' && track.title !== 'Deleted video');
                
                setTracks(mappedTracks);
            } catch (err: any) {
                console.error("Failed to fetch playlist items:", err);
                const errorToReport = new Error(err.message || "Could not load playlist content.");
                setError(errorToReport.message);
                onQuotaError(errorToReport);
            } finally {
                setLoading(false);
            }
        };

        fetchPlaylistItems();
    }, [playlist.id, playlist.description, onQuotaError]);

    const handlePlayAll = () => {
        if (tracks.length > 0) {
            onPlayTrack(tracks[0], tracks);
        }
    };

    const handlePlaySingle = (track: YouTubeTrackInfo) => {
        onPlayTrack(track, tracks);
    };

    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-black',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
        border: isNight ? 'border-white/10' : 'border-black/10',
        placeholderBg: isNight ? 'bg-zinc-800' : 'bg-zinc-300',
        placeholderIcon: isNight ? 'text-zinc-500' : 'text-zinc-600',
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error && error !== 'quotaExceeded') {
        return <div className="flex-grow flex justify-center items-center text-red-400 p-4 text-center">{error}</div>;
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 hide-scrollbar">
            <header className="flex items-end gap-6 mb-6 pt-4">
                {playlist.images?.[0]?.url ? (
                    <img src={playlist.images[0].url} alt={playlist.name} className="w-36 h-36 sm:w-44 sm:h-44 squircle-card rounded-2xl object-cover shadow-2xl flex-shrink-0 border border-white/10" />
                ) : (
                    <div className={`w-36 h-36 sm:w-44 sm:h-44 squircle-card rounded-2xl flex items-center justify-center shadow-2xl flex-shrink-0 border border-white/10 ${theme.placeholderBg}`}>
                        <FiMusic className={`w-16 h-16 sm:w-20 sm:h-20 ${theme.placeholderIcon}`} />
                    </div>
                )}
                <div className="flex flex-col gap-2.5">
                    <button onClick={onBack} className={`flex items-center gap-1.5 text-xs font-semibold self-start ${theme.textSecondary} ${theme.hover} px-2.5 py-1 rounded-lg transition-colors`}>
                        <FiChevronLeft className="w-4 h-4" /> Indietro
                    </button>
                    <span className="text-xs font-bold uppercase tracking-wider text-red-500">YouTube Music • Playlist</span>
                    <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{playlist.name}</h1>
                    <div className="flex items-center gap-4 mt-2">
                        <button onClick={handlePlayAll} className="bg-red-600 text-white w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer" aria-label="Riproduci tutto">
                            <FiPlay className="w-6 h-6 sm:w-7 sm:h-7 ml-0.5 fill-current" />
                        </button>
                        <button
                            onClick={() => onToggleYouTubeFavorite(playlist.id)}
                            className="p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                            aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                            <FiHeart className={`w-7 h-7 sm:w-8 sm:h-8 transition-all ${isFavorite ? 'fill-current text-red-500' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

            {/* Track List Header matching Spotify */}
            <div className={`grid grid-cols-[2.5rem_auto_1fr_6rem] gap-3 px-4 py-2 border-b ${theme.border} text-xs font-semibold ${theme.textSecondary}`}>
                <div className="text-center">#</div>
                <div className="w-12 text-center">Cover</div>
                <div>Titolo</div>
                <div className="text-right">Canale</div>
            </div>

             <motion.div
              className="mt-2 flex flex-col gap-1"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {tracks.map((track, index) => {
                    const isPlaying = track.videoId === currentTrackId;
                    const activeColor = isNight ? 'text-red-400' : 'text-red-600';

                    return (
                        <motion.div
                            key={track.videoId}
                            variants={itemVariants}
                            onClick={() => handlePlaySingle(track)}
                            className={`grid grid-cols-[2.5rem_auto_1fr_6rem] gap-3 items-center p-2 px-4 squircle-card rounded-xl cursor-pointer transition-all duration-150 ${theme.hover} ${isPlaying ? (isNight ? 'bg-white/10' : 'bg-black/5') : ''}`}
                        >
                            <div className="text-center">
                                {isPlaying ? (
                                    <AnimatedEqualizer className={`mx-auto ${activeColor}`} />
                                ) : (
                                    <span className={`text-xs font-medium ${theme.textSecondary}`}>{index + 1}</span>
                                )}
                            </div>
                            <img src={track.thumbnail} alt={track.title} className="w-12 h-8 sm:w-14 sm:h-9 squircle-sm rounded-lg object-cover flex-shrink-0 shadow-sm" />
                            <div className="flex flex-col min-w-0 pr-2">
                                <span className={`truncate font-bold text-xs sm:text-[13px] ${isPlaying ? activeColor : theme.textPrimary}`}>{track.title}</span>
                                <span className={`text-[10px] sm:text-[11px] truncate ${theme.textSecondary}`}>{track.channelTitle}</span>
                            </div>
                            <div className={`text-[11px] truncate text-right ${theme.textSecondary}`}>
                                {track.channelTitle}
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default YouTubePlaylistDetailView;