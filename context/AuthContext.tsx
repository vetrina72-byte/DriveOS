
import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import apiClient from '../spotifyClient';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import { NowPlayingState, YouTubeTrackInfo, PlayOptions } from '../types';
import { SpotifyItem as MediaItem } from '../components/PlaylistItem';
import { getSessionId } from '../lib/sessionId';
import { initSpotifyPlayerOnce, setVolumeThrottled, setVolumeFinal as setVolumeFinalPlayer, getPlayerInstance, getDeviceId, safePlay } from '../lib/spotify-player';

export interface SpotifyUser {
    display_name: string;
    images?: { url: string }[];
    id: string;
    email?: string;
    product?: string;
    country?: string;
    followers?: { total: number };
}

interface AuthState {
    accessToken: string | null;
    expiresAt: number | null;
    user: SpotifyUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    volume: number;
    isMuted: boolean;
    lastVolume: number;
}

interface TokenData {
    access_token: string;
    expires_in: number;
    expires_at?: number;
    refresh_token?: string;
}

interface AuthContextType extends Omit<AuthState, 'lastVolume'> {
    login: (tokenData?: TokenData | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions, itemForOptimisticUpdate?: MediaItem) => void;
    playYouTube: (track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => void;
    refreshTrigger: number;
    triggerDataRefresh: () => void;
    _setPlayerState: (state: SpotifyPlayerState | null) => void;
    setVolumeLive: (level: number) => void;
    setVolumeFinal: (level: number) => void;
    toggleMute: () => void;
    nowPlaying: NowPlayingState;
    setNowPlaying: React.Dispatch<React.SetStateAction<NowPlayingState>>;
    isPlayerReady: boolean;
    pauseSpotify: () => void;
    youTubeFavorites: string[];
    onToggleYouTubeFavorite: (playlistId: string) => void;
    isAutoplayBlocked: boolean;
    unlockAutoplay: () => void;
    lastPlayInitiated: number;
    homeContentLoading: boolean;
    homeContentError: string | null;
    hasFetchedHomeContent: boolean;
    continueListeningItems: MediaItem[];
    newReleases: MediaItem[];
    userPlaylists: MediaItem[];
    madeForYouPlaylists: MediaItem[];
    topArtists: MediaItem[];
    chartsPlaylists: MediaItem[];
    genresCategories: MediaItem[];
    recommendedShows: MediaItem[];
    partyPlaylists: MediaItem[];
    topTracks: MediaItem[];
    artistRadioTracks: MediaItem[];
    trackRecommendations: MediaItem[];
    savedAlbums: MediaItem[];
    madeForYou: MediaItem[];
    triggerHomeContentFetch: () => void;
    resetHomeContent: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: React.PropsWithChildren<{}>) => {
    const [state, setState] = useState<AuthState>({
        accessToken: localStorage.getItem('accessToken'),
        expiresAt: Number(localStorage.getItem('expiresAt') || '0'),
        user: null,
        isAuthenticated: !!localStorage.getItem('accessToken'),
        isLoading: true,
        error: null,
        volume: 1,
        isMuted: false,
        lastVolume: 1,
    });
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    
    // HYDRATION LOGIC: Initialize state from LocalStorage to show the previous track instantly
    const [nowPlaying, setNowPlaying] = useState<NowPlayingState>(() => {
        let initialData: NowPlayingState = {
            source: null, 
            spotifyState: null, 
            radioStation: null, 
            radioContext: [], 
            youtubeTrack: null, 
            isLoading: false, 
            activeDevice: null
        };

        if (typeof window !== 'undefined') {
            try {
                const cachedTrackJson = localStorage.getItem('cached_track_data');
                const lastProgress = Number(localStorage.getItem('last_progress_ms') || '0');
                
                if (cachedTrackJson) {
                    const cachedTrack = JSON.parse(cachedTrackJson);
                    // Construct a partial/mock SpotifyPlayerState for immediate display
                    const mockState: any = {
                        paused: true, // Always start paused visually until confirmed otherwise
                        position: lastProgress,
                        duration: cachedTrack.duration_ms || 0,
                        track_window: {
                            current_track: cachedTrack,
                            next_tracks: [],
                            previous_tracks: []
                        },
                        context: { uri: null, metadata: null },
                        disallows: {},
                        shuffle: false,
                        repeat_mode: 0,
                        timestamp: Date.now()
                    };
                    
                    initialData = {
                        ...initialData,
                        source: 'spotify',
                        spotifyState: mockState
                    };
                }
            } catch (e) {
                console.warn('Failed to hydrate player state', e);
            }
        }
        return initialData;
    });

    const [youTubeFavorites, setYouTubeFavorites] = useState<string[]>([]);
    const [isAutoplayBlocked, setAutoplayBlocked] = useState(false);
    const [isPlayerSdkReady, setIsPlayerSdkReady] = useState(false);
    const [lastPlayInitiated, setLastPlayInitiated] = useState(0);
    
    // Lock mechanism to prevent double playback requests
    const isSwitchingTrack = useRef(false);
    
    // Lock mechanism to prevent UI flickering during device transfer
    const isTransferring = useRef(false);
    
    const latestOptimisticItem = useRef<MediaItem | null>(null);

    const [homeContentLoading, setHomeContentLoading] = useState(false);
    const [homeContentError, setHomeContentError] = useState<string | null>(null);
    const [hasFetchedHomeContent, setHasFetchedHomeContent] = useState(false);
    
    const [continueListeningItems, setContinueListeningItems] = useState<MediaItem[]>(() => {
        let items: MediaItem[] = [];
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('continueListeningItems');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) items = parsed;
                }
                const storedOptimistic = localStorage.getItem('last_optimistic_item');
                if (storedOptimistic) {
                    const optimisticItem = JSON.parse(storedOptimistic);
                    latestOptimisticItem.current = optimisticItem;
                    const filtered = items.filter(i => i.uri !== optimisticItem.uri);
                    items = [optimisticItem, ...filtered];
                }
            } catch (e) {}
        }
        return items.slice(0, 10);
    });

    const [newReleases, setNewReleases] = useState<MediaItem[]>([]);
    const [userPlaylists, setUserPlaylists] = useState<MediaItem[]>([]);
    const [madeForYouPlaylists, setMadeForYouPlaylists] = useState<MediaItem[]>([]);
    const [topArtists, setTopArtists] = useState<MediaItem[]>([]);
    const [chartsPlaylists, setChartsPlaylists] = useState<MediaItem[]>([]);
    const [genresCategories, setGenresCategories] = useState<MediaItem[]>([]);
    const [recommendedShows, setRecommendedShows] = useState<MediaItem[]>([]);
    const [partyPlaylists, setPartyPlaylists] = useState<MediaItem[]>([]);
    const [topTracks, setTopTracks] = useState<MediaItem[]>([]);
    const [artistRadioTracks, setArtistRadioTracks] = useState<MediaItem[]>([]);
    const [trackRecommendations, setTrackRecommendations] = useState<MediaItem[]>([]);
    const [savedAlbums, setSavedAlbums] = useState<MediaItem[]>([]);
    const [madeForYou, setMadeForYou] = useState<MediaItem[]>([]);

    const sessionIdRef = useRef<string>(getSessionId());
    const refreshTimeoutId = useRef<number | null>(null);
    const remotePollIntervalRef = useRef<number | null>(null);

    const triggerDataRefresh = useCallback(() => setRefreshTrigger(p => p + 1), []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try { localStorage.setItem('continueListeningItems', JSON.stringify(continueListeningItems)); } catch (e) {}
        }
    }, [continueListeningItems]);

    useEffect(() => {
        try {
            const storedFavorites = localStorage.getItem('youtube_favorites');
            if (storedFavorites) setYouTubeFavorites(JSON.parse(storedFavorites));
        } catch (e) {}
    }, []);

    const onToggleYouTubeFavorite = useCallback((playlistId: string) => {
        setYouTubeFavorites(prev => {
            const newFavorites = prev.includes(playlistId) ? prev.filter(id => id !== playlistId) : [...prev, playlistId];
            try { localStorage.setItem('youtube_favorites', JSON.stringify(newFavorites)); } catch (e) {}
            return newFavorites;
        });
    }, []);

    const logout = useCallback(() => {
        const sessionId = getSessionId();
        
        // Notify backend & cloud relay to invalidate session
        try {
            fetch('/api/logout', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'x-session-id': sessionId || '' 
                },
                body: JSON.stringify({ sessionId })
            }).catch(() => {});
        } catch (e) {}

        // Clear all Spotify token storage
        localStorage.removeItem('accessToken');
        localStorage.removeItem('expiresAt');
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_token_expiry');
        localStorage.removeItem('spotify_auth_broadcast');
        localStorage.removeItem('spotify_session_id');
        localStorage.removeItem('last_context_uri');
        localStorage.removeItem('last_track_uri');
        localStorage.removeItem('last_progress_ms');
        localStorage.removeItem('last_is_playing');
        localStorage.removeItem('cached_track_data');
        localStorage.removeItem('continueListeningItems');
        localStorage.removeItem('last_optimistic_item');
        localStorage.removeItem('spotify_last_track');
        localStorage.removeItem('spotify_last_position');
        localStorage.removeItem('spotify_last_context');
        
        latestOptimisticItem.current = null;
        getPlayerInstance()?.disconnect();
        
        setState({
            accessToken: null, 
            expiresAt: null, 
            user: null, 
            isAuthenticated: false, 
            isLoading: false,
            error: null, 
            volume: 1, 
            isMuted: false, 
            lastVolume: 1,
        });
        
        setNowPlaying(prev => ({ 
            ...prev, 
            source: null, 
            spotifyState: null,
            activeDevice: null 
        }));
    }, []);
    
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        const sessionId = getSessionId(); 
        const storedRefreshToken = localStorage.getItem('spotify_refresh_token');

        if (!sessionId && !storedRefreshToken) { 
            logout(); 
            return false; 
        }

        try {
            const res = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json', 
                    'x-session-id': sessionId || '' 
                },
                body: JSON.stringify({ 
                    sessionId, 
                    refreshToken: storedRefreshToken 
                })
            });
            const data = await res.json();
            if (res.status === 200 && data.access_token) {
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('spotify_access_token', data.access_token);
                if (data.expires_at) {
                    localStorage.setItem('expiresAt', String(data.expires_at));
                    localStorage.setItem('spotify_token_expiry', String(data.expires_at));
                }
                if (data.refresh_token) {
                    localStorage.setItem('spotify_refresh_token', data.refresh_token);
                }
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.access_token}`;
                setState(s => ({ 
                    ...s, 
                    accessToken: data.access_token, 
                    expiresAt: data.expires_at || s.expiresAt, 
                    isAuthenticated: true 
                }));
                return true;
            }
            if (res.status === 401 || data?.error === 'invalid_grant' || data?.error === 'premium_required') {
                logout();
                if (data?.error === 'premium_required') setState(s => ({ ...s, error: 'Premium required' }));
                return false;
            }
            return false;
        } catch (err) { return false; }
    }, [logout]);
    
    const scheduleRefresh = useCallback(() => {
        if (refreshTimeoutId.current) clearTimeout(refreshTimeoutId.current);
        const expiresAt = parseInt(localStorage.getItem('expiresAt') || '0', 10);
        if (!expiresAt || expiresAt < Date.now()) {
            if (localStorage.getItem('accessToken')) attemptRefreshAndUpdatePlayerToken();
            return;
        }
        const msLeft = expiresAt - Date.now();
        const refreshIn = Math.max(msLeft - 60000, 5000);
        refreshTimeoutId.current = window.setTimeout(() => attemptRefreshAndUpdatePlayerToken(), refreshIn);
    }, [attemptRefreshAndUpdatePlayerToken]);
    
    useEffect(() => {
        if (state.isAuthenticated) scheduleRefresh();
        return () => { if (refreshTimeoutId.current) clearTimeout(refreshTimeoutId.current); }
    }, [state.isAuthenticated, state.expiresAt, scheduleRefresh]);

    // NUOVO: Funzione per controllare lo stato del player remoto (API Polling)
    const checkRemotePlayerState = useCallback(async () => {
        if (!state.accessToken) return;
        // CRITICAL: Skip polling if we are actively transferring to local device
        // This prevents the UI from momentarily flickering back to "Remote View" due to stale API data
        if (isTransferring.current) return;

        try {
            // Chiede a Spotify chi sta suonando
            const response = await apiClient.get('/me/player');
            
            if (response.status === 200 && response.data) {
                const { device, item, is_playing } = response.data;
                const localDeviceId = getDeviceId();
                
                // Se il dispositivo attivo NON è quello locale, aggiorniamo lo stato per mostrare la UI remota
                if (device && device.id !== localDeviceId) {
                    setNowPlaying(prev => ({
                        ...prev,
                        source: 'spotify', 
                        activeDevice: device, // Memorizza info dispositivo remoto
                    }));
                } else if (!is_playing && nowPlaying.source === 'spotify' && !nowPlaying.spotifyState) {
                    // Nessuno sta suonando
                    setNowPlaying(prev => ({ ...prev, activeDevice: null }));
                }
            } else if (response.status === 204) {
                // 204 No Content = nulla in riproduzione
                setNowPlaying(prev => ({ ...prev, activeDevice: null }));
            }
        } catch (e) {
            console.error("Error checking remote player state", e);
        }
    }, [state.accessToken, nowPlaying.source, nowPlaying.spotifyState]);

    const _setPlayerState = useCallback((newState: SpotifyPlayerState | null) => {
        // 3. Ignorare gli Stati Transitori Vuoti nel Listener dell'SDK
        // Se lo stato è nullo o privo di traccia (tipico evento transitorio dell'SDK durante il caricamento o cambio episodio):
        // IGNORIAMO questo evento per non far lampeggiare l'UI con un layout vuoto.
        const hasValidTrack = Boolean(newState?.track_window?.current_track || (newState as any)?.item);

        if (!newState || !hasValidTrack) {
            let isCurrentlyLoading = isSwitchingTrack.current || Boolean(latestOptimisticItem.current);
            setNowPlaying(s => {
                if (s.isLoading || (s.spotifyState as any)?.isLoading) {
                    isCurrentlyLoading = true;
                }
                return s;
            });

            if (isCurrentlyLoading) {
                console.log('[Player] Ignorato stato transitorio vuoto durante il cambio traccia o optimistic update');
                return;
            }
            
            // Se lo stato locale è null (disconnesso/trasferito), controlliamo chi ha preso il controllo
            if (newState === null) {
                checkRemotePlayerState();
                if (!remotePollIntervalRef.current) {
                    remotePollIntervalRef.current = window.setInterval(checkRemotePlayerState, 1500);
                }
                setNowPlaying(s => ({ 
                    ...s, 
                    spotifyState: null, 
                    isLoading: false 
                }));
            }
            return;
        }

        // Se arriva uno stato valido, togliamo il flag di loading e sblocchiamo il cambio traccia
        isSwitchingTrack.current = false;
        isTransferring.current = false;
        latestOptimisticItem.current = null;

        if (remotePollIntervalRef.current) {
            clearInterval(remotePollIntervalRef.current);
            remotePollIntervalRef.current = null;
        }

        setNowPlaying(s => {
            if (s.source !== 'spotify' && s.source !== null) return { ...s, spotifyState: newState };
            
            return { 
                ...s, 
                spotifyState: { ...newState, isLoading: false }, 
                isLoading: false, 
                source: 'spotify',
                activeDevice: null 
            };
        });
        
        if (newState) {
            if (!newState.track_window) {
                console.warn('[Player] Stato di riproduzione vuoto o non ancora disponibile');
                return;
            }

            // Persist the essential track metadata for next session instant-load
            if (newState.track_window?.current_track) {
                localStorage.setItem("cached_track_data", JSON.stringify(newState.track_window.current_track));
                localStorage.setItem("spotify_last_track", newState.track_window.current_track.uri);
            }
            
            localStorage.setItem("last_is_playing", String(!newState.paused));
            
            const lastSeekTs = parseInt(localStorage.getItem("last_seek_ts") || "0", 10);
            const lastActionTs = parseInt(localStorage.getItem("last_action_ts") || "0", 10);
            const isRecentSeekOrAction = Date.now() - Math.max(lastSeekTs, lastActionTs) < 1500;
            if (!isRecentSeekOrAction) {
                localStorage.setItem("spotify_last_position", String(newState.position));
                localStorage.setItem("last_progress_ms", String(newState.position));
            }
            
            if (newState.context && newState.context.uri) localStorage.setItem("spotify_last_context", newState.context.uri);
            else localStorage.removeItem("spotify_last_context");
        }
    }, [setNowPlaying, checkRemotePlayerState]);
    
    // Cleanup polling all'unmount
    useEffect(() => {
        return () => {
            if (remotePollIntervalRef.current) {
                clearInterval(remotePollIntervalRef.current);
            }
        };
    }, []);

    const fetchUserInfo = useCallback(async (tokenParam?: string) => {
        const token = tokenParam || localStorage.getItem('accessToken') || state.accessToken;
        if (!token) return null;
        try { 
            const res = await fetch('https://api.spotify.com/v1/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                return await res.json();
            }
            console.warn('[AuthContext] /me failed with status', res.status);
            return null;
        } catch (err) { 
            console.error('[AuthContext] /me error', err);
            return null; 
        }
    }, [state.accessToken]);

    const processRecentPlays = useCallback(async (items: any[]): Promise<MediaItem[]> => {
        const unifiedList: MediaItem[] = [];
        const addedUris = new Set<string>();
        const contextDetailsCache = new Map<string, any>();
        const likedSongsItem: MediaItem = { id: 'liked-songs', name: 'Brani che ti piacciono', type: 'playlist', uri: 'special:liked-songs', description: 'La tua collezione personale.' };

        const contextUrisToFetch = [...new Set(items.filter(item => item.context?.uri && (item.context.type === 'album' || item.context.type === 'playlist')).map(item => item.context.uri))] as string[];
        if (contextUrisToFetch.length > 0) {
            const albumIds = contextUrisToFetch.filter(uri => uri.includes(':album:')).map(uri => uri.split(':')[2]);
            const playlistIds = contextUrisToFetch.filter(uri => uri.includes(':playlist:')).map(uri => uri.split(':')[2]);
            const promises = [];
            if (albumIds.length > 0) {
                promises.push(apiClient.get(`/albums?ids=${albumIds.join(',')}`).then(res => {
                    res.data.albums.forEach((album: any) => { if (album) contextDetailsCache.set(album.uri, album); });
                }).catch(() => {}));
            }
            if (playlistIds.length > 0) {
                const playlistPromises = playlistIds.map(id => apiClient.get(`/playlists/${id}`).then(res => {
                    contextDetailsCache.set(res.data.uri, res.data);
                }).catch(() => {}));
                promises.push(Promise.all(playlistPromises));
            }
            await Promise.all(promises);
        }

        for (const item of items) {
            if (!item.track) continue;
            let itemToAdd: MediaItem | null = null;
            if (item.context?.type === 'collection') { itemToAdd = likedSongsItem; } 
            else if (item.context?.uri && contextDetailsCache.has(item.context.uri)) {
                const contextDetails = contextDetailsCache.get(item.context.uri)!;
                itemToAdd = (contextDetails.type === 'playlist' && contextDetails.owner.id === 'spotify') ? item.track : contextDetails;
            } else { itemToAdd = item.track; }
            if (itemToAdd?.uri && !addedUris.has(itemToAdd.uri)) { unifiedList.push(itemToAdd); addedUris.add(itemToAdd.uri); }
        }
        return unifiedList.slice(0, 10);
    }, []);

    // Standalone fetch for recently played (still used by play effect)
    const fetchRecentlyPlayed = useCallback(async () => {
        if (!state.user) return;
        try {
            const recents = await apiClient.get('/me/player/recently-played?limit=50');
            const processedItemsFromApi = await processRecentPlays(recents.data.items);
            setContinueListeningItems(currentItems => {
                const optimisticItem = latestOptimisticItem.current || (currentItems.length > 0 ? currentItems[0] : null);
                if (!optimisticItem) return processedItemsFromApi;
                const combinedList = [optimisticItem, ...processedItemsFromApi.filter(item => item.uri !== optimisticItem.uri)];
                const uniqueUris = new Set<string>();
                return combinedList.filter(item => { if (!item?.uri || uniqueUris.has(item.uri)) return false; uniqueUris.add(item.uri); return true; }).slice(0, 10);
            });
        } catch (err) {}
    }, [state.user, processRecentPlays]);
    
    const fetchData = useCallback(async () => {
        if (!state.user) return;
        if (!hasFetchedHomeContent) setHomeContentLoading(true);
        setHomeContentError(null);
        try {
            const promises = [
                apiClient.get('/me/playlists?limit=10'),
                apiClient.get('/me/top/artists?time_range=medium_term&limit=10'),
                apiClient.get('/browse/categories/0JQ5DAqbMKF2JckPAnMAhA/playlists?country=IT&limit=10'),
                apiClient.get('/browse/categories/toplists/playlists?country=IT&limit=10'),
                apiClient.get(`/browse/new-releases?country=IT&limit=10`),
                apiClient.get('/browse/categories?country=IT&limit=20'),
                apiClient.get('/search?q=podcast&type=show&market=IT&limit=10'),
                apiClient.get('/browse/categories/party/playlists?country=IT&limit=10'),
                apiClient.get('/me/top/tracks?limit=20&time_range=long_term'),
                apiClient.get('/me/albums?limit=10'),
                apiClient.get('/browse/categories/0JQ5DAt0tbjZptfcdMSKl3/playlists?country=IT&limit=10'),
                // Added recently played call here for unified loading
                apiClient.get('/me/player/recently-played?limit=50'),
            ];
            const results = await Promise.allSettled(promises);
            const [playlists, artists, madeForYouPl, charts, newRels, genres, shows, parties, topTr, savedAlbs, madeForYouNew, recents] = results;
            
            if (playlists.status === 'fulfilled') setUserPlaylists(playlists.value.data.items);
            if (artists.status === 'fulfilled') setTopArtists(artists.value.data.items);
            if (madeForYouPl.status === 'fulfilled') setMadeForYouPlaylists(madeForYouPl.value.data.playlists.items);
            if (madeForYouNew.status === 'fulfilled') setMadeForYou(madeForYouNew.value.data.playlists.items);
            if (charts.status === 'fulfilled') setChartsPlaylists(charts.value.data.playlists.items);
            if (parties.status === 'fulfilled') setPartyPlaylists(parties.value.data.playlists.items);
            if (newRels.status === 'fulfilled') setNewReleases(newRels.value.data.albums.items);
            if (genres.status === 'fulfilled') setGenresCategories(genres.value.data.categories.items.map((c: any) => ({ ...c, type: 'category' })));
            if (shows.status === 'fulfilled') setRecommendedShows(shows.value.data.shows.items);
            if (topTr.status === 'fulfilled') setTopTracks(topTr.value.data.items);
            if (savedAlbs.status === 'fulfilled') setSavedAlbums(savedAlbs.value.data.items.map((i: any) => i.album).filter(Boolean));
            
            // Process recent plays directly here
            if (recents.status === 'fulfilled') {
                const processedItemsFromApi = await processRecentPlays(recents.value.data.items);
                setContinueListeningItems(currentItems => {
                    const optimisticItem = latestOptimisticItem.current || (currentItems.length > 0 ? currentItems[0] : null);
                    if (!optimisticItem) return processedItemsFromApi;
                    const combinedList = [optimisticItem, ...processedItemsFromApi.filter(item => item.uri !== optimisticItem.uri)];
                    const uniqueUris = new Set<string>();
                    return combinedList.filter(item => { if (!item?.uri || uniqueUris.has(item.uri)) return false; uniqueUris.add(item.uri); return true; }).slice(0, 10);
                });
            }

            setHasFetchedHomeContent(true);
        } catch (err) { setHomeContentError("Could not load content."); } finally { setHomeContentLoading(false); }
    }, [state.user, hasFetchedHomeContent, processRecentPlays]);

    const triggerHomeContentFetch = useCallback(() => {
        if (state.user) { 
            // Only call fetchData, which now includes recently played
            fetchData(); 
        }
    }, [state.user, fetchData]);

    const resetHomeContent = useCallback(() => {
        setHasFetchedHomeContent(false); setNewReleases([]); setUserPlaylists([]); setMadeForYouPlaylists([]);
        setTopArtists([]); setChartsPlaylists([]); setGenresCategories([]); setRecommendedShows([]);
        setPartyPlaylists([]); setTopTracks([]); setArtistRadioTracks([]); setTrackRecommendations([]);
        setSavedAlbums([]); setMadeForYou([]);
    }, []);

    useEffect(() => {
        const initFromStorage = async () => {
            const token = localStorage.getItem('accessToken');
            const expiresAt = Number(localStorage.getItem('expiresAt') || '0');
            if (token) {
                if (expiresAt > 0 && expiresAt < Date.now()) {
                    console.log('[AuthContext] Token expired in storage, attempting refresh...');
                    const refreshed = await attemptRefreshAndUpdatePlayerToken();
                    if (!refreshed) {
                        setState(s => ({ ...s, isLoading: false }));
                        return;
                    }
                }
                const currentToken = localStorage.getItem('accessToken') || token;
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${currentToken}`;
                let user = await fetchUserInfo(currentToken);
                if (!user && (expiresAt === 0 || expiresAt > Date.now())) {
                    user = { id: 'spotify_user', display_name: 'Spotify User', product: 'premium' };
                }
                if (user) {
                    setState(s => ({ ...s, accessToken: currentToken, expiresAt, user, isAuthenticated: true, isLoading: false }));
                    
                    // Aggressive initialization: fetch current player state immediately or recover last played track
                    const recoverPreviousSession = async () => {
                        try {
                            const res = await apiClient.get('/me/player');
                            if (res.data && res.data.item) {
                                const item = res.data.item;
                                const contextUri = res.data.context?.uri || item.album?.uri;
                                localStorage.setItem("last_track_uri", item.uri);
                                if (contextUri) localStorage.setItem("last_context_uri", contextUri);
                                localStorage.setItem("last_progress_ms", String(res.data.progress_ms || 0));

                                setNowPlaying(prev => {
                                    if (prev.spotifyState && prev.spotifyState.track_window.current_track?.uri === item.uri) {
                                        return { ...prev, activeDevice: res.data.device, source: 'spotify' };
                                    }
                                    return {
                                        ...prev,
                                        source: 'spotify',
                                        activeDevice: res.data.device,
                                        spotifyState: {
                                            paused: !res.data.is_playing,
                                            position: res.data.progress_ms || 0,
                                            duration: item.duration_ms || 0,
                                            track_window: {
                                                current_track: item as any,
                                                next_tracks: [],
                                                previous_tracks: []
                                            },
                                            context: res.data.context || { uri: contextUri || null, metadata: null },
                                            disallows: {},
                                            shuffle: res.data.shuffle_state || false,
                                            repeat_mode: res.data.repeat_state === 'off' ? 0 : 1,
                                            timestamp: Date.now()
                                        } as any
                                    };
                                });
                                return;
                            }
                        } catch (e) {}

                        // If /me/player had no active track, query /me/player/recently-played to recover last song
                        try {
                            const recentsRes = await apiClient.get('/me/player/recently-played?limit=10');
                            if (recentsRes.data?.items?.length > 0) {
                                const firstRecent = recentsRes.data.items[0];
                                const track = firstRecent.track;
                                if (track) {
                                    const contextUri = firstRecent.context?.uri || track.album?.uri;
                                    localStorage.setItem("last_track_uri", track.uri);
                                    if (contextUri) localStorage.setItem("last_context_uri", contextUri);
                                    localStorage.setItem("last_progress_ms", "0");

                                    setNowPlaying(prev => {
                                        if (prev.spotifyState?.track_window?.current_track) return prev;
                                        return {
                                            ...prev,
                                            source: 'spotify',
                                            spotifyState: {
                                                paused: true,
                                                position: 0,
                                                duration: track.duration_ms || 0,
                                                track_window: {
                                                    current_track: {
                                                        id: track.id,
                                                        uri: track.uri,
                                                        name: track.name,
                                                        duration_ms: track.duration_ms,
                                                        artists: track.artists || [],
                                                        album: {
                                                            name: track.album?.name || '',
                                                            uri: track.album?.uri || '',
                                                            images: track.album?.images || []
                                                        },
                                                        is_playable: true
                                                    } as any,
                                                    next_tracks: [],
                                                    previous_tracks: []
                                                },
                                                context: { uri: contextUri || null, metadata: null },
                                                disallows: {},
                                                shuffle: false,
                                                repeat_mode: 0,
                                                timestamp: Date.now()
                                            } as any
                                        };
                                    });
                                }
                            }
                        } catch (recErr) {}
                    };

                    recoverPreviousSession();
                } else logout();
            } else { setState(s => ({ ...s, isLoading: false })); }
        };
        initFromStorage();
    }, [fetchUserInfo, logout, attemptRefreshAndUpdatePlayerToken]);

    const login = useCallback(async (tokenData?: TokenData | null, authError?: string) => {
        if (authError) { setState(s => ({...s, error: authError, isLoading: false})); return; }
        if (!tokenData?.access_token) { setState(s => ({...s, error: 'Token missing.', isLoading: false})); return; }
        try {
            sessionIdRef.current = getSessionId(); 
            
            const { access_token, expires_in, refresh_token } = tokenData;
            const expiresAt = tokenData.expires_at || (Date.now() + (expires_in || 3600) * 1000);
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('spotify_access_token', access_token);
            localStorage.setItem('expiresAt', String(expiresAt));
            localStorage.setItem('spotify_token_expiry', String(expiresAt));
            if (refresh_token) {
                localStorage.setItem('spotify_refresh_token', refresh_token);
            }
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

            // Instantly transition UI: set authenticated and provisional user immediately
            const initialUser = { id: 'spotify_user', display_name: 'Spotify User', product: 'premium' };
            setState(s => ({ 
                ...s, 
                accessToken: access_token, 
                expiresAt, 
                user: s.user || initialUser, 
                isAuthenticated: true, 
                isLoading: false, 
                error: null 
            }));
            setHasFetchedHomeContent(false);

            // Fetch complete user profile asynchronously in the background
            fetchUserInfo(access_token).then(userData => {
                if (userData) {
                    setState(s => ({ ...s, user: userData }));
                }
            }).catch(err => {
                console.warn('[AuthContext] Background fetchUserInfo warning:', err);
            });

            // Recover active or previous session
            apiClient.get('/me/player').then(res => {
                if (res.data?.item) {
                    const item = res.data.item;
                    const contextUri = res.data.context?.uri || item.album?.uri;
                    localStorage.setItem("last_track_uri", item.uri);
                    if (contextUri) localStorage.setItem("last_context_uri", contextUri);
                } else {
                    apiClient.get('/me/player/recently-played?limit=5').then(recents => {
                        const first = recents.data?.items?.[0];
                        if (first?.track) {
                            localStorage.setItem("last_track_uri", first.track.uri);
                            if (first.context?.uri) localStorage.setItem("last_context_uri", first.context.uri);
                        }
                    }).catch(() => {});
                }
            }).catch(() => {});
        } catch (err) { 
            console.error('[AuthContext] Login error:', err);
            logout(); 
            setState(s => ({...s, error: 'Login failed.', isLoading: false})); 
        }
    }, [fetchUserInfo, logout]);
    
    // Updated robust play function with automatic recovery of previous track/playlist
    const play = useCallback(async (options: PlayOptions = {}, itemForOptimisticUpdate?: MediaItem) => {
        if (isSwitchingTrack.current) {
            console.log('Skipping play request: already switching');
            return;
        }
        
        isSwitchingTrack.current = true;

        // Optimistic UI updates
        if (itemForOptimisticUpdate) {
            latestOptimisticItem.current = itemForOptimisticUpdate;
            try { localStorage.setItem('last_optimistic_item', JSON.stringify(itemForOptimisticUpdate)); } catch (e) {}
            setContinueListeningItems(prevItems => [itemForOptimisticUpdate, ...prevItems.filter(i => i.uri !== itemForOptimisticUpdate.uri)].slice(0, 10));
        }

        const isExplicitTrackOrContext = Boolean(options.context_uri || (options.uris && options.uris.length > 0));

        if (options.context_uri) {
            localStorage.setItem("last_context_uri", options.context_uri);
        } else if (options.uris?.[0]) {
            localStorage.setItem("last_track_uri", options.uris[0]);
            localStorage.removeItem("last_context_uri");
        }

        // Only reset progress_ms if a new track/context is explicitly started without position_ms
        if (isExplicitTrackOrContext) {
            if (options.position_ms !== undefined) {
                localStorage.setItem("last_progress_ms", String(options.position_ms));
                localStorage.setItem("spotify_last_position", String(options.position_ms));
            } else {
                localStorage.setItem("last_progress_ms", "0");
                localStorage.setItem("spotify_last_position", "0");
            }
        }

        localStorage.setItem("last_is_playing", "true");
        setLastPlayInitiated(Date.now());
        
        const isResume = !isExplicitTrackOrContext;
        const isTransfer = !!nowPlaying.activeDevice;
        const hasLoadedTrack = Boolean(nowPlaying.spotifyState?.track_window?.current_track);

        let effectiveOptions: PlayOptions = { ...options };

        if (isResume) {
            if (!hasLoadedTrack) {
                // Cold start recovery
                const lastCtx = localStorage.getItem("last_context_uri") || localStorage.getItem("spotify_last_context");
                const lastUr = localStorage.getItem("last_track_uri") || localStorage.getItem("spotify_last_track") || continueListeningItems[0]?.uri;
                const lastPos = localStorage.getItem("last_progress_ms") || localStorage.getItem("spotify_last_position");

                if (lastCtx && lastCtx !== "undefined" && !lastCtx.startsWith('spotify:track:')) {
                    effectiveOptions.context_uri = lastCtx;
                } else if (lastUr && lastUr !== "undefined") {
                    effectiveOptions.uris = [lastUr];
                }
                if (lastPos && lastPos !== "undefined") {
                    const parsedPos = parseInt(lastPos, 10);
                    if (!isNaN(parsedPos) && parsedPos > 0) {
                        effectiveOptions.position_ms = parsedPos;
                    }
                }
            } else {
                // Already has active/loaded track: CRITICAL - Keep options empty to preserve exact position and playlist index
                effectiveOptions = {};
                const lastPos = localStorage.getItem("last_progress_ms") || localStorage.getItem("spotify_last_position");
                if (lastPos && lastPos !== "undefined") {
                    const parsedPos = parseInt(lastPos, 10);
                    if (!isNaN(parsedPos) && parsedPos >= 0) {
                        effectiveOptions.position_ms = parsedPos;
                    }
                }
            }
        }

        const shouldShowSpinner = isTransfer || (!isResume && !hasLoadedTrack);

        // IMMEDIATELY update state to remove remote UI and show optimistic state
        setNowPlaying(prev => {
            let nextSpotifyState = prev.spotifyState;
            if (itemForOptimisticUpdate) {
                const optTrack: any = {
                    id: itemForOptimisticUpdate.id,
                    uri: itemForOptimisticUpdate.uri,
                    name: (itemForOptimisticUpdate as any).name || (itemForOptimisticUpdate as any).title || 'In riproduzione',
                    album: (itemForOptimisticUpdate as any).album || {
                        name: (itemForOptimisticUpdate as any).albumName || (itemForOptimisticUpdate as any).showName || 'Podcast',
                        images: (itemForOptimisticUpdate as any).images || [{ url: (itemForOptimisticUpdate as any).imageUrl || (itemForOptimisticUpdate as any).image || '' }]
                    },
                    images: (itemForOptimisticUpdate as any).images || [{ url: (itemForOptimisticUpdate as any).imageUrl || (itemForOptimisticUpdate as any).image || '' }],
                    artists: (itemForOptimisticUpdate as any).artists || [{ name: (itemForOptimisticUpdate as any).artistName || (itemForOptimisticUpdate as any).publisher || 'Podcast' }],
                    duration_ms: (itemForOptimisticUpdate as any).duration_ms || 0
                };
                nextSpotifyState = {
                    context: { uri: effectiveOptions.context_uri || null, metadata: null },
                    disallows: { pausing: false, skipping_next: false, skipping_prev: false },
                    duration: optTrack.duration_ms,
                    paused: false,
                    position: 0,
                    repeat_mode: 0,
                    shuffle: false,
                    track_window: {
                        current_track: optTrack,
                        next_tracks: [],
                        previous_tracks: []
                    },
                    item: optTrack,
                    isLoading: true,
                    timestamp: Date.now()
                } as any;
            } else if (isResume && !prev.activeDevice && prev.spotifyState) {
                nextSpotifyState = {
                    ...prev.spotifyState,
                    paused: false,
                    timestamp: Date.now()
                };
            }

            return { 
                ...prev, 
                spotifyState: nextSpotifyState,
                source: 'spotify', 
                radioStation: null, 
                youtubeTrack: null, 
                isLoading: shouldShowSpinner || Boolean(itemForOptimisticUpdate),
                activeDevice: null
            };
        });

        // FAST PATH: Direct player.resume() if player already has track loaded
        if (isResume && hasLoadedTrack && !nowPlaying.activeDevice) {
             const player = getPlayerInstance();
             if (player) {
                 try {
                     if (effectiveOptions.position_ms !== undefined) {
                         await player.seek(effectiveOptions.position_ms).catch(() => {});
                     }
                     await player.resume();
                     isSwitchingTrack.current = false;
                     setLastPlayInitiated(Date.now()); 
                     return;
                 } catch (e) {
                     console.warn("Local resume failed, falling back to safePlay", e);
                 }
             }
        }

        if (nowPlaying.activeDevice) {
            console.log('[AuthContext] Taking control from remote device...');
            isTransferring.current = true;
            
            setTimeout(() => {
                isTransferring.current = false;
            }, 8000);

            try {
                if (nowPlaying.activeDevice.is_active) {
                    await apiClient.put('/me/player/pause').catch(() => {});
                    await new Promise(r => setTimeout(r, 400)); 
                }
            } catch (e) {
                console.error("Error taking control:", e);
            }
        }

        try {
            let success = await safePlay(effectiveOptions, attemptRefreshAndUpdatePlayerToken);

            // RECOVERY LOGIC ON COLD RESUME
            if (!success && isResume) {
                const { getDeviceId } = await import('../lib/spotify-player');
                const deviceId = getDeviceId();
                const lastCtx = effectiveOptions.context_uri || localStorage.getItem("last_context_uri");
                const lastUr = effectiveOptions.uris?.[0] || localStorage.getItem("last_track_uri");
                const lastPos = effectiveOptions.position_ms || localStorage.getItem("last_progress_ms");
                
                if (deviceId && (lastCtx || lastUr)) {
                    console.log("Attempting fallback play recovery from local storage...");
                    const body: any = {};
                    if (!hasLoadedTrack) {
                        if (lastCtx && lastCtx !== "undefined") body.context_uri = lastCtx;
                        else if (lastUr && lastUr !== "undefined") body.uris = [lastUr];
                    }
                    if (lastPos && lastPos !== "undefined") body.position_ms = typeof lastPos === 'number' ? lastPos : parseInt(String(lastPos), 10);
                    
                    try {
                        await apiClient.put(`/me/player/play?device_id=${deviceId}`, body);
                        console.log("Fallback recovery play succeeded.");
                        success = true;
                    } catch (recErr) {
                        console.error('Fallback recovery play failed', recErr);
                    }
                }
            }

            if (!success) {
                setNowPlaying(prev => ({ ...prev, isLoading: false }));
                console.error("Playback failed or timed out.");
            } else {
                setTimeout(() => {
                    setNowPlaying(prev => prev.isLoading ? ({ ...prev, isLoading: false }) : prev);
                }, 3000);
            }
        } catch (error) {
            console.error("Exception during play:", error);
            setNowPlaying(prev => ({ ...prev, isLoading: false }));
        } finally {
            isSwitchingTrack.current = false;
        }
    }, [attemptRefreshAndUpdatePlayerToken, nowPlaying.activeDevice, continueListeningItems, nowPlaying.spotifyState]);
    
    useEffect(() => {
        if (lastPlayInitiated > 0) {
            const timer = setTimeout(() => { if(state.user) fetchRecentlyPlayed(); }, 2000);
            return () => clearTimeout(timer);
        }
    }, [lastPlayInitiated, state.user, fetchRecentlyPlayed]);

    const getAccessTokenForPlayer = useCallback(async (): Promise<string> => {
        const expiresAt = Number(localStorage.getItem('expiresAt') || '0');
        if (expiresAt > Date.now() + 60000) return localStorage.getItem('accessToken') || '';
        const refreshed = await attemptRefreshAndUpdatePlayerToken();
        // Return from localStorage as it's the source of truth after refresh
        return localStorage.getItem('accessToken') || '';
    }, [attemptRefreshAndUpdatePlayerToken]);

    useEffect(() => {
        if (isPlayerSdkReady) {
            const deviceId = getDeviceId();
            if (deviceId) {
                const currentSessionId = getSessionId();
                fetch('/api/transfer-player', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: currentSessionId, device_id: deviceId, play: false })
                }).then(() => {
                    const resumeAudio = () => {
                        getPlayerInstance()?.resume().catch(() => {});
                    };
                    window.addEventListener('pointerdown', resumeAudio, { once: true, capture: true });
                }).catch(() => {});
            }
        }
    }, [isPlayerSdkReady]);

    // NEW: Volume Sync Effect
    useEffect(() => {
        if (!isPlayerSdkReady) return;

        const interval = setInterval(async () => {
            const player = getPlayerInstance();
            if (!player) return;
            
            try {
                const currentSdkVolume = await player.getVolume();
                setState(prev => {
                    // Update only if significant difference to avoid UI jitter or conflict with local drag
                    if (Math.abs(prev.volume - currentSdkVolume) > 0.02) {
                        return { 
                            ...prev, 
                            volume: currentSdkVolume, 
                            isMuted: currentSdkVolume === 0,
                            lastVolume: currentSdkVolume > 0 ? currentSdkVolume : prev.lastVolume 
                        };
                    }
                    return prev;
                });
            } catch (e) {
                // Silent catch for volume retrieval errors
            }
        }, 2000);

        return () => clearInterval(interval);
    }, [isPlayerSdkReady]);

    useEffect(() => {
        if (!state.isAuthenticated || !state.accessToken) { getPlayerInstance()?.disconnect(); return; }
        initSpotifyPlayerOnce({
            name: 'DriveOS',
            getAccessToken: getAccessTokenForPlayer,
            onReady: () => setIsPlayerSdkReady(true),
            onNotReady: () => setIsPlayerSdkReady(false),
            onStateChange: _setPlayerState,
            onAuthError: async () => {
                const ok = await attemptRefreshAndUpdatePlayerToken();
                if (!ok) logout();
            },
            onAccountError: (message: string) => {
                console.error('ACCOUNT ERROR', message);
                logout();
                setState(s => ({ ...s, error: 'Premium required' }));
            },
            onPlaybackError: (message: string) => {
                if (message.includes('autoplay') || message.includes('NotAllowedError')) setAutoplayBlocked(true);
            }
        });
    }, [state.isAuthenticated, state.accessToken, getAccessTokenForPlayer, _setPlayerState, logout, attemptRefreshAndUpdatePlayerToken]);
    
    const setVolumeLive = useCallback((rawValue: number) => {
        const clampedVolume = Math.max(0, Math.min(1, rawValue));
        setState(s => ({ ...s, volume: clampedVolume, isMuted: clampedVolume === 0, ...(clampedVolume > 0 && { lastVolume: clampedVolume }) }));
        setVolumeThrottled(clampedVolume);
    }, []);

    const setVolumeFinal = useCallback((rawValue: number) => {
        const clampedVolume = Math.max(0, Math.min(1, rawValue));
        setState(s => ({ ...s, volume: clampedVolume, isMuted: clampedVolume === 0, ...(clampedVolume > 0 && { lastVolume: clampedVolume }) }));
        setVolumeFinalPlayer(clampedVolume).catch(() => {});
    }, []);

    const toggleMute = useCallback(() => {
        setVolumeFinal(state.isMuted ? (state.lastVolume > 0 ? state.lastVolume : 0.5) : 0);
    }, [state.isMuted, state.lastVolume, setVolumeFinal]);

    const pauseSpotify = useCallback(async () => { 
        // Optimistic UI update: Immediately show paused state to improve responsiveness
        setNowPlaying(prev => {
            if (prev.spotifyState) {
                return {
                    ...prev,
                    spotifyState: { ...prev.spotifyState, paused: true }
                };
            }
            return prev;
        });
        
        getPlayerInstance()?.pause(); 
    }, []);

    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => { pauseSpotify(); setNowPlaying(prev => ({ ...prev, source: 'youtube', youtubeTrack: track, youtubePlaylist: playlist, radioStation: null, isLoading: prev.source !== 'youtube' })); }, [pauseSpotify]);
    const clearError = useCallback(() => { setState(s => ({...s, error: null})); }, []);
    const unlockAutoplay = useCallback(() => { getPlayerInstance()?.resume().then(() => setAutoplayBlocked(false)).catch(() => {}); }, []);

    useEffect(() => {
        if (!isAutoplayBlocked) return;
        
        const unlock = () => {
            unlockAutoplay();
        };

        window.addEventListener('pointerdown', unlock, { once: true, capture: true });
        window.addEventListener('keydown', unlock, { once: true, capture: true });
        
        return () => {
            window.removeEventListener('pointerdown', unlock, { capture: true });
            window.removeEventListener('keydown', unlock, { capture: true });
        };
    }, [isAutoplayBlocked, unlockAutoplay]);

    const isPlayerReady = isPlayerSdkReady && !!getDeviceId();
    
    return (
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play, playYouTube, refreshTrigger, triggerDataRefresh, _setPlayerState, setVolumeLive, setVolumeFinal, toggleMute, nowPlaying, setNowPlaying, isPlayerReady, pauseSpotify, youTubeFavorites, onToggleYouTubeFavorite, isAutoplayBlocked, unlockAutoplay, lastPlayInitiated, homeContentLoading, homeContentError, hasFetchedHomeContent, continueListeningItems, newReleases, userPlaylists, madeForYouPlaylists, topArtists, chartsPlaylists, genresCategories, recommendedShows, partyPlaylists, topTracks, artistRadioTracks, trackRecommendations, savedAlbums, madeForYou, triggerHomeContentFetch, resetHomeContent }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth fails.');
    return context;
};
