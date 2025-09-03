import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import axios from 'axios';
import apiClient from '../api';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import type { NowPlayingState } from '../types';

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
    nowPlaying: NowPlayingState;
    volume: number;
    isMuted: boolean;
    lastVolume: number;
    spotifyPlayerInstance: SpotifyPlayer | null;
}

interface AuthContextType extends Omit<AuthState, 'lastVolume' | 'spotifyPlayerInstance'> {
    login: (authCode?: string | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions) => void;
    setDeviceId: (id: string | null) => void;
    refreshTrigger: number;
    // FIX: Allow setNowPlaying to accept a functional update to prevent stale state issues.
    setNowPlaying: (update: Partial<NowPlayingState> | ((prevState: NowPlayingState) => Partial<NowPlayingState>)) => void;
    setSpotifyPlayerInstance: (player: SpotifyPlayer | null) => void;
    pauseSpotify: () => void;
    setVolume: (level: number) => void;
    toggleMute: () => void;
    silentRefreshToken: () => Promise<void>;
}

interface PlayOptions {
    uris?: string[];
    context_uri?: string;
    offset?: {
        position?: number;
        uri?: string;
    };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
    accessToken: null,
    expiresAt: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    nowPlaying: {
        source: null,
        spotifyState: null,
        radioStation: null,
        radioContext: [],
    },
    volume: 1,
    isMuted: false,
    lastVolume: 1,
    spotifyPlayerInstance: null,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>(initialState);
    const [deviceId, setDeviceIdState] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const refreshInFlight = useRef<Promise<void> | null>(null);

    const logout = useCallback(() => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_expires_at');
        axios.post('/api/logout', {}, { withCredentials: true }).catch(err => {
            console.error("Logout API call failed:", err);
        });
        setState(initialState);
        setState(s => ({...s, isLoading: false}));
    }, []);

    const silentRefreshToken = useCallback(async () => {
      if (refreshInFlight.current) {
        return refreshInFlight.current;
      }
      refreshInFlight.current = (async () => {
        console.log("Refreshing Spotify access token (silent)...");
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
          console.log("%c[Spotify] Token refreshed ✅", "color: lime; font-weight: bold");
        } catch (err) {
          console.error("Silent token refresh failed. Logging out.", err);
          logout();
        } finally {
          refreshInFlight.current = null;
        }
      })();
      return refreshInFlight.current;
    }, [logout]);
    
    useEffect(() => {
        let refreshTimeout: ReturnType<typeof setTimeout>;

        if (state.isAuthenticated && state.expiresAt) {
            const now = Date.now();
            const timeoutDuration = state.expiresAt - now - 120000; 

            if (timeoutDuration > 0) {
                refreshTimeout = setTimeout(silentRefreshToken, timeoutDuration);
            } else {
                silentRefreshToken();
            }
        }

        return () => {
            if (refreshTimeout) {
                clearTimeout(refreshTimeout);
            }
        };
    }, [state.isAuthenticated, state.expiresAt, silentRefreshToken]);

    // FIX: Implement support for functional updates in setNowPlaying.
    const setNowPlaying = useCallback((update: Partial<NowPlayingState> | ((prevState: NowPlayingState) => Partial<NowPlayingState>)) => {
        setState(s => {
            const updateObj = typeof update === 'function' ? update(s.nowPlaying) : update;
            return { ...s, nowPlaying: { ...s.nowPlaying, ...updateObj } };
        });
    }, []);

    const setSpotifyPlayerInstance = useCallback((player: SpotifyPlayer | null) => {
        setState(s => ({ ...s, spotifyPlayerInstance: player }));
    }, []);

    const pauseSpotify = useCallback(() => {
        if (state.spotifyPlayerInstance) {
            state.spotifyPlayerInstance.pause();
        }
    }, [state.spotifyPlayerInstance]);
    
    const fetchUserInfo = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/me');
            return data;
        } catch (err) {
            console.error('Failed to fetch user info.', err);
            return null;
        }
    }, []);

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
                console.log("No valid session found on load.");
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

    const setDeviceId = (id: string | null) => {
        setDeviceIdState(id);
    };

    const play = useCallback(async (options: PlayOptions) => {
        if (!deviceId) {
            console.error("Cannot play: No active Spotify device ID.");
            return;
        }
        try {
            const body: { context_uri?: string; uris?: string[]; offset?: any; } = {};

            if (options.context_uri) {
                body.context_uri = options.context_uri;
                if (options.offset) {
                    body.offset = options.offset;
                }
            } else if (options.uris) {
                body.uris = options.uris;
                if (options.offset) {
                    body.offset = options.offset;
                }
            } else {
                console.error("Play function called without context_uri or uris.");
                return;
            }

            await apiClient.put(
                `/me/player/play?device_id=${deviceId}`,
                body
            );
            refreshHomePage();
        } catch (err) {
            console.error('Failed to start playback', err);
        }
    }, [deviceId, refreshHomePage]);

    const clearError = () => {
        setState(s => ({...s, error: null}));
    };

    return (
    <AuthContext.Provider value={{ ...state, login, logout, clearError, play, setDeviceId, refreshTrigger, setNowPlaying, setSpotifyPlayerInstance, pauseSpotify, setVolume, toggleMute, silentRefreshToken }}>
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