import React, { useState, useEffect } from 'react';
import apiClient from '../api';
import { FiLoader } from 'react-icons/fi';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion, Variants } from 'framer-motion';

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

// FIX: Add explicit `Variants` type to fix type inference issue with the `ease` property.
const itemVariants: Variants = {
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

const PodcastGridView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [shows, setShows] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchShows = async () => {
            setLoading(true);
            setError(null);
            try {
                // First, get the list of saved shows. This response contains simplified show objects.
                const savedShowsResponse = await apiClient.get('/me/shows?limit=50');
                const savedItems = savedShowsResponse.data.items;

                if (!savedItems || savedItems.length === 0) {
                    setShows([]);
                    setLoading(false);
                    return;
                }

                // Extract the IDs of the shows to fetch their full details.
                const showIds = savedItems.map((item: any) => item.show?.id).filter(Boolean);

                if (showIds.length === 0) {
                    setShows([]);
                    setLoading(false);
                    return;
                }

                // Fetch the full details for all shows in a single batch request.
                // This provides access to higher resolution images than the simplified objects.
                const fullShowsResponse = await apiClient.get(`/shows?ids=${showIds.join(',')}`);
                
                // The API returns a `shows` array. Filter out any null entries for shows that might not have been found.
                const fullShows = fullShowsResponse.data.shows.filter(Boolean);
                
                setShows(fullShows);

            } catch (err) {
                console.error('Failed to fetch podcasts/shows', err);
                setError('Could not load your podcasts.');
            } finally {
                setLoading(false);
            }
        };
        fetchShows();
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
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>I tuoi Podcast</h2>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {shows.map((show, index) => (
                    <motion.div variants={itemVariants} key={`podcast-grid-${show.id}-${index}`}>
                      <PlaylistItem item={show} isNight={isNight} onSelectItem={onSelectItem} />
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default PodcastGridView;