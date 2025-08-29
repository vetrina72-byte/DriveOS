import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import axios from 'axios';
import apiClient from '../api';
import type { SpotifyPlayerState } from '@/globals';

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
    isAuthReady: boolean;
    error: string | null;
    playerState: SpotifyPlayerState | null;
    volume: number;
    isMuted: boolean;
    lastVolume: number;
}

interface AuthContextType extends Omit<AuthState, 'lastVolume' | 'refreshToken' | 'expiresIn'> {
    login: (authCode?: string | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions) => void;
    setDeviceId: (id: string | null) => void;
    refreshTrigger: number;
    _setPlayerState: (state: SpotifyPlayerState | null) => void;
    setVolume: (level: number) => void;
    toggleMute: () => void;
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
    isAuthReady: false, // Start as not ready
    error: null,
    playerState: null,
    volume: 1,
    isMuted: false,
    lastVolume: 1,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>(initialState);
    const [deviceId, setDeviceIdState] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const fetchUserInfo = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/me');
            return data;
        } catch (err) {
            console.error('Failed to fetch user info.', err);
            return null;
        }
    }, []);

    const logout = useCallback(() => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_expires_at');
        axios.post('/api/logout', {}, { withCredentials: true }).catch(err => {
            console.error("Logout API call failed:", err);
        });
        // On manual logout, reset isAuthReady to false. The app is no longer
        // in a "ready" state for authenticated actions. This allows a subsequent
        // login to correctly trigger effects that depend on isAuthReady changing state.
        setState({
            ...initialState,
            isLoading: false,
            isAuthReady: false,
        });
    }, []);

    const silentRefreshToken = useCallback(async () => {
        console.log("Proactively refreshing Spotify token...");
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
                isAuthReady: true, // Re-affirm auth is ready
            }));
            console.log("Token proactively refreshed.");
        } catch (err) {
            console.error("Silent token refresh failed. Logging out.", err);
            logout(); // If silent refresh fails, the session is likely invalid.
        }
    }, [logout]);
    
    useEffect(() => {
        let refreshTimeout: ReturnType<typeof setTimeout>;

        if (state.isAuthenticated && state.expiresAt) {
            const now = Date.now();
            const timeoutDuration = state.expiresAt - now - 120000; // Refresh 2 minutes before expiry

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

    // Centralized function to determine auth status on initial load.
    const initializeAuth = useCallback(async () => {
        console.log("Initializing authentication...");
        try {
            // Attempt to refresh the token using the HttpOnly cookie.
            // This is the single source of truth for an existing session.
            const { data } = await axios.post('/api/refresh-token', {}, { withCredentials: true });
            const { access_token, expires_in } = data;
            const expiresAt = Date.now() + expires_in * 1000;
            
            localStorage.setItem('spotify_access_token', access_token);
            localStorage.setItem('spotify_expires_at', String(expiresAt));
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            
            const user = await fetchUserInfo();
            if (!user) throw new Error("Failed to fetch user info after token refresh.");

            // SUCCESS: We have a valid token and user. Auth is ready and authenticated.
            setState(s => ({
                ...s, 
                accessToken: access_token, 
                expiresAt, 
                user, 
                isAuthenticated: true, 
                isAuthReady: true, // CRITICAL: Signal readiness
                isLoading: false 
            }));
            console.log("Authentication successful.");

        } catch (err) {
            console.log("No valid session found on load. Setting to logged-out state.");
            // FAILURE: No valid session. Auth state is now resolved.
            // We are "ready" but not authenticated.
            localStorage.removeItem('spotify_access_token');
            localStorage.removeItem('spotify_expires_at');
            setState({
                ...initialState,
                isLoading: false,
                isAuthReady: true, // CRITICAL: Signal readiness (state is known)
                isAuthenticated: false,
            });
        }
    }, [fetchUserInfo]);

    // This effect runs ONLY ONCE when the AuthProvider is mounted.
    useEffect(() => {
        initializeAuth();
    }, [initializeAuth]);


    const _setPlayerState = useCallback((newState: SpotifyPlayerState | null) => {
        setState(s => ({ ...s, playerState: newState }));
    }, []);
    
    const login = useCallback(async (authCode?: string | null, authError?: string) => {
        setState(s => ({ ...s, isLoading: true, error: null, isAuthReady: false }));

        if (authError) {
             setState(s => ({...s, error: authError, isLoading: false, isAuthReady: true}));
             return;
        }

        if (!authCode) {
            setState(s => ({...s, error: 'Authorization code is missing.', isLoading: false, isAuthReady: true}));
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
                    isAuthReady: true, // Auth is now ready after successful login
                }));
            } else {
                 throw new Error("Failed to fetch user info after login.");
            }
        } catch (err: any) {
            console.error('Login process failed:', err);
            const errorMessage = err.response?.data?.details?.error_description || 'Failed to complete login.';
            setState({
                ...initialState,
                isLoading: false,
                isAuthReady: true, // Auth state is determined (failed), so it's ready.
                error: errorMessage,
            });
        }
    }, [fetchUserInfo]);
    
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
            // After successfully starting playback, trigger a refresh for the home page.
            refreshHomePage();
        } catch (err) {
            console.error('Failed to start playback', err);
        }
    }, [deviceId, refreshHomePage]);

    const clearError = () => {
        setState(s => ({...s, error: null}));
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play, setDeviceId, refreshTrigger, _setPlayerState, setVolume, toggleMute }}>
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
