import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';
import { FiMic } from 'react-icons/fi';

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

const PodcastGridView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [shows, setShows] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchShows = async () => {
            setLoading(true);
            setError(null);
            try {
                let showList: SpotifyItem[] = [];

                // 1. Fetch user saved shows without aggressive caching
                try {
                    const savedShowsResponse = await apiClient.get('/me/shows', {
                        params: {
                            limit: 50,
                            _t: Date.now()
                        }
                    });
                    const savedItems = savedShowsResponse.data?.items || [];
                    const showIds = savedItems.map((item: any) => item.show?.id).filter(Boolean);

                    if (showIds.length > 0) {
                        const fullShowsResponse = await apiClient.get(`/shows`, {
                            params: {
                                ids: showIds.slice(0, 50).join(','),
                                _t: Date.now()
                            }
                        });
                        const fullShows = (fullShowsResponse.data?.shows || []).filter(Boolean);
                        showList.push(...fullShows);
                    }
                } catch (savedErr) {
                    console.warn('[PodcastGridView] Could not fetch saved shows:', savedErr);
                }

                // 2. If saved shows is low or to provide fresh rotated recommendations, fetch popular podcasts
                const randomOffset = Math.floor(Math.random() * 6) * 5; // 0, 5, 10, 15, 20, 25
                try {
                    const popularShowsRes = await apiClient.get('/search', {
                        params: {
                            q: 'podcast',
                            type: 'show',
                            market: 'IT',
                            limit: 30,
                            offset: randomOffset,
                            _t: Date.now()
                        }
                    });
                    const discoveredShows = popularShowsRes.data?.shows?.items || [];
                    for (const show of discoveredShows) {
                        if (show && !showList.some(s => s.id === show.id)) {
                            showList.push(show);
                        }
                    }
                } catch (discErr) {
                    console.warn('[PodcastGridView] Could not fetch trending shows:', discErr);
                }

                setShows(showList.filter(Boolean));
            } catch (err) {
                console.error('[PodcastGridView] Failed to fetch podcasts/shows', err);
                setError('Impossibile caricare i podcast.');
            } finally {
                setLoading(false);
            }
        };
        fetchShows();
    }, []);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    if (error && shows.length === 0) {
        return <div className="flex-grow flex justify-center items-center text-red-400">{error}</div>;
    }

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar">
            <h2 className={`text-3xl font-bold mb-6 ${isNight ? 'text-white' : 'text-black'}`}>I tuoi Podcast e Consigliati</h2>
            {shows.length > 0 ? (
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
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FiMic className={`w-14 h-14 mb-3 opacity-40 ${themeColor}`} />
                    <p className={`text-base font-semibold ${isNight ? 'text-white' : 'text-black'}`}>Nessun podcast trovato</p>
                    <p className={`text-xs mt-1 max-w-sm ${themeColor}`}>
                        Inizia a seguire i tuoi podcast preferiti su Spotify per vederli qui.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PodcastGridView;
