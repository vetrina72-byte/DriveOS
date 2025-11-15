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
    // Home Content State & Actions
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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
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
    
    // Home Content State
    const [homeContentLoading, setHomeContentLoading] = useState(false);
    const [homeContentError, setHomeContentError] = useState<string | null>(null);
    const [hasFetchedHomeContent, setHasFetchedHomeContent] = useState(false);
    const [continueListeningItems, setContinueListeningItems] = useState<MediaItem[]>(() => {
        if (typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem('continueListeningItems');
                if (stored) {
                    const parsed = JSON.parse(stored);
                    if (Array.isArray(parsed)) return parsed;
                }
            } catch (e) {
                console.error("Failed to parse continueListeningItems from localStorage", e);
            }
        }
        return [];
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
            try {
                localStorage.setItem('continueListeningItems', JSON.stringify(continueListeningItems));
            } catch (e) {
                console.error("Failed to save continueListeningItems to localStorage", e);
            }
        }
    }, [continueListeningItems]);

    useEffect(() => {
        try {
            const storedFavorites = localStorage.getItem('youtube_favorites');
            if (storedFavorites) setYouTubeFavorites(JSON.parse(storedFavorites));
        } catch (e) { console.error("Failed to load YouTube favorites", e); }
    }, []);

    const onToggleYouTubeFavorite = useCallback((playlistId: string) => {
        setYouTubeFavorites(prev => {
            const newFavorites = prev.includes(playlistId) ? prev.filter(id => id !== playlistId) : [...prev, playlistId];
            try { localStorage.setItem('youtube_favorites', JSON.stringify(newFavorites)); } 
            catch (e) { console.error("Failed to save YouTube favorites", e); }
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
        
        getPlayerInstance()?.disconnect();

        setState({
            accessToken: null, expiresAt: null, user: null, isAuthenticated: false, isLoading: false,
            error: null, volume: 1, isMuted: false, lastVolume: 1,
        });
    }, []);
    
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        const sessionId = sessionIdRef.current;
        console.log(`🔄 [TOKEN] refresh attempt... session=${sessionId}`);
        if (!sessionId) {
            console.log('❌ [TOKEN] refresh failed', new Error('sessionId undefined, cannot refresh'));
            logout();
            return false;
        }

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
                console.log(`✅ [TOKEN] refresh success. new expiresAt=${new Date(data.expires_at).toISOString()}`);
                
                return true;
            }

            if (res.status === 401 || data?.error === 'invalid_grant') {
                 console.log('❌ [TOKEN] refresh failed', { status: res.status, body: data, message: 'invalid_grant' });
                logout();
                return false;
            }
            
            console.log('❌ [TOKEN] refresh failed', { status: res.status, body: data });
            return false;
        } catch (err: any) {
            console.log('❌ [TOKEN] refresh failed', err);
            return false;
        }
    }, [logout]);
    
    const scheduleRefresh = useCallback(() => {
        if (refreshTimeoutId.current) clearTimeout(refreshTimeoutId.current);
        
        const expiresAt = parseInt(localStorage.getItem('expiresAt') || '0', 10);
        if (!expiresAt || expiresAt < Date.now()) {
            if (localStorage.getItem('accessToken')) {
                attemptRefreshAndUpdatePlayerToken();
            }
            return;
        }

        const msLeft = expiresAt - Date.now();
        const refreshIn = Math.max(msLeft - 60000, 5000);
        
        console.log(`🔄 [TOKEN] waiting refresh... session=${sessionIdRef.current}. Next attempt in ${Math.round(refreshIn/1000)}s.`);
        
        refreshTimeoutId.current = window.setTimeout(() => {
            attemptRefreshAndUpdatePlayerToken();
        }, refreshIn);
    }, [attemptRefreshAndUpdatePlayerToken]);
    
    useEffect(() => {
        if (state.isAuthenticated) {
            scheduleRefresh();
        }
        return () => {
            if (refreshTimeoutId.current) clearTimeout(refreshTimeoutId.current);
        }
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
        try {
            const { data } = await apiClient.get('/me');
            return data;
        } catch (err) {
            console.error('Failed to fetch user info.', err);
            return null;
        }
    }, []);

    // Home Content Fetching Logic
    const processRecentPlays = useCallback(async (items: any[]): Promise<MediaItem[]> => {
        const unifiedList: MediaItem[] = [];
        const addedUris = new Set<string>();
        const contextDetailsCache = new Map<string, any>();

        const tracksWithoutContext = items.filter(item => item.track && !item.context);
        const trackIdsToCheck = tracksWithoutContext.map(item => item.track.id).filter(Boolean);
        const likedStatusMap = new Map<string, boolean>();

        if (trackIdsToCheck.length > 0) {
            for (let i = 0; i < trackIdsToCheck.length; i += 50) {
                const chunk = trackIdsToCheck.slice(i, i + 50);
                try {
                    const response = await apiClient.get(`/me/tracks/contains?ids=${chunk.join(',')}`);
                    response.data.forEach((isLiked: boolean, index: number) => {
                        likedStatusMap.set(chunk[index], isLiked);
                    });
                } catch (e) {
                    console.error("Failed to check liked status for tracks", e);
                }
            }
        }

        const likedSongsItem: MediaItem = { id: 'liked-songs', name: 'Brani che ti piacciono', type: 'playlist', uri: 'special:liked-songs', description: 'La tua collezione personale.' };

        const contextUrisToFetch = [...new Set(items.filter(item => item.context?.uri && (item.context.type === 'album' || item.context.type === 'playlist')).map(item => item.context.uri))] as string[];

        if (contextUrisToFetch.length > 0) {
            const albumIds = contextUrisToFetch.filter(uri => uri.includes(':album:')).map(uri => uri.split(':')[2]);
            const playlistIds = contextUrisToFetch.filter(uri => uri.includes(':playlist:')).map(uri => uri.split(':')[2]);
            const promises = [];
            if (albumIds.length > 0) {
                promises.push(apiClient.get(`/albums?ids=${albumIds.join(',')}`).then(res => {
                    res.data.albums.forEach((album: any) => { if (album) contextDetailsCache.set(album.uri, album); });
                }).catch(e => console.error("Failed fetching album details", e)));
            }
            if (playlistIds.length > 0) {
                const playlistPromises = playlistIds.map(id => apiClient.get(`/playlists/${id}`).then(res => {
                    contextDetailsCache.set(res.data.uri, res.data);
                }).catch(e => console.error(`Failed to fetch playlist ${id}`, e)));
                promises.push(Promise.all(playlistPromises));
            }
            await Promise.all(promises);
        }

        for (const item of items) {
            if (!item.track) continue;
            let itemToAdd: MediaItem | null = null;
            if (item.context?.type === 'collection' || likedStatusMap.get(item.track.id)) {
                itemToAdd = likedSongsItem;
            } else if (item.context?.uri && contextDetailsCache.has(item.context.uri)) {
                const contextDetails = contextDetailsCache.get(item.context.uri)!;
                if (contextDetails.type === 'playlist' && contextDetails.owner.id === 'spotify') {
                    itemToAdd = item.track;
                } else {
                    itemToAdd = contextDetails;
                }
            } else {
                itemToAdd = item.track;
            }
            if (itemToAdd?.uri && !addedUris.has(itemToAdd.uri)) {
                unifiedList.push(itemToAdd);
                addedUris.add(itemToAdd.uri);
            }
        }
        return unifiedList.slice(0, 10);
    }, []);

    const fetchRecentlyPlayed = useCallback(async () => {
        if (!state.user) return;
        try {
            const recents = await apiClient.get('/me/player/recently-played?limit=50');
            const processedItemsFromApi = await processRecentPlays(recents.data.items);
            
            setContinueListeningItems(currentItems => {
                // The most recent optimistic item is at the front of the current list.
                const optimisticItem = currentItems.length > 0 ? currentItems[0] : null;
                
                // The API response is our source of truth for the order.
                let finalItems = [...processedItemsFromApi];
                const apiUris = new Set(finalItems.map(i => i.uri));
    
                // If our optimistic item hasn't made it to the API yet, manually prepend it.
                if (optimisticItem && !apiUris.has(optimisticItem.uri)) {
                    finalItems.unshift(optimisticItem);
                }
                
                // De-duplicate the list to ensure consistency and slice to the limit.
                const uniqueUris = new Set<string>();
                const uniqueItems = finalItems.filter(item => {
                    if (!item || !item.uri) return false; // Guard against bad data
                    if (uniqueUris.has(item.uri)) {
                        return false;
                    }
                    uniqueUris.add(item.uri);
                    return true;
                });
    
                return uniqueItems.slice(0, 10);
            });
    
        } catch (err) {
            console.error("Failed to fetch recently played items", err);
        }
    }, [state.user, processRecentPlays]);
    
    const fetchData = useCallback(async () => {
        if (!state.user || hasFetchedHomeContent) return;
        setHomeContentLoading(true);
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
            results.forEach((result, index) => {
                if (result.status === 'rejected') console.log(`API call at index ${index} failed:`, result.reason.response?.data || result.reason.message);
            });
            const [playlists, artists, madeForYouPl, charts, newRels, genres, shows, parties, topTr, savedAlbs, madeForYouNew] = results;
            if (playlists.status === 'fulfilled') setUserPlaylists(playlists.value.data.items);
            if (artists.status === 'fulfilled') {
                const topArtistsData = artists.value.data.items;
                setTopArtists(topArtistsData);
                if (topArtistsData.length > 0) apiClient.get(`/recommendations?seed_artists=${topArtistsData[0].id}&limit=20`).then(res => setArtistRadioTracks(res.data.tracks.filter(Boolean))).catch(e => console.error("Failed to fetch artist radio", e));
            }
            if (madeForYouPl.status === 'fulfilled') setMadeForYouPlaylists(madeForYouPl.value.data.playlists.items);
            if (madeForYouNew.status === 'fulfilled') setMadeForYou(madeForYouNew.value.data.playlists.items);
            if (charts.status === 'fulfilled') setChartsPlaylists(charts.value.data.playlists.items);
            if (parties.status === 'fulfilled') setPartyPlaylists(parties.value.data.playlists.items);
            if (newRels.status === 'fulfilled') setNewReleases(newRels.value.data.albums.items);
            if (genres.status === 'fulfilled') setGenresCategories(genres.value.data.categories.items.map((c: any) => ({ ...c, type: 'category' })));
            if (shows.status === 'fulfilled') setRecommendedShows(shows.value.data.shows.items);
            if (topTr.status === 'fulfilled') {
                const tracks = topTr.value.data.items;
                setTopTracks(tracks);
                if (tracks.length >= 2) apiClient.get(`/recommendations?seed_tracks=${tracks.slice(0, 2).map((t: MediaItem) => t.id).join(',')}&limit=20`).then(res => setTrackRecommendations(res.data.tracks.filter(Boolean))).catch(e => console.error("Failed to fetch track recommendations", e));
            }
            if (savedAlbs.status === 'fulfilled') setSavedAlbums(savedAlbs.value.data.items.map((i: any) => i.album).filter(Boolean));
            setHasFetchedHomeContent(true);
        } catch (err: any) {
            setHomeContentError("Could not load content.");
        } finally {
            setHomeContentLoading(false);
        }
    }, [state.user, hasFetchedHomeContent]);

    const triggerHomeContentFetch = useCallback(() => {
        if (state.user && !hasFetchedHomeContent) {
            fetchRecentlyPlayed();
            fetchData();
        }
    }, [state.user, hasFetchedHomeContent, fetchRecentlyPlayed, fetchData]);

    const resetHomeContent = useCallback(() => {
        setHasFetchedHomeContent(false);
        // setContinueListeningItems([]); // DO NOT CLEAR THIS - FIX
        setNewReleases([]);
        setUserPlaylists([]);
        setMadeForYouPlaylists([]);
        setTopArtists([]);
        setChartsPlaylists([]);
        setGenresCategories([]);
        setRecommendedShows([]);
        setPartyPlaylists([]);
        setTopTracks([]);
        setArtistRadioTracks([]);
        setTrackRecommendations([]);
        setSavedAlbums([]);
        setMadeForYou([]);
    }, []);

    useEffect(() => {
        const initFromStorage = async () => {
            const token = localStorage.getItem('accessToken');
            const expiresAt = Number(localStorage.getItem('expiresAt') || '0');

            if (token && expiresAt > Date.now()) {
                const user = await fetchUserInfo();
                if (user) {
                    setState(s => ({ ...s, user, isAuthenticated: true, isLoading: false }));
                } else {
                    logout();
                }
            } else {
                setState(s => ({ ...s, isLoading: false }));
            }
        };
        initFromStorage();
    }, [fetchUserInfo, logout]);

    const login = useCallback(async (tokenData?: TokenData | null, authError?: string) => {
        setState(s => ({ ...s, isLoading: true, error: null }));
    
        if (authError) {
            setState(s => ({...s, error: authError, isLoading: false}));
            return;
        }
        if (!tokenData?.access_token) {
            setState(s => ({...s, error: 'Token data is missing.', isLoading: false}));
            return;
        }
    
        try {
            const { access_token, expires_in } = tokenData;
            const expiresAt = tokenData.expires_at || (Date.now() + expires_in * 1000);
    
            localStorage.setItem('accessToken', access_token);
            localStorage.setItem('expiresAt', String(expiresAt));
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
            const userData = await fetchUserInfo();
            if (userData) {
                setState(s => ({
                    ...s, accessToken: access_token, expiresAt, user: userData, isAuthenticated: true, isLoading: false, error: null,
                }));
            } else { throw new Error("Failed to fetch user info after login."); }
        } catch (err: any) {
            logout(); 
            setState(s => ({...s, error: 'Failed to complete login.', isLoading: false}));
        }
    }, [fetchUserInfo, logout]);
    
    const play = useCallback(async (options: PlayOptions, itemForOptimisticUpdate?: MediaItem) => {
        if (itemForOptimisticUpdate) {
            setContinueListeningItems(prevItems => {
                const filtered = prevItems.filter(i => i.uri !== itemForOptimisticUpdate.uri);
                const newItems = [itemForOptimisticUpdate, ...filtered];
                return newItems.slice(0, 10);
            });
        }

        if (options.context_uri) localStorage.setItem("last_context_uri", options.context_uri);
        else if (options.uris?.[0]) {
            localStorage.setItem("last_track_uri", options.uris[0]);
            localStorage.removeItem("last_context_uri");
        }
        localStorage.setItem("last_progress_ms", "0");
        localStorage.setItem("last_is_playing", "true");

        setLastPlayInitiated(Date.now());
        setNowPlaying(prev => ({ ...prev, source: 'spotify', radioStation: null, youtubeTrack: null, isLoading: true }));
        
        const success = await safePlay(options, attemptRefreshAndUpdatePlayerToken);
        if (!success) {
            setNowPlaying(prev => ({ ...prev, isLoading: false }));
        }
    }, [attemptRefreshAndUpdatePlayerToken]);
    
    // Delayed fetch to reconcile with Spotify API after optimistic update
    useEffect(() => {
        if (lastPlayInitiated > 0) {
            const timer = setTimeout(() => {
                if(state.user) {
                    fetchRecentlyPlayed();
                }
            }, 2000); // 2 second delay for API to update
            return () => clearTimeout(timer);
        }
    }, [lastPlayInitiated, state.user, fetchRecentlyPlayed]);

    const getAccessTokenForPlayer = useCallback(async (): Promise<string> => {
        const expiresAt = Number(localStorage.getItem('expiresAt') || '0');
        if (expiresAt > Date.now() + 60 * 1000) {
            return localStorage.getItem('accessToken') || '';
        }
        const refreshed = await attemptRefreshAndUpdatePlayerToken();
        if (refreshed) {
            return localStorage.getItem('accessToken') || '';
        }
        return localStorage.getItem('accessToken') || '';
    }, [attemptRefreshAndUpdatePlayerToken]);

    useEffect(() => {
        if (isPlayerSdkReady) {
            const deviceId = getDeviceId();
            if (deviceId) {
                console.log('[PLAYER] Player is ready. Proactively transferring playback control.');
                fetch('/api/transfer-player', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sessionId: sessionIdRef.current, device_id: deviceId })
                }).catch(err => console.error('[PLAYER] Proactive transfer failed:', err));
            }
        }
    }, [isPlayerSdkReady]);

    useEffect(() => {
        if (!state.isAuthenticated || !state.accessToken) {
            getPlayerInstance()?.disconnect();
            return;
        }

        initSpotifyPlayerOnce({
            name: 'Mio Infotainment',
            getAccessToken: getAccessTokenForPlayer,
            onReady: () => setIsPlayerSdkReady(true),
            onNotReady: () => setIsPlayerSdkReady(false),
            onStateChange: _setPlayerState,
            onAuthError: async () => {
                console.warn('📣 [PLAYER EVENT] authentication_error received.');
                const ok = await attemptRefreshAndUpdatePlayerToken();
                if (!ok) {
                    console.error('⛔ [PLAYER EVENT] refresh failed after auth error -> forcing re-login.');
                    logout();
                }
            },
            onPlaybackError: (message: string) => {
                if (message.includes('autoplay') || message.includes('NotAllowedError')) {
                    setAutoplayBlocked(true);
                }
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
        const newVolume = state.isMuted
            ? (state.lastVolume > 0 ? state.lastVolume : 0.5) // unmuting
            : 0; // muting
        setVolumeFinal(newVolume); // This will update state and call SDK
    }, [state.isMuted, state.lastVolume, setVolumeFinal]);

    const pauseSpotify = useCallback(async () => { getPlayerInstance()?.pause(); }, []);
    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => { pauseSpotify(); setNowPlaying(prev => ({ ...prev, source: 'youtube', youtubeTrack: track, youtubePlaylist: playlist, radioStation: null, isLoading: prev.source !== 'youtube' })); }, [pauseSpotify]);
    const clearError = useCallback(() => { setState(s => ({...s, error: null})); }, []);
    const unlockAutoplay = useCallback(() => { getPlayerInstance()?.resume().then(() => setAutoplayBlocked(false)).catch(err => console.error("Failed to resume playback:", err)); }, []);
    const isPlayerReady = isPlayerSdkReady && !!getDeviceId();
    
    return (
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play, playYouTube, refreshTrigger, triggerDataRefresh, _setPlayerState, setVolumeLive, setVolumeFinal, toggleMute, nowPlaying, setNowPlaying, isPlayerReady, pauseSpotify, youTubeFavorites, onToggleYouTubeFavorite, isAutoplayBlocked, unlockAutoplay, lastPlayInitiated, homeContentLoading, homeContentError, hasFetchedHomeContent, continueListeningItems, newReleases, userPlaylists, madeForYouPlaylists, topArtists, chartsPlaylists, genresCategories, recommendedShows, partyPlaylists, topTracks, artistRadioTracks, trackRecommendations, savedAlbums, madeForYou, triggerHomeContentFetch, resetHomeContent }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
