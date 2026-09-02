import React, { useState, useEffect } from 'react';
import apiClient from '../spotifyClient';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';
import { FiMic, FiPlayCircle, FiCompass, FiFilter } from 'react-icons/fi';

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
    const [activeTab, setActiveTab] = useState<'in_corso' | 'nuovi'>('in_corso');
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    
    const [savedEpisodes, setSavedEpisodes] = useState<SpotifyItem[]>([]);
    const [discoveredShows, setDiscoveredShows] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const categories = [
        { id: 'all', name: 'Tutti' },
        { id: 'news', name: 'Notizie' },
        { id: 'technology', name: 'Tecnologia' },
        { id: 'comedy', name: 'Intrattenimento' },
        { id: 'true crime', name: 'True Crime' },
        { id: 'business', name: 'Business' }
    ];

    useEffect(() => {
        const fetchPodcasts = async () => {
            setLoading(true);
            setError(null);
            try {
                let episodesList: SpotifyItem[] = [];
                let showsList: SpotifyItem[] = [];

                try {
                    const savedEpRes = await apiClient.get('/me/episodes', {
                        params: { limit: 20, _t: Date.now() }
                    });
                    if (savedEpRes.data?.items) {
                        episodesList = savedEpRes.data.items.map((item: any) => ({
                            id: item.episode?.id,
                            name: item.episode?.name,
                            description: item.episode?.description,
                            uri: item.episode?.uri,
                            images: item.episode?.images || item.episode?.show?.images,
                            type: 'episode',
                            show: item.episode?.show
                        })).filter((i: any) => i.id);
                    }
                } catch (e) {
                    console.warn('[PodcastGridView] Could not fetch saved episodes:', e);
                }

                if (episodesList.length === 0) {
                    try {
                        const recentRes = await apiClient.get('/me/player/recently-played', {
                            params: { limit: 20, _t: Date.now() }
                        });
                        if (recentRes.data?.items) {
                            episodesList = recentRes.data.items
                                .filter((item: any) => item.track?.type === 'episode' || item.context?.type === 'show')
                                .map((item: any) => ({
                                    id: item.track?.id || item.context?.uri,
                                    name: item.track?.name || 'Episodio Recente',
                                    uri: item.track?.uri || item.context?.uri,
                                    images: item.track?.album?.images || item.track?.show?.images,
                                    type: 'episode'
                                }));
                        }
                    } catch (e) {
                        console.warn('[PodcastGridView] Could not fetch recently played podcasts:', e);
                    }
                }

                const query = selectedCategory === 'all' ? 'podcast' : selectedCategory;
                const searchRes = await apiClient.get('/search', {
                    params: {
                        q: query,
                        type: 'show',
                        market: 'IT',
                        limit: 30,
                        _t: Date.now()
                    }
                });
                if (searchRes.data?.shows?.items) {
                    showsList = searchRes.data.shows.items.filter(Boolean);
                }

                setSavedEpisodes(episodesList);
                setDiscoveredShows(showsList);
            } catch (err) {
                console.error('[PodcastGridView] Failed to fetch podcast data', err);
                setError('Impossibile caricare i podcast.');
            } finally {
                setLoading(false);
            }
        };

        fetchPodcasts();
    }, [selectedCategory]);

    const themeColor = isNight ? 'text-[#b3b3b3]' : 'text-zinc-600';
    const textColor = isNight ? 'text-white' : 'text-black';

    if (loading) {
        return <div className="flex-grow flex justify-center items-center"><div className={`w-10 h-10 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} /></div>;
    }

    const currentItems = activeTab === 'in_corso' ? savedEpisodes : discoveredShows;

    return (
        <div className="flex-grow overflow-y-auto px-6 pb-6 hide-scrollbar flex flex-col">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <h2 className={`text-3xl font-bold ${textColor}`}>Podcast</h2>
                
                <div className={`flex rounded-lg p-1 ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>
                    <button
                        onClick={() => setActiveTab('in_corso')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                            activeTab === 'in_corso'
                                ? (isNight ? 'bg-white text-black shadow' : 'bg-black text-white shadow')
                                : themeColor
                        }`}
                    >
                        <FiPlayCircle className="w-4 h-4" />
                        In Corso / Già Ascoltati ({savedEpisodes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('nuovi')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-md font-semibold text-sm transition-all ${
                            activeTab === 'nuovi'
                                ? (isNight ? 'bg-white text-black shadow' : 'bg-black text-white shadow')
                                : themeColor
                        }`}
                    >
                        <FiCompass className="w-4 h-4" />
                        Nuovi da Scoprire
                    </button>
                </div>
            </div>

            {activeTab === 'nuovi' && (
                <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-4 hide-scrollbar">
                    <FiFilter className={`w-4 h-4 shrink-0 ${themeColor}`} />
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={`px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                                selectedCategory === cat.id
                                    ? (isNight ? 'bg-green-500 text-black font-bold' : 'bg-green-600 text-white font-bold')
                                    : (isNight ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-black/10 text-black/80 hover:bg-black/20')
                            }`}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>
            )}

            {currentItems.length > 0 ? (
                <motion.div
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  key={activeTab + selectedCategory}
                >
                    {currentItems.map((item, index) => (
                        <motion.div variants={itemVariants} key={`podcast-${activeTab}-${item.id || index}-${index}`}>
                          <PlaylistItem item={item} isNight={isNight} onSelectItem={onSelectItem} />
                        </motion.div>
                    ))}
                </motion.div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                    <FiMic className={`w-14 h-14 mb-3 opacity-40 ${themeColor}`} />
                    <p className={`text-base font-semibold ${textColor}`}>
                        {activeTab === 'in_corso' ? 'Nessun episodio in corso o recente' : 'Nessun podcast trovato per questa categoria'}
                    </p>
                    <p className={`text-xs mt-1 max-w-sm ${themeColor}`}>
                        {activeTab === 'in_corso' 
                            ? 'Ascolta un episodio per vederlo apparire qui con il tuo storico di riproduzione.'
                            : 'Prova a selezionare un’altra categoria tematica o esplora i nostri consigliati.'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default PodcastGridView;
