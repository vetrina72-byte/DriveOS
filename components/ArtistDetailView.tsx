
import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiPlay, FiLoader, FiClock, FiMusic } from 'react-icons/fi';

interface Artist {
    id: string;
    name: string;
    images: { url: string }[];
    followers: { total: number };
}

interface Track {
    id: string;
    name: string;
    artists: { name: string }[];
    album: { name: string; images: { url: string }[] };
    duration_ms: number;
    uri: string;
    explicit: boolean;
}

interface ArtistDetailViewProps {
    artistId: string;
    isNight: boolean;
    onPlay: (options: { uris?: string[], offset?: any }) => void;
}

const formatFollowers = (count: number) => {
    return new Intl.NumberFormat('it-IT').format(count);
};

const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const ArtistDetailView: React.FC<ArtistDetailViewProps> = ({ artistId, isNight, onPlay }) => {
    const [artist, setArtist] = useState<Artist | null>(null);
    const [tracks, setTracks] = useState<Track[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDetails = async () => {
            setLoading(true);
            setError(null);
            try {
                const [artistRes, topTracksRes] = await Promise.all([
                    apiClient.get(`/artists/${artistId}`),
                    apiClient.get(`/artists/${artistId}/top-tracks?market=IT`)
                ]);
                setArtist(artistRes.data);
                setTracks(topTracksRes.data.tracks);
            } catch (err) {
                console.error(`Failed to fetch artist details`, err);
                setError(`Could not load artist details.`);
            } finally {
                setLoading(false);
            }
        };
        fetchDetails();
    }, [artistId]);
    
    const theme = {
        textPrimary: isNight ? 'text-white' : 'text-zinc-800',
        textSecondary: isNight ? 'text-[#b3b3b3]' : 'text-zinc-500',
        hover: isNight ? 'hover:bg-white/10' : 'hover:bg-black/10',
    };

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${theme.textSecondary}`} /></div>;
    }

    if (error || !artist) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error || 'Artist not found.'}</div>;
    }
    
    const trackUris = tracks.map(t => t.uri);

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6">
            <header className="flex items-end gap-6 mb-6 pt-4">
                {artist.images?.[0]?.url ? (
                    <img src={artist.images[0].url} alt={artist.name} className="w-48 h-48 rounded-full object-cover shadow-2xl" />
                ) : (
                    <div className="w-48 h-48 rounded-full bg-zinc-800 flex items-center justify-center shadow-2xl">
                        <FiMusic className="w-24 h-24 text-zinc-500" />
                    </div>
                )}
                <div className="flex flex-col gap-3">
                    <h1 className="text-5xl font-bold tracking-tight">{artist.name}</h1>
                    <p className={`text-sm ${theme.textSecondary}`}>{formatFollowers(artist.followers.total)} followers</p>
                    <button onClick={() => onPlay({ uris: trackUris })} className="mt-4 bg-green-500 text-black w-14 h-14 rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform">
                        <FiPlay className="w-7 h-7 ml-1" />
                    </button>
                </div>
            </header>

            <h2 className={`text-2xl font-bold mb-4 ${theme.textPrimary}`}>Popolari</h2>
            <div className="flex flex-col">
                {tracks.map((track, index) => (
                    <div 
                        key={track.id + index}
                        onClick={() => onPlay({ uris: trackUris, offset: { position: index } })}
                        className={`flex items-center gap-4 p-2 px-4 rounded-md cursor-pointer ${theme.hover}`}
                    >
                        <span className={`w-8 text-center font-medium ${theme.textSecondary}`}>{index + 1}</span>
                        <img 
                          src={track.album.images?.[2]?.url || track.album.images?.[0]?.url} 
                          alt={track.album.name} 
                          className="w-10 h-10 rounded flex-shrink-0 object-cover" 
                        />
                        <div className="flex-grow flex flex-col overflow-hidden">
                            <span className={`truncate font-medium ${theme.textPrimary}`}>{track.name}</span>
                            {track.explicit && <span className="text-xs text-zinc-400">Explicit</span>}
                        </div>
                        <div className={`flex-shrink-0 text-sm font-medium text-right ${theme.textSecondary}`}>{formatDuration(track.duration_ms)}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ArtistDetailView;