

import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';

interface CategoryPlaylistsViewProps {
    categoryId: string;
    title: string;
    isNight: boolean;
    onSelectItem: (item: SpotifyItem) => void;
    onBack: () => void;
}

// List of special category IDs that have curated playlists and work with the /browse/categories endpoint
// but do not work with the genre-based search endpoint.
const SPECIAL_PLAYLIST_CATEGORIES = ['toplists', '0JQ5DAqbMKF2JckPAnMAhA'];

const CategoryPlaylistsView: React.FC<CategoryPlaylistsViewProps> = ({ categoryId, title, isNight, onSelectItem, onBack }) => {
    const [playlists, setPlaylists] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPlaylists = async () => {
            setLoading(true);
            setError(null);
            setPlaylists([]); // Clear previous results
            try {
                let response;
                
                // For special curated categories like "Charts" or "Made For You", use the direct endpoint.
                if (SPECIAL_PLAYLIST_CATEGORIES.includes(categoryId)) {
                     response = await apiClient.get(`/browse/categories/${categoryId}/playlists`, {
                        params: { country: 'IT', limit: 50 }
                    });
                } else {
                    // For standard genres, use the search endpoint as the old category endpoint is obsolete for them.
                    const searchQuery = `genre:"${title}"`;
                    response = await apiClient.get(`/search`, {
                        params: {
                            q: searchQuery,
                            type: 'playlist',
                            market: 'IT',
                            limit: 50,
                        }
                    });
                }
                
                if (response.data?.playlists?.items) {
                    setPlaylists(response.data.playlists.items);
                } else {
                    // If no items, playlists array remains empty, triggering the "not found" message
                    setPlaylists([]);
                }
            } catch (err: any) {
                 console.error(`Failed to fetch playlists for category "${title}" (ID: ${categoryId})`, err);
                 setError('Could not load playlists for this category.');
            } finally {
                setLoading(false);
            }
        };

        if (categoryId && title) {
            fetchPlaylists();
        }
    }, [categoryId, title]);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
    const textColor = isNight ? 'text-white' : 'text-black';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    // CRITICAL FIX: The API can return `null` in the items array. Filter them out before mapping to prevent crashes.
    const validPlaylists = playlists.filter(Boolean);

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${textColor}`}>{title}</h2>

            {validPlaylists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {validPlaylists.map((playlist, index) => (
                        <PlaylistItem 
                            key={`cat-playlist-${playlist.id}-${index}`} 
                            item={playlist} 
                            isNight={isNight} 
                            onSelectItem={onSelectItem} 
                        />
                    ))}
                </div>
            ) : (
                <div className={`text-center mt-10 text-lg ${themeColor}`}>
                    {`Nessuna playlist trovata per il genere "${title}".`}
                </div>
            )}
        </div>
    );
};

export default CategoryPlaylistsView;