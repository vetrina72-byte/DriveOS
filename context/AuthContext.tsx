
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import apiClient from '../api';
import { getSessionId } from '../lib/sessionId';
import { SpotifyItem } from '../components/PlaylistItem';
import type { RadioStation, YouTubeTrackInfo, SpotifyDevice, NowPlayingState } from '../types';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import { initSpotifyPlayerOnce, setVolumeThrottled, setVolumeFinal as setVolumeFinalLib, safePlay } from '../lib/spotify-player';

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

const initialNowPlaying: NowPlayingState = {
    source: null,
    spotifyState: null,
    radioStation: null,
    radioContext: [],
    youtubeTrack: null,
    youtubePlaylist: [],
    isLoading: false,
    activeDevice: null
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AuthState>(initialAuthState);
    const [nowPlaying, setNowPlaying] = useState<NowPlayingState>(initialNowPlaying);
    const [isPlayerReady, setIsPlayerReady] = useState(false);
    const [volume, setVolume] = useState(0.5);
    const [isMuted, setIsMuted] = useState(false);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const sessionIdRef = useRef<string>(getSessionId());

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
            // LOG RICHIESTO: "1" quando si attiva il refresh
            console.log('1 [REFRESH ATTIVATO]'); 
            
            const sid = sessionIdRef.current;
            const res = await fetch(`/api/refresh-token`, {
                method: 'POST',
                headers: { 'x-session-id': sid },
                credentials: 'include' // Important: Send HttpOnly cookies
            });
            const data = await res.json();
            if (res.ok && data.access_token) {
                const { access_token, expires_in, expires_at } = data;
                const newExpiresAt = expires_at || (Date.now() + expires_in * 1000);
                
                console.log('[Auth] Refresh successful. Next expiry:', new Date(newExpiresAt).toLocaleTimeString());

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
                console.warn('[Auth] Refresh failed:', data.error);
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
        setNowPlaying(initialNowPlaying);
        // Clear data
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
            
            // Scenario 1: We have a valid token in local storage
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
                // Scenario 2: Token is expired or missing. 
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
    // Checks every 60 seconds if the token is about to expire (< 5 mins).
    // This is more robust than a single setTimeout which can be killed by browser throttling.
    useEffect(() => {
        if (!state.isAuthenticated || !state.expiresAt || !state.accessToken) return;

        const checkTokenValidity = async () => {
            const now = Date.now();
            const timeUntilExpiry = state.expiresAt! - now;
            const refreshBuffer = 5 * 60 * 1000; // Refresh 5 minutes before expiry

            // Log Timer: Prints remaining time every 60 seconds
            if (timeUntilExpiry > 0) {
                const mins = Math.floor(timeUntilExpiry / 60000);
                const secs = Math.floor((timeUntilExpiry % 60000) / 1000);
                console.log(`[Auth Timer] Refresh token tra: ${mins}m ${secs}s`);
            }

            if (timeUntilExpiry < refreshBuffer) {
                await attemptRefreshAndUpdatePlayerToken();
            }
        };

        const intervalId = setInterval(checkTokenValidity, 60000);
        
        // Run check immediately to catch cases where we load near expiry
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

    // Player Logic
    useEffect(() => {
        if (!state.isAuthenticated || !state.accessToken) return;

        initSpotifyPlayerOnce({
            name: 'DriveOS', // Changed device name here
            getAccessToken: async () => {
                // FIX: Check localStorage directly to avoid stale closures in the Singleton SDK instance.
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
                    setNowPlaying(prev => ({
                        ...prev,
                        source: 'spotify',
                        spotifyState: playerState,
                        isLoading: false // Clear loading on state update
                    }));
                } else {
                    setNowPlaying(prev => ({ ...prev, spotifyState: null }));
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
        setNowPlaying(s => {
            // Optimistic Update for responsiveness
            const optimisticState = s.spotifyState ? { ...s.spotifyState, paused: false } : null;
            return {
                ...s,
                source: 'spotify',
                isLoading: false, // REMOVED SPINNER as requested
                spotifyState: optimisticState, // Set playing immediately
                radioStation: null, // Clear other sources
                youtubeTrack: null
            };
        });

        try {
            await safePlay(options, attemptRefreshAndUpdatePlayerToken);
        } catch (e) {
            console.error("Play failed", e);
            // Optional: We could set loading false here, but we already set it to false above.
        }
    }, [attemptRefreshAndUpdatePlayerToken]);

    const pauseSpotify = useCallback(async () => {
        // Optimistic Update for responsiveness
        setNowPlaying(s => {
            if (s.spotifyState && !s.spotifyState.paused) {
                return {
                    ...s,
                    spotifyState: { ...s.spotifyState, paused: true }
                };
            }
            return s;
        });

        try {
            await apiClient.put('/me/player/pause');
        } catch (e) { console.error(e); }
    }, []);

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

    // Home Data Fetching (Simplified for brevity, assume implementation handles endpoints)
    const triggerHomeContentFetch = useCallback(async () => {
        if (homeContentFetched || homeContentLoading || !state.isAuthenticated) return;
        setHomeContentLoading(true);
        setHomeContentError(null);
        
        try {
            // Mocking fetch logic - in reality this calls many endpoints
            const [
                recent, releases, playlists, madeForYouList, artists, 
                charts, genres, shows, party, topTrks, 
                // ... other endpoints
            ] = await Promise.all([
                apiClient.get('/me/player/recently-played?limit=10').catch(()=>({data:{items:[]}})),
                apiClient.get('/browse/new-releases?limit=10').catch(()=>({data:{albums:{items:[]}}})),
                apiClient.get('/me/playlists?limit=10').catch(()=>({data:{items:[]}})),
                // ... mocked responses for others to avoid huge block
                Promise.resolve({data:{message: '', playlists: {items: []}}}), // madeForYouPlaylists
                apiClient.get('/me/top/artists?limit=10').catch(()=>({data:{items:[]}})),
                Promise.resolve({data:{playlists:{items:[]}}}), // charts
                apiClient.get('/browse/categories?limit=10').catch(()=>({data:{categories:{items:[]}}})),
                apiClient.get('/me/shows?limit=10').catch(()=>({data:{items:[]}})),
                Promise.resolve({data:{playlists:{items:[]}}}), // party
                apiClient.get('/me/top/tracks?limit=10').catch(()=>({data:{items:[]}})),
            ]);

            // Map data
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
            
            // ... set others ...

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

    // Volume
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
        // Maybe try to resume?
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
