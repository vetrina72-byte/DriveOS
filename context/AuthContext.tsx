
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api';
import { getSessionId } from '../lib/sessionId';
import { SpotifyItem } from '../components/PlaylistItem';
import type { RadioStation, YouTubeTrackInfo, SpotifyDevice, NowPlayingState } from '../types';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import { initSpotifyPlayerOnce, setVolumeThrottled, setVolumeFinal as setVolumeFinalLib, safePlay, getDeviceId, seekLocal, activatePlayer } from '../lib/spotify-player';

// Types
export interface SpotifyUser {
    id: string;
    display_name: string;
    email: string;
    product: string;
    images?: { url: string }[];
}

export interface TokenData {
    access_token: string;
    expires_in: number;
    expires_at?: number;
}

interface AuthState {
    isAuthenticated: boolean;
    accessToken: string | null;
    expiresAt: number | null;
    user: SpotifyUser | null;
    isLoading: boolean;
    error: string | null;
}

interface AuthContextType extends AuthState {
    login: (tokenData?: TokenData | null, authError?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    
    // Player
    nowPlaying: NowPlayingState;
    setNowPlaying: React.Dispatch<React.SetStateAction<NowPlayingState>>;
    isPlayerReady: boolean;
    volume: number;
    isMuted: boolean;
    setVolumeLive: (vol: number) => void;
    setVolumeFinal: (vol: number) => void;
    play: (options: { uris?: string[], context_uri?: string, offset?: any }, itemForOptimisticUpdate?: SpotifyItem) => Promise<void>;
    pauseSpotify: () => Promise<void>;
    seek: (position_ms: number) => Promise<void>; // Added seek
    playYouTube: (track: YouTubeTrackInfo, context?: YouTubeTrackInfo[]) => void;
    
    // Data
    triggerDataRefresh: () => void;
    refreshTrigger: number;
    
    // Home Data
    homeContentLoading: boolean;
    homeContentError: string | null;
    triggerHomeContentFetch: () => void;
    resetHomeContent: () => void;
    
    continueListeningItems: SpotifyItem[];
    newReleases: SpotifyItem[];
    userPlaylists: SpotifyItem[];
    madeForYouPlaylists: SpotifyItem[];
    topArtists: SpotifyItem[];
    chartsPlaylists: SpotifyItem[];
    genresCategories: SpotifyItem[];
    recommendedShows: SpotifyItem[];
    partyPlaylists: SpotifyItem[];
    topTracks: SpotifyItem[];
    artistRadioTracks: SpotifyItem[];
    trackRecommendations: SpotifyItem[];
    savedAlbums: SpotifyItem[];
    madeForYou: SpotifyItem[];

    // YouTube Favorites
    youTubeFavorites: string[];
    onToggleYouTubeFavorite: (id: string) => void;

    // Autoplay
    isAutoplayBlocked: boolean;
    unlockAutoplay: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialAuthState: AuthState = {
    isAuthenticated: false,
    accessToken: null,
    expiresAt: null,
    user: null,
    isLoading: true,
    error: null,
};

const defaultNowPlaying: NowPlayingState = {
    source: null,
    spotifyState: null,
    radioStation: null,
    radioContext: [],
    youtubeTrack: null,
    youtubePlaylist: [],
    isLoading: false,
    activeDevice: null
};

// Helper to construct a partial SpotifyPlayerState from the API response
const mapApiPlaybackToState = (data: any): SpotifyPlayerState | null => {
    if (!data || !data.item) return null;
    
    return {
        context: {
            uri: data.context?.uri || null,
            metadata: null,
        },
        disallows: {}, // API doesn't provide this easily, default empty
        duration: data.item.duration_ms,
        paused: !data.is_playing,
        position: data.progress_ms,
        repeat_mode: data.repeat_state === 'track' ? 2 : data.repeat_state === 'context' ? 1 : 0,
        shuffle: data.shuffle_state,
        timestamp: data.timestamp,
        track_window: {
            current_track: {
                id: data.item.id,
                uri: data.item.uri,
                type: data.item.type,
                media_type: 'audio',
                name: data.item.name,
                is_playable: true,
                album: {
                    uri: data.item.album.uri,
                    name: data.item.album.name,
                    images: data.item.album.images
                },
                artists: data.item.artists
            },
            next_tracks: [], // API doesn't provide easily
            previous_tracks: [] // API doesn't provide easily
        }
    };
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>(initialAuthState);
    
    // --- SYNCHRONOUS HYDRATION (Cold Start Fix) ---
    const [nowPlaying, setNowPlaying] = useState<NowPlayingState>(() => {
        try {
            const saved = localStorage.getItem('last_played_track');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed.spotifyState) {
                    parsed.spotifyState.paused = true;
                }
                return { ...defaultNowPlaying, ...parsed, isLoading: false };
            }
        } catch (e) {
            console.error("Failed to hydrate player state:", e);
        }
        return defaultNowPlaying;
    });

    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const sessionIdRef = useRef<string>(getSessionId());

