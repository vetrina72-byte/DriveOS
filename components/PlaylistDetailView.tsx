import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiPlay, FiLoader, FiClock, FiMusic, FiHeart } from 'react-icons/fi';
import { SpotifyItem } from './PlaylistItem';

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
    onPlay: (options: { context_uri?: string, uris?: string[], offset?: any }) => void;
}

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

    const isLikedSongs = itemId === 'liked-songs';

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                if (isLikedSongs) {
                    const response = await apiClient.get('/me/tracks?limit=50');
                    setTracks(response.data.items.map((item: SavedTrackObject) => item.track).filter(Boolean));
                    // Create a mock details object for the header
                    setDetails({
                        name: 'Brani che ti piacciono',
                        description: `La tua collezione personale di brani preferiti.`,
                        type: 'playlist',
                        uri: 'special:liked-songs', // Not a real context URI
                    });
                } else {
                    const response = await apiClient.get(`/${itemType}s/${itemId}`);
                    setDetails(response.data);
                    const trackItems = itemType === 'playlist' 
                        ? response.data.tracks.items.map((item: any) => item.track).filter(Boolean)
                        : response.data.tracks.items;
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
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-zinc-800',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
        border: isNight ? 'border-white/10' : 'border-black/10',
        placeholderBg: isNight ? 'bg-zinc-800' : 'bg-zinc-300',
        placeholderIcon: isNight ? 'text-zinc-500' : 'text-zinc-600',
    };

    const handlePlay = () => {
        if (isLikedSongs) {
            onPlay({ uris: tracks.map(t => t.uri) });
        } else if (details?.uri) {
            onPlay({ context_uri: details.uri });
        }
    };
    
    const handleTrackPlay = (trackUri: string, index: number) => {
        if (isLikedSongs) {
            onPlay({ uris: tracks.map(t => t.uri), offset: { position: index } });
        } else if (details?.uri) {
            onPlay({ context_uri: details.uri, offset: { uri: trackUri } });
        }
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error || !details) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Details not found.'}</div>;
    }

    const subText = isLikedSongs ? details.description : (itemType === 'album' 
        ? `${(details as AlbumDetails).artists?.[0].name} • ${new Date((details as AlbumDetails).release_date).getFullYear()}`
        : details.description);
        
    const sanitizedSubText = subText?.replace(/<[^>]*>?/gm, '');

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
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
                    <span className="text-sm font-bold uppercase">{details.type === 'show' ? 'Podcast' : details.type}</span>
                    <h1 className="text-5xl font-bold tracking-tight">{details.name}</h1>
                    {sanitizedSubText && <p className={`text-sm ${theme.textSecondary} line-clamp-2`}>{sanitizedSubText}</p>}
                    <button onClick={handlePlay} className="mt-4 bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                        <FiPlay className="w-7 h-7 ml-1" />
                    </button>
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
            <div className="mt-2">
                {tracks.map((track, index) => (
                    <div 
                        key={`${track.id}-${index}`}
                        onClick={() => handleTrackPlay(track.uri, index)}
                        className={`grid grid-cols-[3rem_auto_1fr_1fr_5rem] gap-4 items-center p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                    >
                        <div className={`text-center ${theme.textSecondary}`}>{index + 1}</div>
                        <div>
                             {track.album?.images?.[0]?.url ? (
                                <img src={track.album.images[0].url} alt={track.album.name} className="w-10 h-10 rounded object-cover" />
                            ) : (
                                <div className={`w-10 h-10 rounded flex items-center justify-center ${theme.placeholderBg}`}>
                                    <FiMusic className={theme.placeholderIcon} />
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col min-w-0">
                            <span className={`truncate ${theme.textPrimary}`}>{track.name}</span>
                            <span className={`text-sm truncate ${theme.textSecondary}`}>{track.artists.map(a => a.name).join(', ')}</span>
                        </div>
                        <div className={`text-sm truncate ${theme.textSecondary}`}>
                            {track.album ? track.album.name : details.name}
                        </div>
                        <div className={`text-sm text-right ${theme.textSecondary}`}>{formatDuration(track.duration_ms)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PlaylistDetailView;