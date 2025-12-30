
import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import apiClient from '../api';
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
    const [nowPlaying, setNowPlaying] = useState<NowPlayingState>({
        source: null, spotifyState: null, radioStation: null, radioContext: [], youtubeTrack: null, isLoading: false,
    });
    const [youTubeFavorites, setYouTubeFavorites] = useState<string[]>([]);
    const [isAutoplayBlocked, setAutoplayBlocked] = useState(false);
    const [isPlayerSdkReady, setIsPlayerSdkReady] = useState(false);
    const [lastPlayInitiated, setLastPlayInitiated] = useState(0);
    
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
        localStorage.removeItem('continueListeningItems');
        localStorage.removeItem('last_optimistic_item');
        latestOptimisticItem.current = null;
        getPlayerInstance()?.disconnect();
        setState({
            accessToken: null, expiresAt: null, user: null, isAuthenticated: false, isLoading: false,
            error: null, volume: 1, isMuted: false, lastVolume: 1,
        });
    }, []);
    
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        const sessionId = getSessionId(); // Use direct access to ensure freshness
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

    const _setPlayerState = useCallback((newState: SpotifyPlayerState | null) => {
        setNowPlaying(s => {
            if (s.source !== 'spotify' && s.source !== null) return { ...s, spotifyState: newState };
            const stillLoading = s.isLoading && !(newState && newState.track_window.current_track);
            return { ...s, spotifyState: newState, isLoading: stillLoading, source: newState ? 'spotify' : null };
        });
        if (newState) {
            localStorage.setItem("last_is_playing", String(!newState.paused));
            localStorage.setItem("last_progress_ms", String(newState.position));
            if (newState.track_window.current_track) localStorage.setItem("last_track_uri", newState.track_window.current_track.uri);
            if (newState.context && newState.context.uri) localStorage.setItem("last_context_uri", newState.context.uri);
            else localStorage.removeItem("last_context_uri");
        }
    }, [setNowPlaying]);
    
    const fetchUserInfo = useCallback(async () => {
        try { const { data } = await apiClient.get('/me'); return data; } catch (err) { return null; }
    }, []);

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
            ];
            const results = await Promise.allSettled(promises);
            const [playlists, artists, madeForYouPl, charts, newRels, genres, shows, parties, topTr, savedAlbs, madeForYouNew] = results;
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
            setHasFetchedHomeContent(true);
        } catch (err) { setHomeContentError("Could not load content."); } finally { setHomeContentLoading(false); }
    }, [state.user, hasFetchedHomeContent]);

    const triggerHomeContentFetch = useCallback(() => {
        if (state.user) { fetchRecentlyPlayed(); fetchData(); }
    }, [state.user, fetchRecentlyPlayed, fetchData]);

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
            if (token && expiresAt > Date.now()) {
                const user = await fetchUserInfo();
                if (user) setState(s => ({ ...s, user, isAuthenticated: true, isLoading: false }));
                else logout();
            } else { setState(s => ({ ...s, isLoading: false })); }
        };
        initFromStorage();
    }, [fetchUserInfo, logout]);

    const login = useCallback(async (tokenData?: TokenData | null, authError?: string) => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        if (authError) { setState(s => ({...s, error: authError, isLoading: false})); return; }
        if (!tokenData?.access_token) { setState(s => ({...s, error: 'Token missing.', isLoading: false})); return; }
        try {
            // SYNC SESSION ID: Make sure ref matches localStorage, as SpotifyLogin just updated localStorage
            sessionIdRef.current = getSessionId(); 
            
            const { access_token, expires_in } = tokenData;
            const expiresAt = tokenData.expires_at || (Date.now() + expires_in * 1000);
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('expiresAt', String(expiresAt));
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            const userData = await fetchUserInfo();
            if (userData) {
                setState(s => ({ ...s, accessToken: access_token, expiresAt, user: userData, isAuthenticated: true, isLoading: false, error: null }));
            } else { throw new Error("User info fail."); }
        } catch (err) { logout(); setState(s => ({...s, error: 'Login failed.', isLoading: false})); }
    }, [fetchUserInfo, logout]);
    
    const play = useCallback(async (options: PlayOptions, itemForOptimisticUpdate?: MediaItem) => {
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
        setNowPlaying(prev => ({ ...prev, source: 'spotify', radioStation: null, youtubeTrack: null, isLoading: true }));
        const success = await safePlay(options, attemptRefreshAndUpdatePlayerToken);
        if (!success) setNowPlaying(prev => ({ ...prev, isLoading: false }));
    }, [attemptRefreshAndUpdatePlayerToken]);
    
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
        return localStorage.getItem('accessToken') || '';
    }, [attemptRefreshAndUpdatePlayerToken]);

    useEffect(() => {
        if (isPlayerSdkReady) {
            const deviceId = getDeviceId();
            if (deviceId) {
                // Use getSessionId() directly to ensure we use the latest one
                const currentSessionId = getSessionId();
                fetch('/api/transfer-player', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: currentSessionId, device_id: deviceId })
                }).catch(() => {});
            }
        }
    }, [isPlayerSdkReady]);

    useEffect(() => {
        if (!state.isAuthenticated || !state.accessToken) { getPlayerInstance()?.disconnect(); return; }
        initSpotifyPlayerOnce({
            name: 'Mio Infotainment',
            getAccessToken: getAccessTokenForPlayer,
            onReady: () => setIsPlayerSdkReady(true),
            onNotReady: () => setIsPlayerSdkReady(false),
            onStateChange: _setPlayerState,
            onAuthError: async () => {
                const ok = await attemptRefreshAndUpdatePlayerToken();
                if (!ok) logout();
            },
            onAccountError: (message: string) => {
                // Spotify account_error occurs when non-premium user tries to use the SDK
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

    const pauseSpotify = useCallback(async () => { getPlayerInstance()?.pause(); }, []);
    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => { pauseSpotify(); setNowPlaying(prev => ({ ...prev, source: 'youtube', youtubeTrack: track, youtubePlaylist: playlist, radioStation: null, isLoading: prev.source !== 'youtube' })); }, [pauseSpotify]);
    const clearError = useCallback(() => { setState(s => ({...s, error: null})); }, []);
    const unlockAutoplay = useCallback(() => { getPlayerInstance()?.resume().then(() => setAutoplayBlocked(false)).catch(() => {}); }, []);
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
