import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
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

const NewReleasesView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [albums, setAlbums] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchNewReleases = async () => {
            setLoading(true);
            setError(null);
            try {
                // Dynamic random offset for rotating content
                const randomOffset = Math.floor(Math.random() * 5) * 4; // 0, 4, 8, 12, 16
                let response = await apiClient.get('/browse/new-releases', {
                    params: {
                        country: 'IT',
                        limit: 50,
                        offset: randomOffset,
                        _t: Date.now()
                    }
                });

                let items = response.data?.albums?.items || [];
                // Fallback to offset 0 if random offset returned too few items
                if (items.length < 6 && randomOffset > 0) {
                    const fallbackRes = await apiClient.get('/browse/new-releases', {
                        params: {
                            country: 'IT',
                            limit: 50,
                            offset: 0,
                            _t: Date.now()
                        }
                    });
                    items = fallbackRes.data?.albums?.items || items;
                }

                const validAlbums = items.filter(Boolean);
                setAlbums(validAlbums);
            } catch (err) {
                console.error('[NewReleases] Failed to fetch fresh new releases', err);
                setError('Impossibile caricare le nuove uscite.');
            } finally {
                setLoading(false);
            }
        };
        fetchNewReleases();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>Nuove Uscite</h2>
            <motion.div
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-5 sm:gap-6"
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
