import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

// FIX: Removed framer-motion type annotation to resolve framer-motion type error.
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

// FIX: Removed framer-motion type annotation to resolve framer-motion type error.
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      // FIX: The 'ease' property with string values like "easeOut" is causing type errors.
      // framer-motion's default easing is sufficient here.
      duration: 0.3
    }
  }
};

interface PlayHistoryObject {
    track: SpotifyItem;
    played_at: string;
    context?: {
        type: 'playlist' | 'album' | 'artist';
        uri: string;
    };
}

const RecentlyPlayedView = ({ isNight, onPlay }: { isNight: boolean, onPlay: (options: { uris?: string[] }) => void }) => {
    const [history, setHistory] = useState<PlayHistoryObject[]>([]);
    const [contextDetails, setContextDetails] = useState<Map<string, any>>(new Map());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isPlayerReady } = useAuth();

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/me/player/recently-played?limit=50');
                const validHistory = response.data.items.filter((item: any) => item.track);
                setHistory(validHistory);

                // Fetch context details
                const contextUris = [...new Set(
                    validHistory
                        .map((item: PlayHistoryObject) => item.context?.uri)
                        .filter(Boolean)
                )] as string[];

                const contextPromises = contextUris.map(uri => {
                    const [,,, type, id] = uri.split(':');
                    if (type === 'playlist' || type === 'album') {
                        return apiClient.get(`/${type}s/${id}`).catch(() => null);
                    }
                    return Promise.resolve(null);
                });

                const contextResponses = await Promise.all(contextPromises);
                const detailsMap = new Map();
                contextResponses.forEach((res, index) => {
                    if (res) {
                        detailsMap.set(contextUris[index], res.data);
                    }
                });
                setContextDetails(detailsMap);

            } catch (err) {
                console.error('Failed to fetch recently played', err);
                setError('Could not load your recently played tracks.');
            } finally {
                setLoading(false);
            }
        };
        fetchHistory();
    }, []);

    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-zinc-800',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
    };
    
    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${theme.textPrimary}`}>Ascoltati di recente</h2>
            <motion.div
              className="flex flex-col"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {history.map(({ track, context }, index) => {
                    let contextText = track.artists?.map(a => a.name).join(', ');
                    if (context && contextDetails.has(context.uri)) {
                        const details = contextDetails.get(context.uri);
                        const typeText = context.type.charAt(0).toUpperCase() + context.type.slice(1);
                        contextText = `Da ${typeText}: ${details.name}`;
                    }

                    return (
                        <motion.div
                            key={`${track.id}-${index}`}
                            variants={itemVariants}
                            onClick={() => isPlayerReady && onPlay({ uris: [track.uri] })}
                            className={`flex items-center gap-4 p-2 px-4 rounded-md ${!isPlayerReady ? 'opacity-60 cursor-not-allowed' : `cursor-pointer ${theme.hover}`}`}
                        >
                            <img 
                              src={track.album?.images?.[2]?.url || track.album?.images?.[0]?.url} 
                              alt={track.album?.name} 
                              className="w-12 h-12 rounded flex-shrink-0 object-cover" 
                            />
                            <div className="flex-grow flex flex-col overflow-hidden">
                                <span className={`truncate font-medium ${theme.textPrimary}`}>{track.name}</span>
                                <span className={`text-sm truncate ${theme.textSecondary}`}>{contextText}</span>
                            </div>
                        </motion.div>
                    );
                })}
            </motion.div>
        </div>
    );
};

export default RecentlyPlayedView;