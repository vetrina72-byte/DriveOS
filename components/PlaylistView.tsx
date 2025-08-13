
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiLoader, FiMusic, FiPlay, FiArrowLeft } from 'react-icons/fi';

interface PlaylistViewProps {
    playlistId: string;
    onBack: () => void;
    onNavigate: (view: any) => void;
}

const formatDuration = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${Number(seconds) < 10 ? '0' : ''}${seconds}`;
};

export default function PlaylistView({ playlistId, onBack, onNavigate }: PlaylistViewProps) {
    const { accessToken, play } = useAuth();
    const [playlist, setPlaylist] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken || !playlistId) return;

        const fetchPlaylist = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await axios.get(`https://api.spotify.com/v1/playlists/${playlistId}`, {
                    headers: { Authorization: `Bearer ${accessToken}` },
                });
                setPlaylist(response.data);
            } catch (err) {
                console.error('Failed to fetch playlist', err);
                setError('Impossibile caricare la playlist.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlaylist();
    }, [accessToken, playlistId]);
    
    const handleTrackPlay = (trackIndex: number) => {
        play({
            context_uri: playlist.uri,
            offset: {
                position: trackIndex,
            },
        });
    };
    
    const handleArtistClick = (artistId: string, artistName: string) => {
        onNavigate({ type: 'artist', id: artistId, name: artistName });
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <FiLoader className="animate-spin text-zinc-400 text-4xl" />
            </div>
        );
    }

    if (error || !playlist) {
        return <div className="text-center text-red-400 p-8">{error || 'Playlist non trovata.'}</div>;
    }

    return (
        <div className="w-full h-full flex flex-col overflow-hidden animate-fade-in">
            <header className="flex-shrink-0 p-4 pt-0 pl-6 flex items-center gap-4">
                 <button onClick={onBack} className="p-2 -ml-2 text-zinc-400 hover:text-white rounded-full hover:bg-white/10 transition-colors">
                    <FiArrowLeft size={24} />
                </button>
                <div className="flex items-center gap-4">
                    {playlist.images?.[0]?.url && (
                        <img src={playlist.images[0].url} alt={playlist.name} className="w-24 h-24 rounded-md shadow-lg" />
                    )}
                    <div>
                        <h2 className="text-3xl font-bold">{playlist.name}</h2>
                        <p className="text-zinc-400 text-sm" dangerouslySetInnerHTML={{ __html: playlist.description }} />
                        <p className="text-zinc-300 text-sm mt-1">Di {playlist.owner.display_name} • {playlist.tracks.total} brani</p>
                    </div>
                </div>
            </header>
            <main className="flex-grow overflow-y-auto px-6 pb-6 mt-4">
                <table className="w-full text-left">
                    <thead>
                        <tr className="text-zinc-400 border-b border-white/10 text-sm">
                            <th className="p-2 w-8 text-center">#</th>
                            <th className="p-2">Titolo</th>
                            <th className="p-2">Album</th>
                            <th className="p-2 w-24">Durata</th>
                        </tr>
                    </thead>
                    <tbody>
                        {playlist.tracks.items.map((item: any, index: number) => (
                            <tr 
                                key={item.track.id + index} 
                                className="group hover:bg-white/10 rounded-lg transition-colors"
                                onDoubleClick={() => handleTrackPlay(index)}
                            >
                                <td className="p-2 text-center text-zinc-400">
                                    <span className="group-hover:hidden">{index + 1}</span>
                                    <button onClick={() => handleTrackPlay(index)} className="hidden group-hover:inline-block">
                                        <FiPlay/>
                                    </button>
                                </td>
                                <td className="p-2 flex items-center gap-3">
                                    {item.track.album.images?.[0]?.url ? (
                                        <img src={item.track.album.images[0].url} alt={item.track.album.name} className="w-10 h-10 rounded" />
                                    ) : (
                                        <div className="w-10 h-10 bg-zinc-800 rounded flex items-center justify-center"><FiMusic/></div>
                                    )}
                                    <div>
                                        <p className="font-semibold text-white truncate">{item.track.name}</p>
                                        <p className="text-sm text-zinc-400 truncate">
                                            {item.track.artists.map((artist: any, artistIndex: number) => (
                                                <React.Fragment key={artist.id}>
                                                    <button onClick={() => handleArtistClick(artist.id, artist.name)} className="hover:underline">{artist.name}</button>
                                                    {artistIndex < item.track.artists.length - 1 && ', '}
                                                </React.Fragment>
                                            ))}
                                        </p>
                                    </div>
                                </td>
                                <td className="p-2 text-zinc-400 truncate">{item.track.album.name}</td>
                                <td className="p-2 text-zinc-400">{formatDuration(item.track.duration_ms)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </main>
        </div>
    );
}
