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
    refreshToken: string | null;
    expiresIn: number | null;
    user: SpotifyUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    playerState: SpotifyPlayerState | null;
}

interface AuthContextType extends AuthState {
    login: (authCode?: string | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions) => void;
    setDeviceId: (id: string | null) => void;
    refreshTrigger: number;
    _setPlayerState: (state: SpotifyPlayerState | null) => void;
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
    refreshToken: null,
    expiresIn: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    playerState: null,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>(initialState);
    const [deviceId, setDeviceIdState] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const logout = useCallback(() => {
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_expires_in');
        setState(initialState);
        setState(s => ({...s, isLoading: false}));
    }, []);

    const _setPlayerState = useCallback((newState: SpotifyPlayerState | null) => {
        setState(s => ({ ...s, playerState: newState }));
    }, []);
    
    const fetchUserInfo = useCallback(async () => {
        try {
            const { data } = await apiClient.get('/me');
            return data;
        } catch (err) {
            console.error('Failed to fetch user info. Interceptor will handle logout if necessary.', err);
            return null;
        }
    }, []);

    const refreshHomePage = useCallback(() => {
        // Add a small delay to give Spotify's API time to update "recently played"
        setTimeout(() => {
            setRefreshTrigger(prev => prev + 1);
        }, 1000);
    }, []);
    
    useEffect(() => {
        const token = localStorage.getItem('spotify_access_token');
        const expires = localStorage.getItem('spotify_expires_in');
        
        if (token && expires && Date.now() < Number(expires)) {
            setState(s => ({...s, isLoading: true, accessToken: token, refreshToken: localStorage.getItem('spotify_refresh_token')}));
            fetchUserInfo().then(userData => {
                if (userData) {
                    setState(s => ({...s, user: userData, isAuthenticated: true, isLoading: false}));
                } else {
                    setState(s => ({...s, isLoading: false}));
                }
            });
        } else {
            setState(s => ({...s, isLoading: false}));
        }
    }, [fetchUserInfo]);

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
            const response = await axios.post('http://localhost:8888/api/exchange-token', { code: authCode });
            const { access_token, refresh_token, expires_in } = response.data;
            const expiresAt = Date.now() + expires_in * 1000;

            localStorage.setItem('spotify_access_token', access_token);
            localStorage.setItem('spotify_refresh_token', refresh_token);
            localStorage.setItem('spotify_expires_in', String(expiresAt));

            const userData = await fetchUserInfo();
            if (userData) {
                setState(s => ({
                    ...s,
                    accessToken: access_token,
                    refreshToken: refresh_token,
                    expiresIn: expiresAt,
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
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play, setDeviceId, refreshTrigger, _setPlayerState }}>
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