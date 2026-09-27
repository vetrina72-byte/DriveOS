import React, { useState, useEffect, useCallback } from 'react';
import apiClient from '../spotifyClient';
import PlaylistItem, { SpotifyItem } from './PlaylistItem';
import { motion } from 'framer-motion';
import { FiMic, FiPlay, FiPause, FiCompass, FiFilter, FiClock } from 'react-icons/fi';
import { PodcastService } from '../services/PodcastService';
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

const PodcastGridView = ({ isNight, onSelectItem }: { isNight: boolean, onSelectItem: (item: SpotifyItem) => void }) => {
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [savedEpisodes, setSavedEpisodes] = useState<SpotifyItem[]>([]);
    const [discoveredShows, setDiscoveredShows] = useState<SpotifyItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [, setLiveTick] = useState<number>(0);

    const { nowPlaying, isPlayerReady, play, pauseSpotify } = useAuth();
    const playerState = nowPlaying.spotifyState;
    const isPlayingContext = playerState && !playerState.paused && nowPlaying.source === 'spotify';
    const currentTrack = playerState?.track_window?.current_track ?? playerState?.item ?? null;
    const currentTrackId = currentTrack?.id;
    const currentTrackUri = currentTrack?.uri;

    // Aggiornamento in tempo reale della barra di avanzamento e percentuale durante l'ascolto
    useEffect(() => {
        if (!isPlayingContext || !currentTrackId) return;

        const interval = setInterval(() => {
            setLiveTick(t => t + 1);
            if (currentTrack?.uri?.includes('episode') || (currentTrack as any)?.type === 'episode') {
                const elapsed = playerState?.timestamp ? Math.max(0, Date.now() - playerState.timestamp) : 0;
                const curPos = Math.min(playerState?.duration || 0, Math.max(0, (playerState?.position || 0) + elapsed));
                if (playerState?.duration) {
                    PodcastService.updateEpisodeProgress(currentTrackId, curPos, playerState.duration);
                }
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [isPlayingContext, currentTrackId, playerState, currentTrack]);

    const categories = [
        { id: 'all', name: 'Tutti' },
        { id: 'news', name: 'Notizie' },
        { id: 'technology', name: 'Tecnologia' },
        { id: 'comedy', name: 'Intrattenimento' },
        { id: 'true crime', name: 'True Crime' },
        { id: 'business', name: 'Business' }
    ];

    const syncLocalEpisodes = useCallback(() => {
        const historyItems = PodcastService.getListeningHistory();
        if (historyItems.length > 0) {
            setSavedEpisodes(prev => {
                const map = new Map<string, SpotifyItem>();
                // Add local history first
                for (const item of historyItems) {
                    const epStatus = PodcastService.getEpisodeStatus(item);
                    map.set(item.id, {
                        id: item.id,
                        name: item.name || item.title || 'Episodio',
                        description: item.description,
                        uri: item.uri,
                        images: item.images || (item.image ? [{ url: item.image }] : (item.show?.images || [])),
                        type: 'episode',
                        show: item.show,
                        duration_ms: epStatus.duration_ms || item.duration_ms || 1800000,
                        resume_point: {
                            fully_played: epStatus.fully_played,
                            resume_position_ms: epStatus.resume_position_ms
                        }
                    });
                }
                // Retain any API-loaded episodes not in local history
                for (const ep of prev) {
                    if (!map.has(ep.id)) {
                        map.set(ep.id, ep);
                    }
                }
                return Array.from(map.values());
            });
        }
    }, []);

    useEffect(() => {
        const handleHistoryUpdated = () => {
            syncLocalEpisodes();
        };
        window.addEventListener('podcast_history_updated', handleHistoryUpdated);
        window.addEventListener('focus', handleHistoryUpdated);
        return () => {
            window.removeEventListener('podcast_history_updated', handleHistoryUpdated);
            window.removeEventListener('focus', handleHistoryUpdated);
        };
    }, [syncLocalEpisodes]);

    useEffect(() => {
        const fetchPodcasts = async () => {
            setLoading(true);
            setError(null);
            try {
                let episodesList: SpotifyItem[] = [];
                let showsList: SpotifyItem[] = [];

                // 0. Include locally stored podcast history (episodes clicked/listened to)
                try {
                    const historyItems = PodcastService.getListeningHistory();
                    for (const item of historyItems) {
                        episodesList.push({
                            id: item.id,
                            name: item.name || item.title || 'Episodio',
                            description: item.description,
                            uri: item.uri,
                            images: item.images || (item.image ? [{ url: item.image }] : (item.show?.images || [])),
                            type: 'episode',
                            show: item.show,
                            duration_ms: item.duration_ms || 1800000,
                            resume_point: item.resume_point
                        });
                    }
                } catch (e) {
                    console.warn('[PodcastGridView] Could not load local podcast history:', e);
                }

                try {
                    // 1. Check currently playing episode
                    const currentRes = await apiClient.get('/me/player/currently-playing', {
                        params: { _t: Date.now() }
                    }).catch(() => null);

                    if (currentRes?.data?.item && currentRes.data.item.type === 'episode') {
                        const ep = currentRes.data.item;
                        const currItem: SpotifyItem = {
                            id: ep.id,
                            name: ep.name,
                            description: ep.description,
                            uri: ep.uri,
                            images: ep.images || ep.show?.images,
                            type: 'episode',
                            show: ep.show,
                            duration_ms: ep.duration_ms || 1800000,
                            resume_point: ep.resume_point,
                        };
                        const existingIdx = episodesList.findIndex(e => e.id === ep.id);
                        if (existingIdx >= 0) {
                            episodesList.splice(existingIdx, 1);
                        }
                        episodesList.unshift(currItem);
                    }

                    // 2. Fetch saved episodes
                    const savedEpRes = await apiClient.get('/me/episodes', {
                        params: { limit: 50, market: 'IT', _t: Date.now() }
                    });
                    if (savedEpRes.data?.items) {
                        const savedItems = savedEpRes.data.items
                            .filter((item: any) => {
                                if (!item.episode) return false;
                                const rp = item.episode.resume_point;
                                if (!rp) return false;
                                const inCorso = rp.fully_played === false && rp.resume_position_ms > 0;
                                const giaAscoltati = rp.fully_played === true;
                                return inCorso || giaAscoltati;
                            })
                            .map((item: any) => ({
                                id: item.episode?.id,
                                name: item.episode?.name,
                                description: item.episode?.description,
                                uri: item.episode?.uri,
                                images: item.episode?.images || item.episode?.show?.images,
                                type: 'episode',
                                show: item.episode?.show,
                                duration_ms: item.episode?.duration_ms || 1800000,
                                resume_point: item.episode?.resume_point,
                            })).filter((i: any) => i.id);
                        
                        for (const item of savedItems) {
                            if (!episodesList.some(e => e.id === item.id)) {
                                episodesList.push(item);
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[PodcastGridView] Could not fetch saved or current episodes:', e);
                }

                if (episodesList.length === 0) {
                    try {
                        const recentRes = await apiClient.get('/me/player/recently-played', {
                            params: { limit: 20, _t: Date.now() }
                        });
                        if (recentRes.data?.items) {
                            episodesList = recentRes.data.items
                                .filter((item: any) => item.track?.type === 'episode')
                                .map((item: any) => ({
                                    id: item.track?.id,
                                    name: item.track?.name || 'Episodio Recente',
                                    uri: item.track?.uri,
                                    images: item.track?.album?.images || item.track?.show?.images,
                                    type: 'episode',
                                    show: item.track?.show,
                                    duration_ms: item.track?.duration_ms || 1800000,
                                })).filter((i: any) => i.id);
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

    return (
        <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-8 hide-scrollbar flex flex-col space-y-8">
            {/* Header principale */}
            <div className="flex items-center justify-between pt-2">
                <h2 className={`text-3xl font-bold tracking-tight ${textColor}`}>Podcast</h2>
            </div>

            {/* SEZIONE 1: In Corso / Già Ascoltati (Carosello Orizzontale Compatto) */}
            <div className="flex flex-col space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-semibold flex items-center gap-2 ${textColor}`}>
                        <FiClock className="w-5 h-5 text-green-500" />
                        In Corso / Già Ascoltati
                    </h3>
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${isNight ? 'bg-white/10 text-white/70' : 'bg-black/10 text-black/70'}`}>
                        {savedEpisodes.length} Episodi
                    </span>
                </div>

                {savedEpisodes.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto pb-3 pt-1 hide-scrollbar scroll-smooth">
                        {savedEpisodes.map((ep: any, idx) => {
                            const imageUrl = ep.images?.[0]?.url || ep.images?.[1]?.url || 'https://images.unsplash.com/photo-1478737270239-2f02b77fc618?w=300&auto=format&fit=crop&q=60';
                            const isCurrent = Boolean(
                                (currentTrackId && ep.id === currentTrackId) ||
                                (currentTrackUri && ep.uri === currentTrackUri)
                            );
                            const isPlaying = isPlayingContext && isCurrent;

                            // Sincronizzazione precisa al 100% con PodcastService e playerState attivo
                            const status = PodcastService.getEpisodeStatus(ep, isCurrent ? playerState : undefined);
                            const progressPercent = status.progress_percent;
                            const isFullyPlayed = status.fully_played;
                            const remainingMs = Math.max(0, status.duration_ms - status.resume_position_ms);
                            const remainingText = remainingMs > 60000
                                ? `${Math.ceil(remainingMs / 60000)} min rimanenti`
                                : `${Math.max(1, Math.round(remainingMs / 1000))} sec rimanenti`;

                            const handleCardClick = () => {
                                if (isCurrent) {
                                    if (isPlaying) {
                                        pauseSpotify();
                                    } else {
                                        play();
                                    }
                                } else {
                                    onSelectItem(ep);
                                }
                            };

                            return (
                                <motion.div
                                    key={`in-corso-${ep.id || idx}`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleCardClick}
                                    className={`shrink-0 w-80 sm:w-96 rounded-xl p-3 flex gap-4 cursor-pointer transition-all shadow-md backdrop-blur-md border ${
                                        isNight 
                                             ? 'bg-white/[0.06] hover:bg-white/[0.1] border-white/10 text-white' 
                                             : 'bg-black/[0.04] hover:bg-black/[0.08] border-black/10 text-black'
                                    }`}
                                >
                                    <div className="relative w-24 h-24 shrink-0 rounded-lg overflow-hidden shadow">
                                        <img src={imageUrl} alt={ep.name} className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                            <div className="w-9 h-9 rounded-full bg-green-500 flex items-center justify-center text-black shadow-lg">
                                                {isPlaying ? (
                                                    <FiPause className="w-4 h-4 fill-current" />
                                                ) : (
                                                    <FiPlay className="w-4 h-4 ml-0.5 fill-current" />
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col justify-between flex-grow py-0.5 overflow-hidden">
                                        <div>
                                            <span className="text-[10px] font-semibold tracking-wider text-green-500 uppercase block mb-1">
                                                {ep.show?.name || 'Podcast'}
                                            </span>
                                            <h4 className="text-sm font-bold line-clamp-2 leading-snug mb-1">
                                                {ep.name}
                                            </h4>
                                        </div>

                                        {/* Barra di avanzamento sotto l'episodio */}
                                        <div className="space-y-1.5 mt-2">
                                            <div className="flex justify-between text-[10px] opacity-70">
                                                <span>{isFullyPlayed ? 'Già ascoltato' : `Ascoltato ${progressPercent}%`}</span>
                                                {!isFullyPlayed && <span>{remainingText}</span>}
                                            </div>
                                            <div className={`w-full h-1.5 rounded-full overflow-hidden ${isNight ? 'bg-white/10' : 'bg-black/10'}`}>
                                                <div 
                                                    className="h-full bg-green-500 rounded-full transition-all duration-300"
                                                    style={{ width: `${progressPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                ) : (
                    <div className={`p-4 rounded-xl flex items-center gap-3 backdrop-blur-md border ${isNight ? 'bg-white/[0.04] border-white/10 text-white/70' : 'bg-black/[0.03] border-black/10 text-zinc-600'}`}>
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 shrink-0">
                            <FiMic className="w-5 h-5" />
                        </div>
                        <p className="text-sm font-medium">Nessun episodio in riproduzione. I tuoi ascolti recenti appariranno qui.</p>
                    </div>
                )}
            </div>

            {/* SEZIONE 2: Nuovi Podcast da Scoprire */}
            <div className="flex flex-col space-y-4 pt-4 border-t border-white/10">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className={`text-xl font-semibold flex items-center gap-2 ${textColor}`}>
                        <FiCompass className="w-5 h-5 text-green-500" />
                        Nuovi da Scoprire
                    </h3>

                    {/* Barra delle Categorie con Scroll Orizzontale Fluido e Padding per evitare tagli */}
                    <div className="relative w-full sm:w-auto">
                        <div className="flex items-center gap-2 overflow-x-auto py-1 px-1 hide-scrollbar scroll-smooth">
                            <FiFilter className={`w-4 h-4 shrink-0 mx-1 ${themeColor}`} />
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all shadow-sm shrink-0 ${
                                        selectedCategory === cat.id
                                            ? 'bg-white text-black font-bold shadow-md scale-105'
                                            : (isNight ? 'bg-white/10 text-white/90 hover:bg-white/20' : 'bg-black/10 text-black/90 hover:bg-black/20')
                                    }`}
                                >
                                    {cat.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {discoveredShows.length > 0 ? (
                    <motion.div
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5 gap-5 sm:gap-6 pt-2"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                      key={selectedCategory}
                    >
                        {discoveredShows.map((show, index) => (
                            <motion.div variants={itemVariants} key={`discovered-show-${show.id || index}-${index}`}>
                              <PlaylistItem item={show} isNight={isNight} onSelectItem={onSelectItem} />
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                        <FiMic className={`w-14 h-14 mb-3 opacity-40 ${themeColor}`} />
                        <p className={`text-base font-semibold ${textColor}`}>Nessun podcast trovato per questa categoria</p>
                        <p className={`text-xs mt-1 max-w-sm ${themeColor}`}>
                            Prova a selezionare un’altra categoria tematica o esplora i nostri consigliati.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PodcastGridView;
