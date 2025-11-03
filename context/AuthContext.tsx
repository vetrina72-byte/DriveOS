
import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import apiClient from '../api';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
import { NowPlayingState, YouTubeTrackInfo } from '../types';
import { getSessionId } from '../lib/sessionId';
import { initSpotifyPlayerOnce, setVolumeDebounced, safePlay, getPlayerInstance, getDeviceId } from '../lib/spotify-player';

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

export interface PlayOptions {
    uris?: string[];
    context_uri?: string;
    offset?: {
        position?: number;
        uri?: string;
    };
    position_ms?: number;
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
    play: (options: PlayOptions) => void;
    playYouTube: (track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => void;
    refreshTrigger: number;
    _setPlayerState: (state: SpotifyPlayerState | null) => void;
    setVolume: (level: number) => void;
    toggleMute: () => void;
    nowPlaying: NowPlayingState;
    setNowPlaying: React.Dispatch<React.SetStateAction<NowPlayingState>>;
    isPlayerReady: boolean;
    pauseSpotify: () => void;
    youTubeFavorites: string[];
    onToggleYouTubeFavorite: (playlistId: string) => void;
    isAutoplayBlocked: boolean;
    unlockAutoplay: () => void;
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
    
    const sessionIdRef = useRef<string>(getSessionId());
    const refreshTimeoutId = useRef<number | null>(null);

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
        
        getPlayerInstance()?.disconnect();

        setState({
            accessToken: null, expiresAt: null, user: null, isAuthenticated: false, isLoading: false,
            error: null, volume: 1, isMuted: false, lastVolume: 1,
        });
    }, []);
    
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        const sessionId = sessionIdRef.current;
        console.log(`🕒 [TOKEN MANAGER] Attempting silent token refresh for session=${sessionId}`);
        if (!sessionId) {
            console.error('🛑 [TOKEN MANAGER] sessionId undefined, cannot refresh');
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
                console.log(`🟢 [TOKEN MANAGER] refresh OK — new token valid until ${new Date(data.expires_at).toLocaleTimeString()}`);
                
                return true;
            }

            if (res.status === 401 || data?.error === 'invalid_grant') {
                console.error('⛔ [TOKEN MANAGER] invalid_grant, forcing re-login');
                logout();
                return false;
            }
            
            console.warn('⚠️ [TOKEN MANAGER] refresh failed', res.status, data);
            return false;
        } catch (err: any) {
            console.error('❌ [TOKEN MANAGER] exception during refresh', err);
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
        
        console.log(`[TOKEN MANAGER] session=${sessionIdRef.current} token valid for ${Math.round(msLeft/1000)}s. Next refresh in ${Math.round(refreshIn/1000)}s.`);
        
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
    
    const play = useCallback(async (options: PlayOptions) => {
        if (options.context_uri) localStorage.setItem("last_context_uri", options.context_uri);
        else if (options.uris?.[0]) {
            localStorage.setItem("last_track_uri", options.uris[0]);
            localStorage.removeItem("last_context_uri");
        }
        localStorage.setItem("last_progress_ms", "0");
        localStorage.setItem("last_is_playing", "true");

        setNowPlaying(prev => ({ ...prev, source: 'spotify', radioStation: null, youtubeTrack: null, isLoading: true }));
        
        const success = await safePlay(options, attemptRefreshAndUpdatePlayerToken);
        if (!success) {
            setNowPlaying(prev => ({ ...prev, isLoading: false }));
        }
        setRefreshTrigger(p => p + 1);
    }, [attemptRefreshAndUpdatePlayerToken]);
    
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
    
    const setVolume = useCallback((rawValue: number) => {
        const clampedVolume = Math.max(0, Math.min(1, rawValue));
        setState(s => ({ ...s, volume: clampedVolume, isMuted: clampedVolume === 0, ...(clampedVolume > 0 && { lastVolume: clampedVolume }) }));
        setVolumeDebounced(clampedVolume);
    }, []);

    const toggleMute = useCallback(() => { setState(s => { const newMuted = !s.isMuted; const newVolume = newMuted ? 0 : (s.lastVolume > 0 ? s.lastVolume : 0.5); setVolume(newVolume); return { ...s, isMuted: newMuted }; }); }, [setVolume]);
    const pauseSpotify = useCallback(async () => { getPlayerInstance()?.pause(); }, []);
    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => { pauseSpotify(); setNowPlaying(prev => ({ ...prev, source: 'youtube', youtubeTrack: track, youtubePlaylist: playlist, radioStation: null, isLoading: prev.source !== 'youtube' })); }, [pauseSpotify]);
    const clearError = useCallback(() => { setState(s => ({...s, error: null})); }, []);
    const unlockAutoplay = useCallback(() => { getPlayerInstance()?.resume().then(() => setAutoplayBlocked(false)).catch(err => console.error("Failed to resume playback:", err)); }, []);
    const isPlayerReady = isPlayerSdkReady && !!getDeviceId();
    
    return (
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play, playYouTube, refreshTrigger, _setPlayerState, setVolume, toggleMute, nowPlaying, setNowPlaying, isPlayerReady, pauseSpotify, youTubeFavorites, onToggleYouTubeFavorite, isAutoplayBlocked, unlockAutoplay }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): Omit<AuthContextType, 'playerRef' | 'setDeviceId'> => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
