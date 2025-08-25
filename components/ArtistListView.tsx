
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

const ArtistListView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [artists, setArtists] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchArtists = async () => {
            setLoading(true);
            setError(null);
            try {
                const response = await apiClient.get('/me/top/artists?limit=50&time_range=long_term');
                setArtists(response.data.items);
            } catch (err) {
                console.error('Failed to fetch top artists', err);
                setError('Could not load your top artists.');
            } finally {
                setLoading(false);
            }
        };
        fetchArtists();
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
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>I tuoi Artisti</h2>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
                {artists.map((artist, index) => (
                     <motion.div variants={itemVariants} key={`artist-list-${artist.id}-${index}`}>
                       <PlaylistItem item={{...artist, description: 'Artista'}} isNight={isNight} onSelectItem={onSelectItem} />
                     </motion.div>
                ))}
            </motion.div>
        </div>
    );
};

export default ArtistListView;