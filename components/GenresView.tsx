import React, { useState, useEffect } from 'react';
import apiClient from '../api';
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

const GenresView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [categories, setCategories] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchCategories = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/browse/categories', {
                    params: {
                        country: 'IT',
                        limit: 50, // Fetch a good number of categories
                    }
                });
                // The API returns category objects that need to be mapped to our SpotifyItem type
                const mappedCategories = response.data.categories.items.map((cat: any) => ({
                    id: cat.id,
                    name: cat.name,
                    uri: cat.href, // Using href as a unique identifier if needed, though id is primary
                    images: cat.icons, // The API uses 'icons' instead of 'images'
                    type: 'category',
                }));
                setCategories(mappedCategories);
            } catch (err) {
                console.error('Failed to fetch categories', err);
                setError('Could not load genres and moods.');
            } finally {
                setLoading(false);
            }
        };
        fetchCategories();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>Generi e Mood</h2>
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
        </div>
    );
};

export default GenresView;