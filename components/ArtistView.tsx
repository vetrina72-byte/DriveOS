
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiLoader, FiPlay, FiArrowLeft } from 'react-icons/fi';

interface ArtistViewProps {
    artistId: string;
    onBack: () => void;
}

const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;
};

export default function ArtistView({ artistId, onBack }: ArtistViewProps) {
    const { accessToken, play } = useAuth();
    const [artist, setArtist] = useState<any>(null);
    const [topTracks, setTopTracks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken || !artistId) return;

        const fetchArtistData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const [artistRes, topTracksRes] = await Promise.all([
                    axios.get(`https://api.spotify.com/v1/artists/${artistId}`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }),
                    axios.get(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=IT`, {
                        headers: { Authorization: `Bearer ${accessToken}` },
                    }),
                ]);
                setArtist(artistRes.data);
                setTopTracks(topTracksRes.data.tracks);
            } catch (err) {
                console.error('Failed to fetch artist data', err);
                setError("Impossibile caricare i dati dell'artista.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchArtistData();
    }, [accessToken, artistId]);
    
    const handleTrackPlay = (trackUri: string) => {
        play({ uris: [trackUri] });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <FiLoader className="animate-spin text-zinc-400 text-4xl" />
            </div>
        );
    }

    if (error || !artist) {
        return <div className="text-center text-red-400 p-8">{error || 'Artista non trovato.'}</div>;
    }

    return (
        <div className="w-full h-full flex flex-col overflow-hidden animate-fade-in">
            <header className="flex-shrink-0 p-4 pt-0 pl-6 relative h-64 flex items-end">
                <div className="absolute inset-0 overflow-hidden">
                     {artist.images?.[0]?.url && (
                        <img src={artist.images[0].url} alt={artist.name} className="w-full h-full object-cover opacity-30" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/70 to-transparent"></div>
                </div>
                <div className="relative z-10 flex items-center gap-4">
                     <button onClick={onBack} className="absolute -top-12 left-0 p-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                        <FiArrowLeft size={24} />
                    </button>
                    <div>
                        <h2 className="text-5xl font-extrabold">{artist.name}</h2>
                        <p className="text-zinc-300 text-sm mt-1">{artist.followers.total.toLocaleString('it-IT')} follower</p>
                    </div>
                </div>
            </header>

            <main className="flex-grow overflow-y-auto px-6 pb-6 mt-4">
                <h3 className="text-xl font-bold mb-2">Popolari</h3>
                <table className="w-full text-left">
                    <tbody>
                        {topTracks.map((track: any, index: number) => (
                            <tr 
                                key={track.id + index} 
                                className="group hover:bg-white/10 rounded-lg transition-colors"
                                onDoubleClick={() => handleTrackPlay(track.uri)}
                            >
                                <td className="p-2 text-center text-zinc-400 w-8">
                                    <span className="group-hover:hidden">{index + 1}</span>
                                     <button onClick={() => handleTrackPlay(track.uri)} className="hidden group-hover:inline-block">
                                        <FiPlay/>
                                    </button>
                                </td>
                                <td className="p-2 flex items-center gap-3">
                                    {track.album.images?.[0]?.url && (
                                        <img src={track.album.images[0].url} alt={track.album.name} className="w-10 h-10 rounded" />
                                    )}
                                    <div>
                                        <p className="font-semibold text-white truncate">{track.name}</p>
                                    </div>
                                </td>
                                <td className="p-2 text-zinc-400 w-24">{formatDuration(track.duration_ms)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
        </div>
    );
}
