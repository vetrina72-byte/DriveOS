

import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader, FiHeart } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';

const likedSongsItem: SpotifyItem = {
    id: 'liked-songs',
    name: 'Brani che ti piacciono',
    type: 'playlist',
    uri: 'special:liked-songs',
    description: 'I brani che hai salvato.',
    // A placeholder, the custom rendering will handle the icon
    images: [{ url: 'liked-songs-cover' }], 
};

const LikedSongsPlaylistItem = ({ item, onSelectItem }: { item: SpotifyItem; onSelectItem: (item: SpotifyItem) => void }) => {
    return (
        <div onClick={() => onSelectItem(item)} className="p-3 rounded-lg transition-colors duration-200 cursor-pointer w-44 flex-shrink-0 bg-gradient-to-br from-indigo-800 to-purple-800 hover:from-indigo-700 hover:to-purple-700">
            <div className="relative w-full aspect-square mb-3 flex items-center justify-center">
                <FiHeart className="w-16 h-16 text-white/90" />
            </div>
            <h3 className="font-bold truncate text-white">{item.name}</h3>
            <p className="text-sm truncate text-gray-300">{item.description}</p>
        </div>
    );
};


const PlaylistListView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [playlists, setPlaylists] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlaylists = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/me/playlists?limit=50');
                setPlaylists(response.data.items);
            } catch (err) {
                console.error('Failed to fetch playlists', err);
                setError('Could not load your playlists.');
            } finally {
                setLoading(false);
            }
        };
        fetchPlaylists();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>Le tue Playlist</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                <LikedSongsPlaylistItem item={likedSongsItem} onSelectItem={onSelectItem} />
                {playlists.map((playlist, index) => (
                    <PlaylistItem key={`playlist-list-${playlist.id}-${index}`} item={playlist} isNight={isNight} onSelectItem={onSelectItem} />
                ))}
            </div>
        </div>
    );
};

export default PlaylistListView;