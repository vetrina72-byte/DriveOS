
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
        localStorage.removeItem('accessToken');
        localStorage.removeItem('expiresAt');
        localStorage.removeItem('last_context_uri');
        localStorage.removeItem('last_track_uri');
        localStorage.removeItem('last_progress_ms');
        localStorage.removeItem('last_is_playing');
        localStorage.removeItem('cached_track_data'); // Clear cached track on logout
        localStorage.removeItem('continueListeningItems');
        localStorage.removeItem('last_optimistic_item');
        latestOptimisticItem.current = null;
        getPlayerInstance()?.disconnect();
        setState({
            accessToken: null, expiresAt: null, user: null, isAuthenticated: false, isLoading: false,
            error: null, volume: 1, isMuted: false, lastVolume: 1,
        });
        setNowPlaying(prev => ({ ...prev, source: null, spotifyState: null }));
    }, []);
    
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        const sessionId = getSessionId(); 
        if (!sessionId) { logout(); return false; }
        try {
            const res = await fetch('/api/refresh-token', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId }
            });
            const data = await res.json();
            if (res.status === 200 && data.access_token) {
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('expiresAt', String(data.expires_at));
                setState(s => ({ ...s, accessToken: data.access_token, expiresAt: data.expires_at, isAuthenticated: true }));
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
        // If we get a valid state update from the SDK, we know the local player is active.
        // We can safely unlock the transfer flag.
        if (newState) {
            isTransferring.current = false;
        }

        setNowPlaying(s => {
            if (s.source !== 'spotify' && s.source !== null) return { ...s, spotifyState: newState };
            
            const isLoading = isSwitchingTrack.current; 
            
            // Se lo stato locale è null (disconnesso/trasferito), controlliamo chi ha preso il controllo
            if (newState === null) {
                // Controllo immediato
                checkRemotePlayerState();
                
                // Avvia polling per tenere aggiornato lo stato remoto - 1.5s FAST POLLING
                if (!remotePollIntervalRef.current) {
                    remotePollIntervalRef.current = window.setInterval(checkRemotePlayerState, 1500);
                }
            } else {
                // Se lo stato locale è attivo, fermiamo il polling remoto
                if (remotePollIntervalRef.current) {
                    clearInterval(remotePollIntervalRef.current);
                    remotePollIntervalRef.current = null;
                }
            }

            return { 
                ...s, 
                spotifyState: newState, 
                isLoading: isLoading ? s.isLoading : false, 
                source: 'spotify',
                // Se newState esiste, siamo noi il dispositivo attivo (di solito), quindi puliamo activeDevice
                activeDevice: newState ? null : s.activeDevice 
            };
        });
        
        if (newState) {
            // Persist the essential track metadata for next session instant-load
            if (newState.track_window.current_track) {
                localStorage.setItem("cached_track_data", JSON.stringify(newState.track_window.current_track));
                localStorage.setItem("spotify_last_track", newState.track_window.current_track.uri);
            }
            
            localStorage.setItem("last_is_playing", String(!newState.paused));
            localStorage.setItem("spotify_last_position", String(newState.position));
            
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
                    
                    // Aggressive initialization: fetch current player state immediately
                    apiClient.get('/me/player').then(res => {
                        if (res.data && res.data.item) {
                            setNowPlaying(prev => {
                                // Prefer local hydrated state if it exists, otherwise use remote
                                if (prev.spotifyState && prev.spotifyState.track_window.current_track?.uri === res.data.item.uri) {
                                    return { ...prev, activeDevice: res.data.device, source: 'spotify' };
                                }
                                return {
                                    ...prev,
                                    source: 'spotify',
                                    activeDevice: res.data.device,
                                    spotifyState: {
                                        paused: !res.data.is_playing,
                                        position: res.data.progress_ms || 0,
                                        duration: res.data.item.duration_ms || 0,
                                        track_window: {
                                            current_track: res.data.item as any,
                                            next_tracks: [],
                                            previous_tracks: []
                                        },
                                        context: res.data.context || { uri: null, metadata: null },
                                        disallows: {},
                                        shuffle: res.data.shuffle_state || false,
                                        repeat_mode: res.data.repeat_state === 'off' ? 0 : 1,
                                        timestamp: Date.now()
                                    } as any
                                };
                            });
                        }
                    }).catch(() => {});
                    
                } else logout();
            } else { setState(s => ({ ...s, isLoading: false })); }
        };
        initFromStorage();
    }, [fetchUserInfo, logout, attemptRefreshAndUpdatePlayerToken]);

    const login = useCallback(async (tokenData?: TokenData | null, authError?: string) => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        if (authError) { setState(s => ({...s, error: authError, isLoading: false})); return; }
        if (!tokenData?.access_token) { setState(s => ({...s, error: 'Token missing.', isLoading: false})); return; }
        try {
            sessionIdRef.current = getSessionId(); 
            
            const { access_token, expires_in } = tokenData;
            const expiresAt = tokenData.expires_at || (Date.now() + (expires_in || 3600) * 1000);
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('expiresAt', String(expiresAt));
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            let userData = await fetchUserInfo(access_token);
            if (!userData) {
                // Graceful fallback to avoid locking user out
                console.warn("[AuthContext] Setting fallback user profile after token grant");
                userData = { id: 'spotify_user', display_name: 'Spotify User', product: 'premium' };
            }
            setState(s => ({ ...s, accessToken: access_token, expiresAt, user: userData, isAuthenticated: true, isLoading: false, error: null }));
            setHasFetchedHomeContent(false);
        } catch (err) { 
            console.error('[AuthContext] Login error:', err);
            logout(); 
            setState(s => ({...s, error: 'Login failed.', isLoading: false})); 
        }
    }, [fetchUserInfo, logout]);
    
    // Updated robust play function
    const play = useCallback(async (options: PlayOptions, itemForOptimisticUpdate?: MediaItem) => {
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
        if (options.context_uri) localStorage.setItem("last_context_uri", options.context_uri);
        else if (options.uris?.[0]) { localStorage.setItem("last_track_uri", options.uris[0]); localStorage.removeItem("last_context_uri"); }
        localStorage.setItem("last_progress_ms", "0");
        localStorage.setItem("last_is_playing", "true");
        setLastPlayInitiated(Date.now());
        
        // --- SPECIAL HANDLER FOR "LISTEN HERE" (TRANSFER) ---
        // If we are currently showing a remote device (activeDevice is set),
        // we assume the user wants to bring playback HERE.
        
        const isResume = Object.keys(options).length === 0 && !options.context_uri && !options.uris;
        const isTransfer = !!nowPlaying.activeDevice;
        // Only show spinner if transferring or loading a new track/context.
        // If simply resuming, keep existing loading state (likely false) to avoid spinner flash.
        const shouldShowSpinner = isTransfer || !isResume;

        // IMMEDIATELY update state to remove remote UI and show spinner.
        setNowPlaying(prev => {
            // OPTIMISTIC UPDATE: If resuming locally, force paused=false immediately
            // This updates the UI (Play icon becomes Pause icon) instantly.
            let nextSpotifyState = prev.spotifyState;
            if (isResume && !prev.activeDevice && prev.spotifyState) {
                nextSpotifyState = {
                    ...prev.spotifyState,
                    paused: false,
                    // FIX: Update timestamp to now. This is crucial for correct position calculation.
                    // The position property in `spotifyState` holds the position at the time of `timestamp`.
                    // When pausing, we stopped at position X. When resuming optimistically, position is still X,
                    // but we must reset `timestamp` to `Date.now()` so that `Date.now() - timestamp` equals 0 at start.
                    // Without this, `timestamp` remains old, causing `elapsed` to be huge (e.g. 10s),
                    // effectively jumping the progress bar forward by 10s instantly.
                    timestamp: Date.now()
                };
            }

            return { 
                ...prev, 
                spotifyState: nextSpotifyState, // Apply optimistic state
                source: 'spotify', 
                radioStation: null, 
                youtubeTrack: null, 
                isLoading: shouldShowSpinner, // Conditionally show spinner based on action type
                activeDevice: null // Optimistically clear remote device UI
            };
        });

        // --- FAST PATH: LOCAL RESUME ---
        // If it's a resume action, and we are NOT casting/remote, use the local SDK directly.
        if (isResume && !nowPlaying.activeDevice) {
             const player = getPlayerInstance();
             if (player) {
                 try {
                     await player.resume();
                     isSwitchingTrack.current = false;
                     // Ensure we fetch recent plays after a bit
                     setLastPlayInitiated(Date.now()); 
                     return; // Success, skip the API call
                 } catch (e) {
                     console.warn("Local resume failed, falling back to API", e);
                     // If fail, proceed to API call below
                 }
             }
        }

        if (nowPlaying.activeDevice) {
            console.log('[AuthContext] Taking control from remote device...');
            isTransferring.current = true; // Block polling updates to prevent UI flickering back
            
            // Safety timeout to reset the transfer lock if something goes wrong
            setTimeout(() => {
                isTransferring.current = false;
            }, 8000);

            try {
                // 1. Force pause on the current remote device (if playing)
                if (nowPlaying.activeDevice.is_active) {
                    await apiClient.put('/me/player/pause').catch(() => {});
                    // Wait a bit longer to ensure the backend processes the pause before we ask to play elsewhere
                    await new Promise(r => setTimeout(r, 500)); 
                }
                // 2. Proceed to safePlay which will wake up the local device.
            } catch (e) {
                console.error("Error taking control:", e);
                // Even if remote pause fails, we proceed to try and play locally
            }
        }

        try {
            let success = await safePlay(options, attemptRefreshAndUpdatePlayerToken);

            // --- RECOVERY LOGIC ON COLD RESUME ---
            if (!success && isResume) {
                const { getDeviceId } = await import('../lib/spotify-player');
                const deviceId = getDeviceId();
                const lastCtx = localStorage.getItem("last_context_uri");
                const lastUr = localStorage.getItem("last_track_uri");
                const lastPos = localStorage.getItem("last_progress_ms");
                
                if (deviceId && (lastCtx || lastUr)) {
                    console.log("Device not active, attempting fallback play recovery from local storage...");
                    const body: any = {};
                    if (lastCtx && lastCtx !== "undefined") body.context_uri = lastCtx;
                    else if (lastUr && lastUr !== "undefined") body.uris = [lastUr];
                    if (lastPos && lastPos !== "undefined") body.position_ms = parseInt(lastPos, 10);
                    
                    try {
                        const res = await apiClient.put(`/me/player/play?device_id=${deviceId}`, body);
                        // If no exception, consider it successful
                        console.log("Fallback recovery play explicit succeeded.");
                        success = true;
                    } catch (recErr) {
                        console.error('Fallback recovery play failed', recErr);
                    }
                }
            }

            if (!success) {
                // Only reset loading if it failed. If it succeeded, we wait for SDK state change to clear loading.
                setNowPlaying(prev => ({ ...prev, isLoading: false }));
                console.error("Playback failed or timed out.");
            } else {
                // Safety timeout: if state doesn't change in 3s, clear loading manually to avoid infinite spinner
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
    }, [attemptRefreshAndUpdatePlayerToken, nowPlaying.activeDevice]);
    
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
