import React, { useState, useEffect } from 'react';
import { FiLoader, FiChevronLeft, FiPlay, FiMusic, FiHeart } from 'react-icons/fi';
import type { YouTubeTrackInfo } from '../types';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

const YOUTUBE_API_KEY = process.env.VITE_YOUTUBE_API_KEY || "AIzaSyArzF2ad4FR6Ic_MFtd6JQ1cALR8j960sk";

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
}

const YouTubePlaylistDetailView: React.FC<YouTubePlaylistDetailViewProps> = ({ playlist, isNight, onBack, onPlayTrack }) => {
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
            try {
                const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${playlist.id}&maxResults=50&key=${YOUTUBE_API_KEY}`);
                if (!response.ok) {
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
            } catch (err) {
                console.error("Failed to fetch playlist items:", err);
                setError("Could not load playlist content.");
            } finally {
                setLoading(false);
            }
        };

        fetchPlaylistItems();
    }, [playlist.id, playlist.description]);

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
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400 p-4 text-center">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <header className="flex items-end gap-6 mb-6 pt-4">
                {playlist.images?.[0]?.url ? (
                    <img src={playlist.images[0].url} alt={playlist.name} className="w-48 h-48 rounded-md object-cover shadow-2xl flex-shrink-0" />
                ) : (
                    <div className={`w-48 h-48 rounded-md flex items-center justify-center shadow-2xl flex-shrink-0 ${theme.placeholderBg}`}>
                        <FiMusic className={`w-24 h-24 ${theme.placeholderIcon}`} />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <button onClick={onBack} className={`flex items-center gap-1 text-sm font-semibold mb-2 ${theme.textSecondary} ${theme.hover} p-2 -ml-2 rounded-md`}>
                        <FiChevronLeft /> Indietro
                    </button>
                    <span className={`text-sm font-bold uppercase ${theme.textSecondary}`}>Playlist</span>
                    <h1 className="text-5xl font-bold tracking-tight" style={{ color: 'var(--text-primary)'}}>{playlist.name}</h1>
                    <div className="flex items-center gap-4 mt-4">
                        <button onClick={handlePlayAll} disabled={tracks.length === 0} className="bg-red-600 text-white w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100">
                            <FiPlay className="w-7 h-7 ml-1" />
                        </button>
                        <button
                            onClick={() => onToggleYouTubeFavorite(playlist.id)}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            aria-label={isFavorite ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti'}
                        >
                            <FiHeart className={`w-8 h-8 transition-all ${isFavorite ? 'fill-current text-red-500' : ''}`} />
                        </button>
                    </div>
                </div>
            </header>

             <motion.div
              className="mt-2 flex flex-col gap-2"
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
                            className={`flex items-center gap-4 p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                        >
                            <span className={`w-8 text-center font-medium ${theme.textSecondary}`}>{index + 1}</span>
                            <img src={track.thumbnail} alt={track.title} className="w-16 h-10 rounded object-cover flex-shrink-0" />
                            <div className="flex-grow flex flex-col min-w-0">
                                <span className={`truncate font-semibold ${isPlaying ? activeColor : theme.textPrimary}`}>{track.title}</span>
                                <span className={`text-sm truncate ${theme.textSecondary}`}>{track.channelTitle}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default YouTubePlaylistDetailView;