import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import { FiChevronLeft, FiChevronRight, FiFolder } from 'react-icons/fi';
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
            if (offset === 0) {
                setPlaylists([]);
            }

            try {
                let items: any[] = [];
                let next: string | null = null;

                // 1. Primary endpoint: /v1/browse/categories/{category_id}/playlists
                try {
                    console.log(`[CategoryPlaylists] Fetching /browse/categories/${categoryId}/playlists...`);
                    const response = await apiClient.get(`/browse/categories/${encodeURIComponent(categoryId)}/playlists`, {
                        params: {
                            country: 'IT',
                            limit,
                            offset,
                            _t: Date.now()
                        }
                    });

                    if (response.data?.playlists?.items && response.data.playlists.items.length > 0) {
                        items = response.data.playlists.items;
                        next = response.data.playlists.next;
                    }
                } catch (catErr: any) {
                    console.warn(`[CategoryPlaylists] /browse/categories/${categoryId}/playlists returned status ${catErr?.response?.status || catErr.message}. Attempting search fallback...`, catErr);
                }

                // 2. Fallback endpoint: Search for playlists by title or categoryId
                if (items.length === 0) {
                    const searchQuery = title || categoryId;
                    console.log(`[CategoryPlaylists] Running fallback search for playlist query: "${searchQuery}"`);
                    const searchRes = await apiClient.get('/search', {
                        params: {
                            q: searchQuery,
                            type: 'playlist',
                            market: 'IT',
                            limit,
                            offset,
                            _t: Date.now()
                        }
                    });

                    if (searchRes.data?.playlists?.items) {
                        items = searchRes.data.playlists.items;
                        next = searchRes.data.playlists.next;
                    }
                }

                const validItems = items.filter(Boolean);
                setPlaylists(validItems);
                setHasNextPage(next !== null && validItems.length >= limit);

            } catch (err: any) {
                 console.error(`[CategoryPlaylists] Critical error fetching playlists for category "${categoryId}" (${title}):`, err);
                 setError('Impossibile caricare le playlist per questa categoria.');
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

    if (loading && offset === 0) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
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
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col">
            <h2 className={`text-3xl font-bold mb-6 ${textColor}`}>{title}</h2>

            {error && validPlaylists.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FiFolder className={`w-14 h-14 mb-3 opacity-40 ${themeColor}`} />
                    <p className={`text-base font-semibold ${textColor}`}>Nessuna playlist trovata</p>
                    <p className={`text-xs mt-1 max-w-sm ${themeColor}`}>
                        Non sono disponibili playlist per "{title}" al momento.
                    </p>
                </div>
            ) : validPlaylists.length > 0 ? (
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
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FiFolder className={`w-14 h-14 mb-3 opacity-40 ${themeColor}`} />
                    <p className={`text-base font-semibold ${textColor}`}>Nessuna playlist trovata</p>
                    <p className={`text-xs mt-1 max-w-sm ${themeColor}`}>
                        Nessun contenuto disponibile per la categoria "{title}".
                    </p>
                </div>
            )}
        </div>
    );
};

export default CategoryPlaylistsView;
