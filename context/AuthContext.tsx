

import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import axios from 'axios';

interface SpotifyUser {
    display_name: string;
    images?: { url: string }[];
    id: string;
}

interface PlayOptions {
    context_uri?: string;
    uris?: string[];
    offset?: {
        position?: number;
        uri?: string;
    };
}

interface AuthState {
    accessToken: string | null;
    user: SpotifyUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;
    player: SpotifyPlayer | null;
    deviceId: string | null;
    playerState: SpotifyPlayerState | null;
}

interface AuthContextType extends AuthState {
    login: (authCode?: string | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const initialState: AuthState = {
    accessToken: null,
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
    player: null,
    deviceId: null,
    playerState: null,
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [state, setState] = useState<AuthState>(initialState);
    const playerRef = useRef<SpotifyPlayer | null>(null);

    const logout = useCallback(() => {
        if (playerRef.current) {
            playerRef.current.disconnect();
            playerRef.current = null;
        }
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_expires_in');
        setState(initialState);
        setState(s => ({...s, isLoading: false}));
    }, []);
    
    const fetchUserInfo = useCallback(async (token: string) => {
        try {
            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            return data;
        } catch (err) {
            console.error('Failed to fetch user info', err);
            logout();
            return null;
        }
    }, [logout]);
    
    // Effect to initialize based on localStorage
    useEffect(() => {
        const token = localStorage.getItem('spotify_access_token');
        const expires = localStorage.getItem('spotify_expires_in');
        
        if (token && expires && Date.now() < Number(expires)) {
            setState(s => ({...s, isLoading: true, accessToken: token }));
            fetchUserInfo(token).then(userData => {
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

    // Effect to initialize Spotify Player SDK
    useEffect(() => {
        if (!state.accessToken || playerRef.current) return;

        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'Tesla Infotainment',
                getOAuthToken: cb => { cb(state.accessToken!); },
                volume: 0.5
            });

            player.on('ready', ({ device_id }) => {
                console.log('SDK Ready with Device ID', device_id);
                setState(s => ({ ...s, deviceId: device_id }));
            });

            player.on('not_ready', () => {
                setState(s => ({ ...s, deviceId: null }));
            });

            player.on('player_state_changed', (newState) => {
                setState(s => ({ ...s, playerState: newState }));
            });
            
            player.on('authentication_error', ({ message }) => { console.error('SDK Auth Error:', message); logout(); });

            player.connect();
            playerRef.current = player;
            setState(s => ({ ...s, player }));
        };

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
            // Remove the script to avoid duplicate SDK loads on re-renders
            const existingScript = document.querySelector('script[src="https://sdk.scdn.co/spotify-player.js"]');
            if (existingScript) {
              document.body.removeChild(existingScript);
            }
            (window as any).onSpotifyWebPlaybackSDKReady = undefined;
        };
    }, [state.accessToken, logout]);


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
            const { access_token, expires_in } = response.data;
            const expiresAt = Date.now() + expires_in * 1000;

            localStorage.setItem('spotify_access_token', access_token);
            localStorage.setItem('spotify_expires_in', String(expiresAt));

            const userData = await fetchUserInfo(access_token);
            if (userData) {
                setState(s => ({
                    ...s,
                    accessToken: access_token,
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
            setState(s => ({...s, error: errorMessage, isLoading: false}));
        }
    }, [fetchUserInfo]);

    const play = useCallback(async (options: PlayOptions) => {
        if (!state.deviceId || !state.accessToken) {
            console.error("Player not ready or no access token.");
            return;
        }
        try {
            await axios.put(
                `https://api.spotify.com/v1/me/player/play?device_id=${state.deviceId}`,
                options,
                { headers: { Authorization: `Bearer ${state.accessToken}` } }
            );
        } catch (err) {
            console.error('Failed to start playback', err);
        }
    }, [state.deviceId, state.accessToken]);

    const clearError = () => {
        setState(s => ({...s, error: null}));
    };

    return (
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play }}>
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