    // FAST POLLING REFS
    const fastPollingIntervalRef = useRef<number | null>(null);
    const fastPollingTimeoutRef = useRef<number | null>(null);

    // --- INTERACTION LOCK REFS ---
    // When we perform an action (Play/Pause/Seek), we lock the state for X seconds.
    // During this time, we IGNORE polling updates to prevent "flickering" or "rubber-banding".
    const interactionLockEnd = useRef<number>(0);

    // Home Content State
    const [homeContentLoading, setHomeContentLoading] = useState(false);
    const [homeContentError, setHomeContentError] = useState<string | null>(null);
    const [homeContentFetched, setHomeContentFetched] = useState(false);
    
    const [continueListeningItems, setContinueListeningItems] = useState<SpotifyItem[]>([]);
    const [newReleases, setNewReleases] = useState<SpotifyItem[]>([]);
    const [userPlaylists, setUserPlaylists] = useState<SpotifyItem[]>([]);
    const [madeForYouPlaylists, setMadeForYouPlaylists] = useState<SpotifyItem[]>([]);
    const [topArtists, setTopArtists] = useState<SpotifyItem[]>([]);
    const [chartsPlaylists, setChartsPlaylists] = useState<SpotifyItem[]>([]);
    const [genresCategories, setGenresCategories] = useState<SpotifyItem[]>([]);
    const [recommendedShows, setRecommendedShows] = useState<SpotifyItem[]>([]);
    const [partyPlaylists, setPartyPlaylists] = useState<SpotifyItem[]>([]);
    const [topTracks, setTopTracks] = useState<SpotifyItem[]>([]);
    const [artistRadioTracks, setArtistRadioTracks] = useState<SpotifyItem[]>([]);
    const [trackRecommendations, setTrackRecommendations] = useState<SpotifyItem[]>([]);
    const [savedAlbums, setSavedAlbums] = useState<SpotifyItem[]>([]);
    const [madeForYou, setMadeForYou] = useState<SpotifyItem[]>([]);

    const [youTubeFavorites, setYouTubeFavorites] = useState<string[]>([]);
    const [isAutoplayBlocked, setIsAutoplayBlocked] = useState(false);

