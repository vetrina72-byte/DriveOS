
import React, { createContext, useState, useEffect, useContext, useCallback, ReactNode, useRef } from 'react';
import apiClient from '../api';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';
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

interface TokenData {
    access_token: string;
    expires_in: number;
    expires_at?: number;
}

interface AuthContextType extends Omit<AuthState, 'lastVolume' | 'refreshToken' | 'expiresIn'> {
    login: (tokenData?: TokenData | null, error?: string) => Promise<void>;
    logout: () => void;
    clearError: () => void;
    play: (options: PlayOptions) => void;
    playYouTube: (track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => void;
    setDeviceId: (id: string | null) => void;
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
    playerRef: React.RefObject<SpotifyPlayer | null>;
    isAutoplayBlocked: boolean;
    unlockAutoplay: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getSessionId = () => {
    let sid = localStorage.getItem('spotify_session_id');
    if (!sid) {
        sid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
        localStorage.setItem('spotify_session_id', sid);
    }
    return sid;
};

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
    const [deviceId, setDeviceIdState] = useState<string | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [nowPlaying, setNowPlaying] = useState<NowPlayingState>({
        source: null, spotifyState: null, radioStation: null, radioContext: [], youtubeTrack: null, isLoading: false,
    });
    const [youTubeFavorites, setYouTubeFavorites] = useState<string[]>([]);
    const [isAutoplayBlocked, setAutoplayBlocked] = useState(false);
    
    const sessionIdRef = useRef<string>(getSessionId());
    const refreshTimeoutId = useRef<number | null>(null);
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const restorePlaybackAttempted = useRef<boolean>(false);
    
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
        
        setState({
            accessToken: null, expiresAt: null, user: null, isAuthenticated: false, isLoading: false,
            error: null, volume: 1, isMuted: false, lastVolume: 1,
        });
    }, []);
    
    const attemptRefreshAndUpdatePlayerToken = useCallback(async (): Promise<boolean> => {
        const sessionId = sessionIdRef.current;
        console.log('🕒 [TOKEN MANAGER] Attempting silent token refresh...', { sessionId });
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
            console.log('[AUTH] /api/refresh-token response', res.status, data);

            if (res.status === 200 && data.access_token) {
                localStorage.setItem('accessToken', data.access_token);
                localStorage.setItem('expiresAt', String(data.expires_at));
                
                setState(s => ({ ...s, accessToken: data.access_token, expiresAt: data.expires_at, isAuthenticated: true }));
                console.log(`🟢 [TOKEN MANAGER] Nuovo access token valido fino a ${new Date(data.expires_at).toLocaleTimeString()}`);
                
                // This is the critical part for the SDK
                const player = playerRef.current;
                if (player && player._options) {
                    await player.connect();
                    console.log('✅ [AUTH] Player re-connected with new token.');
                }
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
            if (localStorage.getItem('accessToken')) { // If we have a token but it's expired
                attemptRefreshAndUpdatePlayerToken();
            }
            return;
        }

        const msLeft = expiresAt - Date.now();
        const refreshIn = Math.max(msLeft - 60000, 5000); // 60s before expiry, or 5s from now if sooner
        
        console.log(`[TOKEN MANAGER] session=${sessionIdRef.current} token valido ancora per ${Math.round(msLeft/1000)}s. Next refresh in ${Math.round(refreshIn/1000)}s.`);
        
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
                    logout(); // Token is invalid if we can't get user
                }
            } else {
                setState(s => ({ ...s, isLoading: false }));
            }
        };
        initFromStorage();
    }, [fetchUserInfo, logout]);

    const login = useCallback(async (tokenData?: TokenData | null, authError?: string) => {
        restorePlaybackAttempted.current = false;
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
        const sessionId = sessionIdRef.current;
        if (!deviceId) { console.error("Cannot play: No active Spotify device ID."); return; }

        if (options.context_uri) localStorage.setItem("last_context_uri", options.context_uri);
        else if (options.uris?.[0]) {
            localStorage.setItem("last_track_uri", options.uris[0]);
            localStorage.removeItem("last_context_uri");
        }
        localStorage.setItem("last_progress_ms", "0");
        localStorage.setItem("last_is_playing", "true");

        setNowPlaying(prev => ({ ...prev, source: 'spotify', radioStation: null, youtubeTrack: null, isLoading: true }));
        
        const body: PlayOptions = {};
        if (options.context_uri) body.context_uri = options.context_uri;
        if (options.uris) body.uris = options.uris;
        if (options.offset) body.offset = options.offset;
        if (options.position_ms) body.position_ms = options.position_ms;

        const tryPlay = async () => fetch('/api/play', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'x-session-id': sessionId },
            body: JSON.stringify({ deviceId, body })
        });

        let response = await tryPlay();

        if (response.status === 401) {
            console.warn('🔁 [PLAY-WRAPPER] 401 -> tentando refresh');
            const refreshed = await attemptRefreshAndUpdatePlayerToken();
            if (refreshed) {
                console.log('🔁 [PLAY-WRAPPER] retrying play after refresh');
                response = await tryPlay();
            } else {
                console.error('⛔ [PLAY-WRAPPER] Refresh failed, cannot retry play.');
                setNowPlaying(prev => ({ ...prev, isLoading: false }));
                return; 
            }
        }
        
        if (!response.ok) {
            const bodyJson = await response.json().catch(()=>({}));
            console.error(`[PLAY-WRAPPER] Play failed with status ${response.status}`, bodyJson);
            if (response.status === 404) console.error('[PLAY] 404 - possibile no active device', bodyJson);
            setNowPlaying(prev => ({ ...prev, isLoading: false }));
        }
        setRefreshTrigger(p => p + 1);
    }, [deviceId, attemptRefreshAndUpdatePlayerToken]);
    
    useEffect(() => {
        if (!state.accessToken) {
            if (playerRef.current) { playerRef.current.disconnect(); playerRef.current = null; }
            setNowPlaying(s => ({...s, spotifyState: null})); setDeviceIdState(null);
            return;
        }

        const scriptId = 'spotify-sdk';
        if (document.getElementById(scriptId) && window.Spotify && !playerRef.current) {
            window.onSpotifyWebPlaybackSDKReady(); return;
        } else if (playerRef.current) return;

        const script = document.createElement('script');
        script.id = scriptId; script.src = 'https://sdk.scdn.co/spotify-player.js'; script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
             if (playerRef.current) return;
             
             const player = new window.Spotify.Player({
                 name: 'Mio Infotainment',
                 getOAuthToken: cb => {
                    const token = localStorage.getItem('accessToken') || '';
                    cb(token);
                 },
                 volume: state.volume
             });
     
            player.addListener('ready', ({ device_id }) => {
                console.log('[Spotify SDK] Ready device_id', device_id);
                setDeviceIdState(device_id);
            });
            player.addListener('not_ready', ({ device_id }) => {
                console.log('[Spotify SDK] Not ready', device_id);
                setDeviceIdState(null);
            });
            player.addListener('player_state_changed', (s) => _setPlayerState(s));
            
            player.addListener('initialization_error', ({ message }) => { console.error('Spotify Player initialization_error', message); });
            player.addListener('authentication_error', async ({ message }) => {
              console.warn('📣 [PLAYER EVENT] authentication_error', message);
              console.log('📣 [PLAYER EVENT] Provando refresh token invece di logout immediato...');
              const ok = await attemptRefreshAndUpdatePlayerToken();
              if (ok) {
                console.log('✅ [PLAYER EVENT] Refresh riuscito, il player si è riconnesso.');
              } else {
                console.error('⛔ [PLAYER EVENT] refresh fallito -> forzo re-login (QR)');
                logout();
              }
            });
            player.addListener('account_error', ({ message }) => { console.error('Spotify Player account_error', message); });
            player.addListener('playback_error', ({ message }) => {
                console.error('Spotify Player playback_error', message);
                if (message.includes('autoplay') || message.includes('NotAllowedError')) setAutoplayBlocked(true);
            });
     
            player.connect().then(success => { if (success) console.log("[Spotify SDK] The Web Playback SDK successfully connected!"); });
            playerRef.current = player;
         };
        
        return () => { if (playerRef.current) { playerRef.current.disconnect(); playerRef.current = null; } }
    }, [state.accessToken, logout, state.volume, _setPlayerState, attemptRefreshAndUpdatePlayerToken]);
    
    const setVolume = useCallback((level: number) => {
        const newVolume = Math.max(0, Math.min(1, level));
        playerRef.current?.setVolume(newVolume).catch(err => console.warn("Failed to set volume on SDK.", err));
        setState(s => ({ ...s, volume: newVolume, isMuted: newVolume === 0, ...(newVolume > 0 && { lastVolume: newVolume }) }));
    }, []);
    const toggleMute = useCallback(() => { setState(s => { const newMuted = !s.isMuted; const newVolume = newMuted ? 0 : (s.lastVolume > 0 ? s.lastVolume : 0.5); playerRef.current?.setVolume(newVolume).catch(err => console.warn("Failed to set volume on SDK.", err)); return { ...s, volume: newVolume, isMuted: newMuted }; }); }, []);
    const pauseSpotify = useCallback(async () => { playerRef.current?.pause(); }, []);
    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => { pauseSpotify(); setNowPlaying(prev => ({ ...prev, source: 'youtube', youtubeTrack: track, youtubePlaylist: playlist, radioStation: null, isLoading: prev.source !== 'youtube' })); }, [pauseSpotify]);
    const clearError = useCallback(() => { setState(s => ({...s, error: null})); }, []);
    const unlockAutoplay = useCallback(() => { playerRef.current?.resume().then(() => setAutoplayBlocked(false)).catch(err => console.error("Failed to resume playback:", err)); }, []);
    const isPlayerReady = !!deviceId;
    
    return (
        <AuthContext.Provider value={{ ...state, login, logout, clearError, play, playYouTube, setDeviceId: setDeviceIdState, refreshTrigger, _setPlayerState, setVolume, toggleMute, nowPlaying, setNowPlaying, isPlayerReady, pauseSpotify, youTubeFavorites, onToggleYouTubeFavorite, playerRef, isAutoplayBlocked, unlockAutoplay }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
