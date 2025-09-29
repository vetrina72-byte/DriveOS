
import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import axios from 'axios';
import apiClient from '../api';
import type { SpotifyPlayerState } from '@/globals';
import { NowPlayingState, YouTubeTrackInfo } from '../types';

interface SpotifyUser {
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

interface PlayOptions {
    uris?: string[];
    context_uri?: string;
    offset?: {
        position?: number;
        uri?: string;
    };
    position_ms?: number;
}

interface AuthContextType extends Omit<AuthState, 'lastVolume' | 'refreshToken' | 'expiresIn'> {
    login: (authCode?: string | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions) => void;
    playYouTube: (track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => void;
    setDeviceId: (id: string | null) => void;
    refreshTrigger: number;
    _setPlayerState: (state: SpotifyPlayerState | null) => void;
    setVolume: (level: number) => void;
    toggleMute: () => void;
    silentRefreshToken: () => Promise<void>;
    nowPlaying: NowPlayingState;
    setNowPlaying: React.Dispatch<React.SetStateAction<NowPlayingState>>;
    isPlayerReady: boolean;
    pauseSpotify: () => void;
    setPlayerAsReadyForAutoplay: () => void;
    youTubeFavorites: string[];
    onToggleYouTubeFavorite: (playlistId: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
    accessToken: null,
    expiresAt: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    volume: 1,
    isMuted: false,
    lastVolume: 1,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>(initialState);
    const [deviceId, setDeviceIdState] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const refreshInFlight = useRef<Promise<void> | null>(null);
    const [nowPlaying, setNowPlaying] = useState<NowPlayingState>({
        source: null,
        spotifyState: null,
        radioStation: null,
        radioContext: [],
        youtubeTrack: null,
        isLoading: false,
    });
    const [isReadyForAutoplay, setIsReadyForAutoplay] = useState(false);
    const [youTubeFavorites, setYouTubeFavorites] = useState<string[]>([]);
    const hasRestoredPlayback = useRef(false);

    useEffect(() => {
        try {
            const storedFavorites = localStorage.getItem('youtube_favorites');
            if (storedFavorites) {
                setYouTubeFavorites(JSON.parse(storedFavorites));
            }
        } catch (e) {
            console.error("Failed to load YouTube favorites from localStorage", e);
        }
    }, []);

    const onToggleYouTubeFavorite = useCallback((playlistId: string) => {
        setYouTubeFavorites(prev => {
            const newFavorites = prev.includes(playlistId)
                ? prev.filter(id => id !== playlistId)
                : [...prev, playlistId];
            
            try {
                localStorage.setItem('youtube_favorites', JSON.stringify(newFavorites));
            } catch (e) {
                console.error("Failed to save YouTube favorites to localStorage", e);
            }

            return newFavorites;
        });
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_expires_at');
        // Chiama la nostra API per cancellare il cookie HttpOnly
        axios.post('/api/logout', {}, { withCredentials: true }).catch(err => {
            console.error("Logout API call failed:", err);
        });
        setState(initialState);
        // Assicurati che il loading termini dopo il logout
        setState(s => ({...s, isLoading: false}));
    }, []);

    const silentRefreshToken = useCallback(async () => {
      if (refreshInFlight.current) {
        return refreshInFlight.current;
      }
      const promise = (async () => {
        console.log("Attempting silent token refresh...");
        try {
          const { data } = await axios.post('/api/refresh-token', {}, { withCredentials: true });
          const { access_token, expires_in } = data;
          const newExpiresAt = Date.now() + expires_in * 1000;

          localStorage.setItem('spotify_access_token', access_token);
          localStorage.setItem('spotify_expires_at', String(newExpiresAt));
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;

          setState(s => ({
            ...s,
            accessToken: access_token,
            expiresAt: newExpiresAt,
          }));
          console.log("%c[Spotify] Token refreshed successfully ✅", "color: lime; font-weight: bold");
        } catch (err) {
          console.error("Silent token refresh failed. Forcing logout.", err);
          logout();
          // Propaga l'errore per far fallire le chiamate in coda nell'interceptor
          throw err;
        } finally {
          refreshInFlight.current = null;
        }
      })();
      refreshInFlight.current = promise;
      return promise;
    }, [logout]);
    
    // Effetto per il refresh automatico del token prima della scadenza
    useEffect(() => {
        let refreshTimeout: ReturnType<typeof setTimeout>;

        if (state.isAuthenticated && state.expiresAt) {
            const now = Date.now();
            // Pianifica il refresh 2 minuti prima della scadenza per sicurezza
            const timeoutDuration = state.expiresAt - now - 120000; 

            if (timeoutDuration > 0) {
                refreshTimeout = setTimeout(silentRefreshToken, timeoutDuration);
            } else {
                // Se il token è già scaduto o sta per scadere, rinfrescalo subito
                silentRefreshToken();
            }
        }

        return () => {
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
            }
        };
    }, [state.isAuthenticated, state.expiresAt, silentRefreshToken]);

   const _setPlayerState = useCallback((newState: SpotifyPlayerState | null) => {
        setNowPlaying(s => {
            if (s.source !== 'spotify' && s.source !== null) {
                return { ...s, spotifyState: newState };
            }

            const stillLoading = s.isLoading && !(newState && newState.track_window.current_track);

            return {
                ...s,
                spotifyState: newState,
                isLoading: stillLoading,
                source: newState ? 'spotify' : null
            };
        });
    }, []);
    
    const fetchUserInfo = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/me');
            return data;
        } catch (err) {
            console.error('Failed to fetch user info.', err);
            return null;
        }
    }, []);

    // Effetto principale all'avvio dell'app per tentare di autenticare l'utente
    useEffect(() => {
        const initAuth = async () => {
            try {
                const { data } = await axios.post('/api/refresh-token', {}, { withCredentials: true });
                const { access_token, expires_in } = data;
                const expiresAt = Date.now() + expires_in * 1000;
                
                localStorage.setItem('spotify_access_token', access_token);
                localStorage.setItem('spotify_expires_at', String(expiresAt));
                apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
                
                const user = await fetchUserInfo();
                if (user) {
                    setState(s => ({...s, accessToken: access_token, expiresAt, user, isAuthenticated: true}));
                } else {
                    throw new Error("Failed to fetch user info after token refresh.");
                }
            } catch (err) {
                console.log("No valid session found on load. User needs to login.");
                logout(); 
            } finally {
                setState(s => ({...s, isLoading: false}));
            }
        };

        initAuth();
    }, [fetchUserInfo, logout]);

    const login = useCallback(async (authCode?: string | null, authError?: string) => {
        setState(s => ({ ...s, isLoading: true, error: null }));
    
        if (authError) {
             setState(s => ({...s, error: authError, isLoading: false}));
             return;
        }
    
        if (!authCode) {
            setState(s => ({...s, error: 'Authorization code is missing.', isLoading: false}));
            return;
        }
    
        try {
            // Usa la nuova API route per lo scambio
            const response = await axios.post('/api/exchange-token', { code: authCode }, { withCredentials: true });
            const { access_token, expires_in } = response.data;
            const expiresAt = Date.now() + expires_in * 1000;
    
            localStorage.setItem('spotify_access_token', access_token);
            localStorage.setItem('spotify_expires_at', String(expiresAt));
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
            const userData = await fetchUserInfo();
            if (userData) {
                setState(s => ({
                    ...s,
                    accessToken: access_token,
                    expiresAt,
                    user: userData,
                    isAuthenticated: true,
                    isLoading: false,
                    error: null,
                }));
            } else {
                 throw new Error("Failed to fetch user info after login.");
            }
        } catch (err: any) {
            console.error('Login process failed:', err);
            const errorMessage = err.response?.data?.details?.error_description || 'Failed to complete login.';
            logout(); 
            setState(s => ({...s, error: errorMessage, isLoading: false}));
        }
    }, [fetchUserInfo, logout]);
    
    const refreshHomePage = useCallback(() => {
        setRefreshTrigger(prev => prev + 1);
    }, []);

    const setVolume = useCallback((level: number) => {
        const newVolume = Math.max(0, Math.min(1, level));
        setState(s => {
            if (s.volume === newVolume) return s;
            return {
                ...s,
                volume: newVolume,
                isMuted: newVolume === 0,
                ...(newVolume > 0 && { lastVolume: newVolume }),
            };
        });
    }, []);

    const toggleMute = useCallback(() => {
        setState(s => {
            const newMuted = !s.isMuted;
            const newVolume = newMuted ? 0 : (s.lastVolume > 0 ? s.lastVolume : 0.5);
            return {
                ...s,
                volume: newVolume,
                isMuted: newVolume === 0,
            };
        });
    }, []);

    const setPlayerAsReadyForAutoplay = useCallback(() => {
        setIsReadyForAutoplay(true);
    }, []);

    const pauseSpotify = useCallback(async () => {
        if (!deviceId) return;
        try {
            await apiClient.put(`/me/player/pause?device_id=${deviceId}`);
        } catch (e) {
            console.error("Failed to pause spotify", e);
        }
    }, [deviceId]);

    const play = useCallback(async (options: PlayOptions) => {
        if (!deviceId) {
            console.error("Cannot play: No active Spotify device ID.");
            return;
        }

        const showLoader = nowPlaying.source !== 'spotify' || !nowPlaying.spotifyState || nowPlaying.spotifyState.paused;

        setNowPlaying(prev => ({
            ...prev,
            source: 'spotify',
            radioStation: null,
            radioContext: [],
            youtubeTrack: null,
            isLoading: showLoader,
        }));
        
        try {
            const body: { context_uri?: string; uris?: string[]; offset?: any; position_ms?: number } = {};

            if (options.context_uri) {
                body.context_uri = options.context_uri;
                if (options.offset) body.offset = options.offset;
            } else if (options.uris) {
                body.uris = options.uris;
                if (options.offset) body.offset = options.offset;
            }
            if (options.position_ms) {
                body.position_ms = options.position_ms;
            }
            
            await apiClient.put(
                `/me/player/play?device_id=${deviceId}`,
                body
            );
            refreshHomePage();
        } catch (err) {
            console.error('Failed to start playback', err);
            setNowPlaying(prev => ({ ...prev, isLoading: false }));
        }
    }, [deviceId, refreshHomePage, nowPlaying.source, nowPlaying.spotifyState]);
    
    const restorePlaybackOnInit = useCallback(async () => {
        if (!deviceId || hasRestoredPlayback.current) return;
    
        console.log("[Spotify] Attempting to restore previous playback session...");
        hasRestoredPlayback.current = true;
    
        try {
            const response = await apiClient.get('/me/player');
    
            if (!response.data || !response.data.item) {
                console.log("[Spotify] No active or recent session found to restore.");
                return;
            }
    
            const { item, is_playing, progress_ms, context } = response.data;
            
            if (is_playing) {
                console.log("[Spotify] Resuming active session...");
                const playOptions: PlayOptions = {
                    position_ms: progress_ms,
                };
    
                if (context) {
                    playOptions.context_uri = context.uri;
                    playOptions.offset = { uri: item.uri };
                } else {
                    playOptions.uris = [item.uri];
                }
                
                await play(playOptions);
    
            } else {
                console.log("[Spotify] Restoring paused session state.");
                const restoredState: SpotifyPlayerState = {
                    context: context || { uri: null, metadata: null },
                    disallows: response.data.actions?.disallows || { pausing: true },
                    duration: item.duration_ms,
                    paused: true,
                    position: progress_ms,
                    repeat_mode: response.data.repeat_state === 'context' ? 1 : response.data.repeat_state === 'track' ? 2 : 0,
                    shuffle: response.data.shuffle_state,
                    track_window: {
                        current_track: item,
                        previous_tracks: [],
                        next_tracks: [],
                    },
                    timestamp: Date.now(),
                };
                _setPlayerState(restoredState);
            }
        } catch (err: any) {
            const isAxiosErr = 'isAxiosError' in err && err.isAxiosError;
            const status = isAxiosErr ? err.response?.status : null;
            if (status !== 404 && status !== 204) {
                 console.error("[Spotify] Error restoring playback state:", isAxiosErr ? (err.response?.data || err.message) : err);
            }
        }
    }, [deviceId, play, _setPlayerState]);

    useEffect(() => {
        if (state.isAuthenticated && deviceId && !hasRestoredPlayback.current) {
            const restoreTimeout = setTimeout(() => {
                restorePlaybackOnInit();
            }, 500);

            return () => clearTimeout(restoreTimeout);
        }
    }, [state.isAuthenticated, deviceId, restorePlaybackOnInit]);

    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => {
        pauseSpotify();

        const showLoader = nowPlaying.source !== 'youtube';
        
        setNowPlaying(prev => ({
            ...prev,
            source: 'youtube',
            youtubeTrack: track,
            youtubePlaylist: playlist,
            radioStation: null,
            radioContext: [],
            isLoading: showLoader,
        }));
    }, [pauseSpotify, nowPlaying.source]);

    const clearError = () => {
        setState(s => ({...s, error: null}));
    };

    const isPlayerReady = !!deviceId;

    return (
    <AuthContext.Provider value={{ ...state, login, logout, clearError, play, playYouTube, setDeviceId: setDeviceIdState, refreshTrigger, _setPlayerState, setVolume, toggleMute, silentRefreshToken, nowPlaying, setNowPlaying, isPlayerReady, pauseSpotify, setPlayerAsReadyForAutoplay, youTubeFavorites, onToggleYouTubeFavorite }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
