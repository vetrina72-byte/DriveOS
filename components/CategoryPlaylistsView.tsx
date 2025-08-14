import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader, FiChevronLeft } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';

interface CategoryPlaylistsViewProps {
    categoryId: string;
    title: string;
    isNight: boolean;
    onSelectItem: (item: SpotifyItem) => void;
    onBack: () => void;
}

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
                const response = await apiClient.get(`/browse/categories/${categoryId}/playlists`, {
                    params: { limit: 50 }
                });
                setPlaylists(response.data.playlists.items);
            } catch (err: any) {
                if (err.response && err.response.status === 404) {
                    // Category exists but has no playlists for this market, not a fatal error.
                    setPlaylists([]);
                } else {
                    console.error(`Failed to fetch playlists for category ${categoryId}`, err);
                    setError('Could not load playlists for this category.');
                }
            } finally {
                setLoading(false);
            }
        };
        fetchPlaylists();
    }, [categoryId]);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
    const textColor = isNight ? 'text-white' : 'text-black';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            {/* The Back button is now handled by the TopNavBar */}
            <h2 className={`text-3xl font-bold mb-6 ${textColor}`}>{title}</h2>

            {playlists.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                    {playlists.map((playlist, index) => (
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
                    Nessuna playlist trovata in questa categoria.
                </div>
            )}
        </div>
    );
};

export default CategoryPlaylistsView;