    // Helpers
    const fetchUserInfo = useCallback(async (): Promise<SpotifyUser | null> => {
        try {
            const { data } = await apiClient.get('/me');
            return data;
        } catch (e) {
            console.error('Error fetching user info', e);
            return null;
        }
    }, []);

    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        try {
            const sid = sessionIdRef.current;
            const res = await fetch(`/api/refresh-token`, {
                method: 'POST',
                headers: { 'x-session-id': sid },
                credentials: 'include' 
            });
            const data = await res.json();
            if (res.ok && data.access_token) {
                const { access_token, expires_in, expires_at } = data;
                const newExpiresAt = expires_at || (Date.now() + expires_in * 1000);
                
                localStorage.setItem('accessToken', access_token);
                localStorage.setItem('expiresAt', String(newExpiresAt));
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                
                setState(prev => ({
                    ...prev,
                    accessToken: access_token,
                    expiresAt: newExpiresAt,
                }));
                return true;
            } else {
                return false;
            }
        } catch (e) {
            console.error('[Auth] Refresh token network error', e);
            return false;
        }
    }, []);

    const logout = useCallback(async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch(e) {}
        
        localStorage.removeItem('accessToken');
        localStorage.removeItem('expiresAt');
        delete apiClient.defaults.headers.common['Authorization'];
        
        setState(initialAuthState);
        setNowPlaying(defaultNowPlaying);
        
        setContinueListeningItems([]);
        setUserPlaylists([]);
        setNewReleases([]);
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
        
        setHomeContentFetched(false);
    }, []);

    const triggerDataRefresh = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    // Init Effect
    useEffect(() => {
        const initFromStorage = async () => {
            const token = localStorage.getItem('accessToken');
            const expiresAt = Number(localStorage.getItem('expiresAt') || '0');
            
            if (token && expiresAt > Date.now()) {
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                const user = await fetchUserInfo();
                if (user) {
                    setState(s => ({ ...s, user, accessToken: token, expiresAt, isAuthenticated: true, isLoading: false }));
                } else {
                    const refreshed = await attemptRefreshAndUpdatePlayerToken();
                    if (refreshed) {
                        const retriedUser = await fetchUserInfo();
                        if (retriedUser) setState(s => ({ ...s, user: retriedUser, isAuthenticated: true, isLoading: false }));
                        else logout();
                    } else {
                        logout();
                    }
                }
            } else { 
                const refreshed = await attemptRefreshAndUpdatePlayerToken();
                if (refreshed) {
                    const user = await fetchUserInfo();
                    if (user) {
                        setState(s => ({ ...s, user, isAuthenticated: true, isLoading: false }));
                    } else {
                        logout();
                    }
                } else {
                    setState(s => ({ ...s, isLoading: false })); 
                }
            }
        };
        initFromStorage();
    }, [fetchUserInfo, logout, attemptRefreshAndUpdatePlayerToken]);

    // --- PROACTIVE REFRESH POLLING ---
    useEffect(() => {
        if (!state.isAuthenticated || !state.expiresAt || !state.accessToken) return;

        const checkTokenValidity = async () => {
            const now = Date.now();
            const timeUntilExpiry = state.expiresAt! - now;
            const refreshBuffer = 5 * 60 * 1000; 

            if (timeUntilExpiry < refreshBuffer) {
                await attemptRefreshAndUpdatePlayerToken();
            }
        };

        const intervalId = setInterval(checkTokenValidity, 60000);
        checkTokenValidity();

        return () => clearInterval(intervalId);
    }, [state.isAuthenticated, state.expiresAt, state.accessToken, attemptRefreshAndUpdatePlayerToken]);

    const login = useCallback(async (tokenData?: TokenData | null, authError?: string) => {
        setState(s => ({ ...s, isLoading: true, error: null }));
        if (authError) { setState(s => ({...s, error: authError, isLoading: false})); return; }
        if (!tokenData?.access_token) { setState(s => ({...s, error: 'Token missing.', isLoading: false})); return; }
        try {
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

    const clearError = useCallback(() => {
        setState(s => ({ ...s, error: null }));
    }, []);

    // --- REUSABLE SYNC LOGIC ---
    const syncWithRealServerState = useCallback(async () => {
        if (!state.isAuthenticated) return;
        try {
            const { data } = await apiClient.get('/me/player');
            
            if (data && data.item) {
                // --- INTERACTION LOCK CHECK ---
                // If the user recently interacted (Play/Pause/Seek), we IGNORE server updates
                // for 2 seconds to prevent the UI from "flickering" back to the old state.
                if (Date.now() < interactionLockEnd.current) {
                    // We are locked. Do not update state from server.
                    // This allows our optimistic UI to persist until the server catches up.
                    return; 
                }

                const mappedState = mapApiPlaybackToState(data);
                
                if (mappedState) {
                    setNowPlaying(prev => {
                        // Prevent UI stutter: Only update if something changed
                        if (prev.spotifyState && 
                            prev.spotifyState.position === mappedState.position && 
                            prev.spotifyState.paused === mappedState.paused &&
                            prev.spotifyState.track_window.current_track?.id === mappedState.track_window.current_track?.id
                        ) {
                            return prev;
                        }
                        
                        const newState = {
                            ...prev,
                            source: 'spotify' as const,
                            spotifyState: mappedState,
                            activeDevice: data.device,
                            isLoading: false
                        };
                        localStorage.setItem('last_played_track', JSON.stringify({
                            source: 'spotify',
                            spotifyState: mappedState
                        }));
                        return newState;
                    });
                    return;
                }
            } else if (data === '' || (data && !data.item)) {
                // If API returns nothing, maybe paused or empty.
                if (Date.now() < interactionLockEnd.current) return;

                setNowPlaying(prev => {
                    if (prev.spotifyState) {
                        return { ...prev, spotifyState: { ...prev.spotifyState, paused: true } };
                    }
                    return prev;
                });
            }
        } catch (e) { 
            console.warn('Failed to fetch player state', e); 
        }
    }, [state.isAuthenticated]);

    // --- TURBO POLLING TRIGGER ---
    const triggerFastPolling = useCallback(() => {
        // Clear existing
        if (fastPollingIntervalRef.current) clearInterval(fastPollingIntervalRef.current);
        if (fastPollingTimeoutRef.current) clearTimeout(fastPollingTimeoutRef.current);

        // We do NOT sync immediately here if we just set a lock in the calling function.
        // The polling loop will handle checking the lock.

        // Phase 1: Turbo (500ms) for the first 2.5 seconds
        fastPollingIntervalRef.current = window.setInterval(syncWithRealServerState, 500);

        // Phase 2: Slow down to 1500ms after 2.5s
        fastPollingTimeoutRef.current = window.setTimeout(() => {
            if (fastPollingIntervalRef.current) clearInterval(fastPollingIntervalRef.current);
            
            fastPollingIntervalRef.current = window.setInterval(syncWithRealServerState, 1500);
            
            // Phase 3: Stop completely after 10s total
            fastPollingTimeoutRef.current = window.setTimeout(() => {
                if (fastPollingIntervalRef.current) clearInterval(fastPollingIntervalRef.current);
                fastPollingIntervalRef.current = null;
            }, 7500); // 2.5 + 7.5 = 10s total
        }, 2500);
    }, [syncWithRealServerState]);

    // Regular slow polling
    useEffect(() => {
        if (!state.isAuthenticated) return;
        syncWithRealServerState();
        const interval = setInterval(syncWithRealServerState, 10000); 
        return () => clearInterval(interval);
    }, [state.isAuthenticated, syncWithRealServerState]);


    // Player Logic
    useEffect(() => {
        if (!state.isAuthenticated || !state.accessToken) return;

        initSpotifyPlayerOnce({
            name: 'DriveOS', 
            getAccessToken: async () => {
                const storedExpiresAt = Number(localStorage.getItem('expiresAt') || '0');
                const storedToken = localStorage.getItem('accessToken') || '';

                if (storedExpiresAt && Date.now() > storedExpiresAt - 60000) {
                    const refreshed = await attemptRefreshAndUpdatePlayerToken();
                    if (refreshed) {
                        return localStorage.getItem('accessToken') || '';
                    }
                }
                return storedToken;
            },
            onReady: ({ device_id }) => {
                setIsPlayerReady(true);
            },
            onNotReady: () => setIsPlayerReady(false),
            onStateChange: (playerState) => {
                if (playerState) {
                    // The SDK local state is usually instant, so we trust it more than the REST API.
                    // However, we still respect the lock if we initiated a remote command that hasn't propagated yet.
                    if (Date.now() < interactionLockEnd.current) {
                        // We assume the SDK is correct for local updates
                    }

                    setNowPlaying(prev => {
                        const newState = {
                            ...prev,
                            source: 'spotify' as const,
                            spotifyState: playerState,
                            isLoading: false
                        };
                        localStorage.setItem('last_played_track', JSON.stringify({
                            source: 'spotify',
                            spotifyState: playerState,
                        }));
                        return newState;
                    });
                } 
            },
            onAuthError: (msg) => console.error(msg),
            onAccountError: (msg) => console.error(msg),
            onPlaybackError: (msg) => console.error(msg),
        }).then((player) => {
            player.connect();
        });
    }, [state.isAuthenticated, state.accessToken, attemptRefreshAndUpdatePlayerToken]);

    const play = useCallback(async (options: { uris?: string[], context_uri?: string, offset?: any }, itemForOptimisticUpdate?: SpotifyItem) => {
        // --- LOCK POLLING ---
        interactionLockEnd.current = Date.now() + 2000; // Lock for 2s

        // Check if we are taking control locally
        const localId = getDeviceId();
        const isTargetingLocal = !nowPlaying.activeDevice && localId;

        // --- FAST STARTUP OPTIMIZATION ---
        // If we are targeting local but it's not active, wake it up immediately
        if (isTargetingLocal) {
            activatePlayer(); 
        }

        // --- OPTIMISTIC UI UPDATE ---
        setNowPlaying(s => {
            const optimisticDevice = isTargetingLocal ? {
                id: localId!,
                is_active: true,
                is_private_session: false,
                is_restricted: false,
                name: 'DriveOS',
                type: 'Computer',
                volume_percent: 100
            } : s.activeDevice;

            const fakeState: SpotifyPlayerState | null = itemForOptimisticUpdate ? {
                context: { uri: options.context_uri || null, metadata: null },
                disallows: {},
                duration: 0,
                paused: false,
                position: 0,
                repeat_mode: 0,
                shuffle: false,
                track_window: {
                    current_track: {
                        id: itemForOptimisticUpdate.id,
                        uri: itemForOptimisticUpdate.uri,
                        type: 'track',
                        media_type: 'audio',
                        name: itemForOptimisticUpdate.name,
                        is_playable: true,
                        album: {
                            uri: '',
                            name: itemForOptimisticUpdate.album?.name || '',
                            images: itemForOptimisticUpdate.images || itemForOptimisticUpdate.album?.images || []
                        },
                        artists: itemForOptimisticUpdate.artists?.map(a => ({ uri: '', name: a.name })) || []
                    },
                    next_tracks: [],
                    previous_tracks: []
                },
                timestamp: Date.now()
            } : null;

            const currentState = s.spotifyState;
            const optimisticState = currentState 
                ? { 
                    ...currentState, 
                    paused: false, 
                    timestamp: Date.now(),
                    ...(itemForOptimisticUpdate ? { track_window: fakeState!.track_window } : {})
                  } 
                : fakeState;

            if (fakeState) {
                 return {
                    ...s,
                    source: 'spotify',
                    isLoading: false, 
                    spotifyState: fakeState, 
                    activeDevice: optimisticDevice, 
                    radioStation: null,
                    youtubeTrack: null
                };
            }

            return {
                ...s,
                source: 'spotify',
                isLoading: false, 
                spotifyState: optimisticState, 
                activeDevice: optimisticDevice,
                radioStation: null,
                youtubeTrack: null
            };
        });

        triggerFastPolling();

        try {
            await safePlay(options, attemptRefreshAndUpdatePlayerToken);
        } catch (e) {
            console.error("Play failed", e);
            // Revert state if failed
            setNowPlaying(s => s.spotifyState ? { ...s, spotifyState: { ...s.spotifyState, paused: true } } : s);
            interactionLockEnd.current = 0; // Clear lock
        }
    }, [attemptRefreshAndUpdatePlayerToken, nowPlaying.activeDevice, triggerFastPolling]);

    const pauseSpotify = useCallback(async () => {
        // --- LOCK POLLING ---
        interactionLockEnd.current = Date.now() + 2000;

        setNowPlaying(s => {
            if (s.spotifyState && !s.spotifyState.paused) {
                // Freeze position visually to prevent "jump"
                const frozenPosition = s.spotifyState.position;
                
                return {
                    ...s,
                    spotifyState: { 
                        ...s.spotifyState, 
                        paused: true,
                        position: frozenPosition,
                        timestamp: Date.now() 
                    }
                };
            }
            return s;
        });

        triggerFastPolling();

        try {
            await apiClient.put('/me/player/pause');
        } catch (e) { console.error(e); }
    }, [triggerFastPolling]);

    const seek = useCallback(async (position_ms: number) => {
        // --- LOCK POLLING ---
        interactionLockEnd.current = Date.now() + 2000;

        // Optimistic Update
        setNowPlaying(s => {
            if (s.spotifyState) {
                return {
                    ...s,
                    spotifyState: {
                        ...s.spotifyState,
                        position: position_ms,
                        timestamp: Date.now(),
                    }
                };
            }
            return s;
        });

        triggerFastPolling();

        // Check if we can use the local player SDK for instant seeking
        const localId = getDeviceId();
        const isLocalActive = nowPlaying.activeDevice?.id === localId;

        try {
            if (isLocalActive) {
                // FAST: Use Web Socket
                await seekLocal(position_ms);
            } else {
                // SLOW: Use REST API
                await apiClient.put(`/me/player/seek?position_ms=${position_ms}`);
            }
        } catch (e) { console.error(e); }
    }, [triggerFastPolling, nowPlaying.activeDevice]);

    const playYouTube = useCallback((track: YouTubeTrackInfo, context?: YouTubeTrackInfo[]) => {
        setNowPlaying(s => ({
            ...s,
            source: 'youtube',
            youtubeTrack: track,
            youtubePlaylist: context || [],
            radioStation: null,
            spotifyState: s.spotifyState ? { ...s.spotifyState, paused: true } : null,
            isLoading: true
        }));
    }, []);

    // Home Data Fetching (Simplified)
    const triggerHomeContentFetch = useCallback(async () => {
        if (homeContentFetched || homeContentLoading || !state.isAuthenticated) return;
        setHomeContentLoading(true);
        setHomeContentError(null);
        
        try {
            const [
                recent, releases, playlists, madeForYouList, artists, 
                charts, genres, shows, party, topTrks, 
            ] = await Promise.all([
                apiClient.get('/me/player/recently-played?limit=10').catch(()=>({data:{items:[]}})),
                apiClient.get('/browse/new-releases?limit=10').catch(()=>({data:{albums:{items:[]}}})),
                apiClient.get('/me/playlists?limit=10').catch(()=>({data:{items:[]}})),
                Promise.resolve({data:{message: '', playlists: {items: []}}}), 
                apiClient.get('/me/top/artists?limit=10').catch(()=>({data:{items:[]}})),
                Promise.resolve({data:{playlists:{items:[]}}}), 
                apiClient.get('/browse/categories?limit=10').catch(()=>({data:{categories:{items:[]}}})),
                apiClient.get('/me/shows?limit=10').catch(()=>({data:{items:[]}})),
                Promise.resolve({data:{playlists:{items:[]}}}), 
                apiClient.get('/me/top/tracks?limit=10').catch(()=>({data:{items:[]}})),
            ]);

            setContinueListeningItems(recent.data.items.map((i: any) => i.track || i).filter(Boolean));
            setNewReleases(releases.data.albums.items);
            setUserPlaylists(playlists.data.items);
            setMadeForYouPlaylists(madeForYouList.data.playlists.items);
            setTopArtists(artists.data.items);
            setChartsPlaylists(charts.data.playlists.items);
            setGenresCategories(genres.data.categories.items.map((c: any) => ({...c, type: 'category'})));
            setRecommendedShows(shows.data.items.map((i:any)=>i.show));
            setPartyPlaylists(party.data.playlists.items);
            setTopTracks(topTrks.data.items);
            
            setHomeContentFetched(true);
        } catch (e) {
            setHomeContentError('Failed to load home content.');
            console.error(e);
        } finally {
            setHomeContentLoading(false);
        }
    }, [homeContentFetched, homeContentLoading, state.isAuthenticated]);

    const resetHomeContent = useCallback(() => {
        setHomeContentFetched(false);
    }, []);

    const onToggleYouTubeFavorite = useCallback((id: string) => {
        setYouTubeFavorites(prev => 
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    }, []);

    const setVolumeLive = useCallback((vol: number) => {
        setVolume(vol);
        setVolumeThrottled(vol);
    }, []);

    const handleSetVolumeFinal = useCallback((vol: number) => {
        setVolume(vol);
        setVolumeFinalLib(vol);
    }, []);

    const unlockAutoplay = useCallback(() => {
        setIsAutoplayBlocked(false);
    }, []);

    const contextValue: AuthContextType = {
        ...state,
        login,
        logout,
        clearError,
        nowPlaying,
        setNowPlaying,
        isPlayerReady,
        volume,
        isMuted,
        setVolumeLive,
        setVolumeFinal: handleSetVolumeFinal,
        play,
        pauseSpotify,
        seek,
        playYouTube,
        triggerDataRefresh,
        refreshTrigger,
        homeContentLoading,
        homeContentError,
        triggerHomeContentFetch,
        resetHomeContent,
        continueListeningItems,
        newReleases,
        userPlaylists,
        madeForYouPlaylists,
        topArtists,
        chartsPlaylists,
        genresCategories,
        recommendedShows,
        partyPlaylists,
        topTracks,
        artistRadioTracks,
        trackRecommendations,
        savedAlbums,
        madeForYou,
        youTubeFavorites,
        onToggleYouTubeFavorite,
        isAutoplayBlocked,
        unlockAutoplay,
    };

    return (
        <AuthContext.Provider value={contextValue}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
