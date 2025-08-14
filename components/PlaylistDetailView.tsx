
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { FiLoader, FiPlay, FiMusic, FiClock } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';

interface PlaylistDetailViewProps {
    playlistId: string;
    isNight: boolean;
    onBack: () => void;
    onItemPlay: (item: SpotifyItem) => void;
}

interface PlaylistDetails extends SpotifyItem {
    description: string;
    tracks: { items: { track: SpotifyItem }[] };
}

const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ playlistId, isNight, onBack, onItemPlay }) => {
    const [details, setDetails] = useState<PlaylistDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { isAuthenticated } = useAuth();

    useEffect(() => {
        if (!playlistId || !isAuthenticated) return;

        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get(`/playlists/${playlistId}`);
                setDetails(response.data);
            } catch (err) {
                console.error('Failed to fetch playlist details', err);
                setError('Could not load playlist details.');
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [playlistId, isAuthenticated]);

    const formatDuration = (ms: number) => {
        const minutes = Math.floor(ms / 60000);
        const seconds = ((ms % 60000) / 1000).toFixed(0);
        return `${minutes}:${parseInt(seconds) < 10 ? '0' : ''}${seconds}`;
    };

    const theme = {
        textPrimary: isNight ? 'text-zinc-100' : 'text-zinc-900',
        textSecondary: isNight ? 'text-zinc-400' : 'text-zinc-500',
        bgHeader: isNight ? 'bg-gradient-to-b from-zinc-700 to-transparent' : 'bg-gradient-to-b from-gray-200 to-transparent',
        hoverBg: isNight ? 'hover:bg-white/10' : 'hover:bg-black/5',
    };

    if (loading) {
        return <div className="w-full h-full flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error || !details) {
        return <div className="w-full h-full flex justify-center items-center text-red-400">{error || 'Playlist not found.'}</div>;
    }

    const { name, description, images, tracks, uri } = details;

    return (
        <div className="w-full h-full overflow-y-auto">
            <header className={`sticky top-0 p-6 flex items-end gap-6 h-64 ${theme.bgHeader}`}>
                {images[0]?.url ? (
                    <img src={images[0].url} alt={name} className="w-48 h-48 rounded-lg object-cover shadow-2xl" />
                ) : (
                    <div className="w-48 h-48 rounded-lg bg-zinc-800 flex items-center justify-center shadow-2xl">
                        <FiMusic className="w-16 h-16 text-zinc-500" />
                    </div>
                )}
                <div className="flex flex-col gap-2">
                    <h1 className="text-5xl font-extrabold">{name}</h1>
                    <p className={`${theme.textSecondary} text-sm`} dangerouslySetInnerHTML={{ __html: description || '' }} />
                </div>
            </header>

            <div className="p-6">
                <button onClick={() => onItemPlay({ uri, type: 'playlist', id: playlistId, name, images })} className="bg-green-500 hover:bg-green-600 text-white rounded-full p-4 transition-transform hover:scale-105">
                    <FiPlay className="w-8 h-8 fill-current" />
                </button>
            </div>

            <div className="px-6 pb-6">
                <div className={`grid grid-cols-[auto,1fr,auto] gap-x-4 p-2 border-b ${isNight ? 'border-zinc-700' : 'border-gray-200'} ${theme.textSecondary} text-sm`}>
                    <div className="text-center">#</div>
                    <div>Titolo</div>
                    <FiClock />
                </div>
                <ul>
                    {tracks.items.map((item, index) => {
                        const track = item.track;
                        if (!track) return null;
                        return (
                            <li key={track.id + index} onClick={() => onItemPlay(track)} className={`grid grid-cols-[auto,1fr,auto] gap-x-4 p-3 rounded-lg cursor-pointer ${theme.hoverBg}`}>
                                <div className={`flex items-center justify-center ${theme.textSecondary}`}>{index + 1}</div>
                                <div className="flex flex-col">
                                    <span className={`${theme.textPrimary}`}>{track.name}</span>
                                    <span className={`${theme.textSecondary} text-xs`}>{track.artists?.map(a => a.name).join(', ')}</span>
                                </div>
                                <div className={`${theme.textSecondary} text-sm`}>{formatDuration((track as any).duration_ms)}</div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};

export default PlaylistDetailView;
