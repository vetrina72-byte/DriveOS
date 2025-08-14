
import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiPlay, FiLoader, FiClock, FiMusic } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';

export type ItemType = 'playlist' | 'album';

interface Track {
    id: string;
    name: string;
    artists: { name: string }[];
    duration_ms: number;
    uri: string;
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
    onPlay: (contextUri?: string, options?: { trackUri?: string }) => void;
}

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const PlaylistDetailView: React.FC<PlaylistDetailViewProps> = ({ itemId, itemType, isNight, onPlay }) => {
    const [details, setDetails] = useState<PlaylistDetails | AlbumDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get(`/${itemType}s/${itemId}`);
                setDetails(response.data);
            } catch (err) {
                console.error(`Failed to fetch ${itemType} details`, err);
                setError(`Could not load ${itemType} details.`);
            } finally {
                setLoading(false);
            }
        };

        fetchDetails();
    }, [itemId, itemType]);
    
    const theme = {
        bg: isNight ? 'bg-[#181818]' : 'bg-gray-100',
        textPrimary: isNight ? 'text-white' : 'text-zinc-800',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
        border: isNight ? 'border-white/10' : 'border-black/10',
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error || !details) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Details not found.'}</div>;
    }

    const tracks = itemType === 'playlist' 
        ? (details as PlaylistDetails).tracks.items.map(item => item.track).filter(Boolean)
        : (details as AlbumDetails).tracks.items;

    const subText = itemType === 'album' 
        ? `${(details as AlbumDetails).artists?.[0].name} • ${new Date((details as AlbumDetails).release_date).getFullYear()}`
        : details.description;

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6">
            {/* Header */}
            <div className="flex items-end gap-6 mb-6 pt-4">
                {details.images?.[0]?.url ? (
                    <img src={details.images[0].url} alt={details.name} className="w-48 h-48 rounded-md object-cover shadow-2xl" />
                ) : (
                    <div className="w-48 h-48 rounded-md bg-zinc-800 flex items-center justify-center shadow-2xl">
                        <FiMusic className="w-24 h-24 text-zinc-500" />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <span className="text-sm font-bold uppercase">{itemType}</span>
                    <h1 className="text-5xl font-bold tracking-tight">{details.name}</h1>
                    <p className={`text-sm ${theme.textSecondary}`} dangerouslySetInnerHTML={{ __html: subText || '' }}></p>
                    <button onClick={() => onPlay(details.uri)} className="mt-4 bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                        <FiPlay className="w-7 h-7 ml-1" />
                    </button>
                </div>
            </div>

            {/* Track List Header */}
            <div className={`grid grid-cols-[3rem_1fr_1fr_5rem] gap-4 px-4 py-2 border-b ${theme.border} text-sm font-medium ${theme.textSecondary}`}>
                <div className="text-center">#</div>
                <div>Titolo</div>
                <div>Album</div>
                <div className="text-right"><FiClock /></div>
            </div>

            {/* Track List */}
            <div className="mt-2">
                {tracks.map((track, index) => (
                    <div 
                        key={track.id + index}
                        onClick={() => onPlay(details.uri, { trackUri: track.uri })}
                        className={`grid grid-cols-[3rem_1fr_1fr_5rem] gap-4 items-center p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                    >
                        <div className={`text-center ${theme.textSecondary}`}>{index + 1}</div>
                        <div className="flex flex-col">
                            <span className={theme.textPrimary}>{track.name}</span>
                            <span className={`text-sm ${theme.textSecondary}`}>{track.artists.map(a => a.name).join(', ')}</span>
                        </div>
                        <div className={`text-sm truncate ${theme.textSecondary}`}>
                            {itemType === 'playlist' ? (track as any).album.name : details.name}
                        </div>
                        <div className={`text-sm text-right ${theme.textSecondary}`}>{formatDuration(track.duration_ms)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlaylistDetailView;
