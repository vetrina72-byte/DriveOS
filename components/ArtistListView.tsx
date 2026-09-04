import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';
import { useAuth } from '../context/AuthContext';

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

const ArtistListView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [artists, setArtists] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { refreshTrigger } = useAuth();

    useEffect(() => {
        const fetchArtists = async () => {
            setLoading(true);
            setError(null);
            try {
                const allArtists: SpotifyItem[] = [];
                let nextUrl: string | null = '/me/following?type=artist&limit=50';

                while(nextUrl) {
                    const response = await apiClient.get(nextUrl);
                    allArtists.push(...response.data.artists.items);
                    nextUrl = response.data.artists.next;
                }
                setArtists(allArtists);
            } catch (err) {
                console.error('Failed to fetch followed artists', err);
                setError('Could not load your followed artists.');
            } finally {
                setLoading(false);
            }
        };
        fetchArtists();
    }, [refreshTrigger]);
    
    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
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
