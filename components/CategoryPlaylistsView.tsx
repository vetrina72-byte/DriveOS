import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader, FiChevronLeft, FiChevronRight } from 'react-icons/fi';
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
    const [offset, setOffset] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const limit = 50;

    // Effect to reset offset when category changes
    useEffect(() => {
        setOffset(0);
    }, [categoryId, title]);

    useEffect(() => {
        const fetchPlaylists = async () => {
            setLoading(true);
            setError(null);
            // Clear previous results only when fetching the first page of a new category
            if (offset === 0) {
                setPlaylists([]);
            }
            try {
                // The correct way to get playlists for a category is always this endpoint.
                // The previous search-based method was unreliable.
                const response = await apiClient.get(`/browse/categories/${categoryId}/playlists`, {
                    params: { country: 'IT', limit, offset }
                });
                
                // The response for this endpoint might be different from search. It should have `response.data.playlists.items`.
                if (response.data?.playlists?.items) {
                    setPlaylists(response.data.playlists.items);
                    setHasNextPage(response.data.playlists.next !== null);
                } else {
                    setPlaylists([]);
                    setHasNextPage(false);
                }
            } catch (err: any) {
                 console.error(`Failed to fetch playlists for category "${title}" (ID: ${categoryId})`, err);
                 // Provide a more specific error message if the API returns a 404 or other known issues.
                 const spotifyError = err.response?.data?.error;
                 if (spotifyError?.status === 404) {
                     setError(`Non ci sono playlist disponibili per "${title}".`);
                 } else {
                     setError('Could not load playlists for this category.');
                 }
                 setPlaylists([]);
                 setHasNextPage(false);
            } finally {
                setLoading(false);
            }
        };

        if (categoryId && title) {
            fetchPlaylists();
        }
    }, [categoryId, title, offset, limit]);

    const handlePrev = () => {
        setOffset(prev => Math.max(0, prev - limit));
    };

    const handleNext = () => {
        setOffset(prev => prev + limit);
    };

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
    const textColor = isNight ? 'text-white' : 'text-black';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    const validPlaylists = playlists.filter(Boolean);

    const PaginationControls = () => {
        const buttonClasses = `px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'}`;
    
        return (
            <div className="flex justify-center items-center gap-4">
                <button onClick={handlePrev} disabled={offset === 0} className={buttonClasses} style={{ color: 'var(--text-primary)'}}>
                    <FiChevronLeft className="w-5 h-5"/>
                    Precedente
                </button>
                <button onClick={handleNext} disabled={!hasNextPage} className={buttonClasses} style={{ color: 'var(--text-primary)'}}>
                    Successivo
                    <FiChevronRight className="w-5 h-5"/>
                </button>
            </div>
        );
    };

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col">
            <h2 className={`text-3xl font-bold mb-6 ${textColor}`}>{title}</h2>

            {validPlaylists.length > 0 ? (
                <>
                    <div className="mb-6">
                        <PaginationControls />
                    </div>
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
                     <div className="mt-8">
                        <PaginationControls />
                    </div>
                </>
            ) : (
                <div className={`text-center mt-10 text-lg ${themeColor}`}>
                    {`Nessuna playlist trovata per il genere "${title}".`}
                </div>
            )}
        </div>
    );
};

export default CategoryPlaylistsView;