
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiMusic, FiLoader } from 'react-icons/fi';

interface PlaylistListProps {
    onSelectPlaylist: (uri: string) => void;
}

interface Playlist {
    id: string;
    name: string;
    uri: string;
    images: { url: string }[];
}

const PlaylistList: React.FC<PlaylistListProps> = ({ onSelectPlaylist }) => {
    const { accessToken } = useAuth();
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) return;

        const fetchPlaylists = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await axios.get('https://api.spotify.com/v1/me/playlists', {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    params: {
                        limit: 50
                    }
                });
                setPlaylists(response.data.items);
            } catch (err) {
                console.error('Failed to fetch playlists', err);
                setError('Could not load playlists.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlaylists();
    }, [accessToken]);

    if (isLoading) {
        return (
            <div className="w-1/3 bg-black/50 p-4 flex justify-center items-center">
                <FiLoader className="animate-spin text-zinc-400 text-3xl" />
            </div>
        );
    }
    
    if (error) {
        return <div className="w-1/3 bg-black/50 p-4 text-center text-red-400">{error}</div>
    }

    return (
        <div className="w-1/3 bg-black/50 overflow-y-auto h-full p-4 border-r border-white/10">
            <h2 className="text-xl font-bold mb-4 text-zinc-200">Le Tue Playlist</h2>
            <ul>
                {playlists.map(playlist => (
                    <li key={playlist.id}>
                        <button
                            onClick={() => onSelectPlaylist(playlist.uri)}
                            className="w-full text-left p-2 rounded-lg hover:bg-white/10 transition-colors flex items-center gap-4"
                        >
                            {playlist.images[0] ? (
                                <img src={playlist.images[0].url} alt={playlist.name} className="w-12 h-12 rounded object-cover" />
                            ) : (
                                <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center">
                                    <FiMusic className="text-zinc-500" />
                                </div>
                            )}
                            <span className="font-medium text-zinc-300 truncate">{playlist.name}</span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
};

export default PlaylistList;
