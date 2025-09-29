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

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

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
    
    // Refs for playback restoration
    const restorePlaybackAttempted = useRef<boolean>(false);

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
        // Clear playback state on logout
        localStorage.removeItem('last_context_uri');
        localStorage.removeItem('last_track_uri');
        localStorage.removeItem('last_progress_ms');
        localStorage.removeItem('last_is_playing');
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
          throw err;
        } finally {
          refreshInFlight.current = null;
        }
      })();
      refreshInFlight.current = promise;
      return promise;
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

        if (newState) {
            localStorage.setItem("last_is_playing", String(!newState.paused));
            localStorage.setItem("last_progress_ms", String(newState.position));
            if (newState.track_window.current_track) {
                localStorage.setItem("last_track_uri", newState.track_window.current_track.uri);
            }
            if (newState.context && newState.context.uri) {
                localStorage.setItem("last_context_uri", newState.context.uri);
            } else {
                localStorage.removeItem("last_context_uri");
            }
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
        const initAuth = async () => {
          try {
            const { data } = await axios.post('/api/refresh-token', {}, { withCredentials: true });
            const { access_token, expires_in } = data;
            const expiresAt = Date.now() + expires_in * 1000;
        
            localStorage.setItem('spotify_access_token', access_token);
            localStorage.setItem('spotify_expires_at', String(expiresAt));
            apiClient.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
        
            const user = await fetchUserInfo();
            if (!user) {
              throw new Error("Failed to fetch user info after token refresh.");
            }
        
            setState(s => ({ ...s, accessToken: access_token, expiresAt, user, isAuthenticated: true }));
          } catch (err) {
            console.log("No valid session found on load.");
            logout();
          } finally {
            setState(s => ({ ...s, isLoading: false }));
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
    
        if (options.context_uri) {
            localStorage.setItem("last_context_uri", options.context_uri);
            if (options.offset?.uri) {
                localStorage.setItem("last_track_uri", options.offset.uri);
            } else {
                localStorage.removeItem("last_track_uri");
            }
        } else if (options.uris?.[0]) {
            localStorage.setItem("last_track_uri", options.uris[0]);
            localStorage.removeItem("last_context_uri");
        }
    
        localStorage.setItem("last_progress_ms", "0");
        localStorage.setItem("last_is_playing", "true");

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
    
    const playerRef = useRef<any>(null);
    const tokenRef = useRef<string | null>(state.accessToken);
    useEffect(() => { tokenRef.current = state.accessToken; }, [state.accessToken]);
    
    useEffect(() => {
        if (!state.accessToken) {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
            setNowPlaying(s => ({...s, spotifyState: null}));
            setDeviceIdState(null);
            return;
        }

        const scriptId = 'spotify-sdk';
        if (document.getElementById(scriptId)) {
            if (!playerRef.current && window.Spotify) {
                 window.onSpotifyWebPlaybackSDKReady();
            }
            return;
        }

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
             if (playerRef.current || !tokenRef.current) return;
     
             const player = new window.Spotify.Player({
                 name: 'Mio Infotainment',
                 getOAuthToken: cb => {
                    if (tokenRef.current) cb(tokenRef.current);
                 },
                 volume: state.volume
             });
     
            player.on('ready', async ({ device_id }) => {
                console.log('%c[Spotify SDK] Ready! Device ID:', 'color: lime; font-weight: bold', device_id);
                await player.activateElement();
                setDeviceIdState(device_id);
                setPlayerAsReadyForAutoplay();

                if (restorePlaybackAttempted.current) {
                    console.log("[AuthContext] Playback restoration already attempted for this session.");
                    return;
                }
                restorePlaybackAttempted.current = true;
                
                try {
                    let playerState: any = null;
                    // Make a single attempt to get the current player state from Spotify's API
                    try {
                        const { data, status } = await apiClient.get('/me/player');
                        if (status === 200 && data && data.item) {
                            playerState = data;
                        }
                    } catch (e: any) {
                        // A 404 or 204 is expected if nothing is playing anywhere. Don't log it as an error.
                        if (e.response?.status !== 404 && e.response?.status !== 204) {
                           console.error("Error fetching player state:", e.response?.data || e.message);
                        }
                        playerState = null;
                    }

                    // If an active session is found on another device, transfer it.
                    if (playerState) {
                        console.log("[AuthContext] Active session found on another device. Transferring playback.");
                        
                        await apiClient.put('/me/player', {
                            device_ids: [device_id],
                            play: playerState.is_playing
                        });
                        
                        console.log("[AuthContext] Playback transferred successfully.");
                        
                    } else {
                        // If no active session, do nothing. The player will wait for user interaction.
                        console.log("[AuthContext] No active session found on Spotify. Player is ready and waiting for user input.");
                    }
                } catch (err: any) {
                    // This will catch errors from the PUT/transfer calls
                    console.error("[AuthContext] Error during playback restoration/transfer:", err.response?.data || err.message);
                }
            });
     
             player.on('not_ready', ({ device_id }) => {
                 console.warn('[Spotify SDK] Device has gone offline', device_id);
                 setDeviceIdState(null);
             });
             
             player.on('player_state_changed', (playerState) => {
                 _setPlayerState(playerState);
                 player.getVolume().then(sdkVolume => {
                     if (typeof sdkVolume === 'number' && sdkVolume !== state.volume) {
                         setVolume(sdkVolume);
                     }
                 });
             });
     
            player.on('authentication_error', async (error: { message: string }) => {
              console.warn("Spotify authentication_error:", error.message, "Attempting refresh...");
              try {
                await silentRefreshToken();
              } catch (e) {
                console.error("Refresh failed after authentication_error. Logging out.", e);
                logout();
              }
            });

            player.on('account_error', (error) => console.error("Spotify account error:", error.message));
            player.on('initialization_error', (error) => console.error("Spotify initialization error:", error.message));
     
            player.connect().then(success => {
                if (success) {
                    console.log("[Spotify SDK] The Web Playback SDK successfully connected to Spotify!");
                }
            });
            playerRef.current = player;
         };
        
        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
        }
    }, [state.accessToken, state.volume, logout, setVolume, _setPlayerState, silentRefreshToken, setPlayerAsReadyForAutoplay]);

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