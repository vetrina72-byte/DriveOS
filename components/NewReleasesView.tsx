

import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
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

// FIX: The 'Variants' type from framer-motion can be overly strict with string-based easing types. Removing the explicit type annotation allows TypeScript to infer a compatible type, resolving the error.
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      ease: "easeOut",
      duration: 0.3
    }
  }
};

const NewReleasesView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [albums, setAlbums] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchNewReleases = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/browse/new-releases', {
                    params: {
                        country: 'IT',
                        limit: 50,
                    }
                });
                // The API can return null items, filter them out to be safe
                const validAlbums = response.data.albums.items.filter(Boolean);
                setAlbums(validAlbums);
            } catch (err) {
                console.error('Failed to fetch new releases', err);
                setError('Could not load new releases.');
            } finally {
                setLoading(false);
            }
        };
        fetchNewReleases();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><FiLoader className={`animate-spin text-4xl ${themeColor}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>Nuove Uscite</h2>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {albums.map((album, index) => (
                    <motion.div variants={itemVariants} key={`new-release-${album.id}-${index}`}>
                      <PlaylistItem item={album} isNight={isNight} onSelectItem={onSelectItem} />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default NewReleasesView;