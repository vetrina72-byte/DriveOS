import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.3
    }
  }
};

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
    }, [categoryId]);

    useEffect(() => {
        const fetchPlaylists = async () => {
            setLoading(true);
            setError(null);
            // Clear previous results only when fetching the first page of a new category
            if (offset === 0) {
                setPlaylists([]);
            }
            try {
                // FIX: Switched to the /search endpoint with a genre filter for more robust playlist fetching,
                // as the /browse/categories/{id}/playlists endpoint was proving unreliable.
                const response = await apiClient.get('/search', {
                    params: {
                        q: `genre:"${title}"`,
                        type: 'playlist',
                        market: 'IT',
                        limit,
                        offset
                    }
                });
                
                if (response.data?.playlists?.items) {
                    setPlaylists(response.data.playlists.items);
                    setHasNextPage(response.data.playlists.next !== null);
                } else {
                    setPlaylists([]);
                    setHasNextPage(false);
                }
            } catch (err: any) {
                 console.error(`Failed to fetch playlists for category "${categoryId}"`, err);
                 setError('Could not load playlists for this category.');
                 setPlaylists([]);
                 setHasNextPage(false);
            } finally {
                setLoading(false);
            }
        };

        if (categoryId) {
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

    if (loading && offset === 0) { // Only show full loader on initial page load
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    // Filter out any null items from the results to prevent crashes
    const validPlaylists = playlists.filter(Boolean);

    const PaginationControls = () => {
        const buttonClasses = `px-4 py-2 rounded-md font-semibold flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isNight ? 'bg-white/10 hover:bg-white/20' : 'bg-black/10 hover:bg-black/20'}`;
    
        return (
            <div className="flex justify-center items-center gap-4">
                <button onClick={handlePrev} disabled={offset === 0 || loading} className={buttonClasses} style={{ color: 'var(--text-primary)'}}>
                    <FiChevronLeft className="w-5 h-5"/>
                    Precedente
                </button>
                <button onClick={handleNext} disabled={!hasNextPage || loading} className={buttonClasses} style={{ color: 'var(--text-primary)'}}>
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
                    <motion.div
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                        {validPlaylists.map((playlist, index) => (
                            <motion.div variants={itemVariants} key={`cat-playlist-${playlist.id}-${index}`}>
                              <PlaylistItem 
                                  item={playlist} 
                                  isNight={isNight} 
                                  onSelectItem={onSelectItem} 
                              />
                            </motion.div>
                        ))}
                    </motion.div>
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