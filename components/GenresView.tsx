import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';
import { FiChevronLeft, FiChevronRight, FiFolder } from 'react-icons/fi';

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

const GenresView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [categories, setCategories] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [offset, setOffset] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const limit = 20;

    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/browse/categories', {
                    params: {
                        country: 'IT',
                        limit,
                        offset,
                        _t: Date.now()
                    }
                });
                const items = response.data?.categories?.items || [];
                const next = response.data?.categories?.next;

                const mappedCategories = items.map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    uri: cat.href,
                    images: cat.icons,
                    type: 'category',
                }));

                setCategories(mappedCategories);
                setHasNextPage(next !== null && items.length >= limit);
            } catch (err) {
                console.error('Failed to fetch categories', err);
                setError('Could not load genres and moods.');
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, [offset]);

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
            <h2 className={`text-3xl font-bold mb-6 ${textColor}`}>Generi e Mood</h2>

            {error && categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FiFolder className={`w-14 h-14 mb-3 opacity-40 ${themeColor}`} />
                    <p className={`text-base font-semibold ${textColor}`}>Nessun genere trovato</p>
                    <p className={`text-xs mt-1 max-w-sm ${themeColor}`}>{error}</p>
                </div>
            ) : categories.length > 0 ? (
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
                        {categories.map((category, index) => (
                            <motion.div variants={itemVariants} key={`genre-${category.id}-${index}`}>
                              <PlaylistItem item={category} isNight={isNight} onSelectItem={onSelectItem} />
                            </motion.div>
                        ))}
                    </motion.div>
                    <div className="mt-8">
                        <PaginationControls />
                    </div>
                </>
            ) : null}
        </div>
    );
};

export default GenresView;
