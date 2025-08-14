

import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';

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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/me/player/recently-played?limit=50');
                // Filter out any items that might not have a track object
                setHistory(response.data.items.filter((item: any) => item.track));
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
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
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
            <div className="flex flex-col">
                {history.map(({ track, context }, index) => {
                    const contextText = context?.type ? `Da ${context.type.charAt(0).toUpperCase() + context.type.slice(1)}` : track.artists?.map(a => a.name).join(', ');

                    return (
                        <div 
                            key={`${track.id}-${index}`}
                            onClick={() => onPlay({ uris: [track.uri] })}
                            className={`flex items-center gap-4 p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
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
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default RecentlyPlayedView;