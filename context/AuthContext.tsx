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
    // FIX: Add youTubeFavorites and onToggleYouTubeFavorite to the context type to support
    // favoriting YouTube playlists.
    youTubeFavorites: string[];
    onToggleYouTubeFavorite: (playlistId: string) => void;
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
    // FIX: Add state and logic for managing favorite YouTube playlists.
    // This includes loading from and saving to localStorage.
    const [youTubeFavorites, setYouTubeFavorites] = useState<string[]>([]);

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
                console.log(`Spotify token refresh scheduled in ${Math.round(timeoutDuration / 60000)} minutes.`);
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
            // If another source is active, just update spotify in background
            if (s.source !== 'spotify' && s.source !== null) {
                return { ...s, spotifyState: newState };
            }

            // `isLoading` is set to true when play() is called.
            // We only turn it off here once we get a valid track state.
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

    const startSpotifyPlayback = useCallback(async () => {
        if (!deviceId) {
            console.warn("Attempted to start Spotify playback, but deviceId is not ready.");
            return;
        }

        console.log("Executing start/sync Spotify playback logic for session restore.");
        try {
            await apiClient.put('/me/player', {
                device_ids: [deviceId],
                play: false,
            });
            console.log('Playback transferred to this device for session restore.');

            setTimeout(async () => {
                try {
                    const { data: playerState } = await apiClient.get('/me/player');
                    if (playerState && playerState.device && playerState.item) {
                        await apiClient.put(`/me/player/play?device_id=${deviceId}`);
                        console.log('Explicit play command sent to resume restored session.');
                    } else {
                        console.log("No active playback session found on Spotify's side to resume.");
                    }
                } catch (e: any) {
                    if (e.response?.status !== 404) {
                        console.error("Error during resync play command", e);
                    } else {
                        console.log("No active playback session found on Spotify's side to resume (404).");
                    }
                }
            }, 500);
        } catch (error: any) {
            if (error.response && (error.response.status === 404 || error.response.status === 403)) {
                console.log("No active session to transfer. Player is ready for new playback.");
            } else {
                console.error("Error during startup and synchronization:", error.response?.data || error.message);
            }
        }
    }, [deviceId]);

    // NEW session restore useEffect, triggered by the semaphore
    useEffect(() => {
        if (!isReadyForAutoplay) {
            return;
        }

        console.log("Player is ready. Attempting to restore last session...");
        
        try {
            const savedStateJSON = localStorage.getItem('last_now_playing');
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON) as NowPlayingState;
                console.log("Found saved session:", savedState);

                if (savedState.source === 'spotify') {
                    console.log("Last session was Spotify. Triggering playback.");
                    startSpotifyPlayback();
                } else if (savedState.source === 'radio' || savedState.source === 'youtube') {
                    console.log(`Last session was ${savedState.source}. Setting state for autoplay.`);
                    setNowPlaying(savedState);
                }
            } else {
                 console.log("No saved session found in localStorage.");
            }
        } catch (error) {
            console.error("Failed to restore session from localStorage:", error);
            localStorage.removeItem('last_now_playing');
        }
    }, [isReadyForAutoplay, startSpotifyPlayback]);

    // Save nowPlaying state to localStorage whenever it changes
    useEffect(() => {
      if (nowPlaying.source) {
        if (nowPlaying.source === 'spotify' && !nowPlaying.spotifyState?.track_window.current_track) {
            return;
        }
        if (nowPlaying.source === 'youtube' && !nowPlaying.youtubeTrack) {
            return;
        }
        try {
          localStorage.setItem('last_now_playing', JSON.stringify(nowPlaying));
        } catch (e) {
            console.error("Failed to save session state to localStorage", e);
        }
      }
    }, [nowPlaying]);

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
                // The login function now only handles setting the authentication state.
                // A separate useEffect will react to this change to manage playback source.
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

    // When the user logs in to Spotify, stop any radio playback and activate Spotify.
    useEffect(() => {
      // This effect runs when the user becomes authenticated and we have a device ID.
      if (state.isAuthenticated && deviceId && state.accessToken) {
        console.log("[AuthContext] Spotify authenticated, device ready. Switching source and transferring playback.");
    
        // Stop any radio playback by switching the active source to Spotify.
        // The MusicPlayer component will see this change and tear down the radio stream.
        setNowPlaying(prev => {
            // Prevent re-triggering if the source is already spotify
            if (prev.source === 'spotify' && !prev.radioStation && !prev.youtubeTrack) {
                return prev;
            }
            return {
                ...prev,
                source: 'spotify',
                radioStation: null, // Explicitly clear radio station
                radioContext: [],
                youtubeTrack: null,
                isLoading: true, // Indicate that Spotify is syncing
            };
        });
    
        // Attempt to transfer playback to this device.
        apiClient.put("/me/player", {
          device_ids: [deviceId],
          play: false // Set to false to prevent race conditions. Let user or session restore initiate play.
        })
        .then(response => {
            // A 204 No Content is a success for this endpoint.
            if (response.status === 204) {
              console.log(`[AuthContext] Playback transfer successful to device ${deviceId}.`);
            } else {
              console.warn(`[AuthContext] Playback transfer responded with status: ${response.status}.`);
            }
        })
        .catch(e => {
            const errorData = e.response?.data?.error;
            // Gracefully handle common, non-critical errors.
            if (errorData && (errorData.reason === 'NO_ACTIVE_DEVICE' || errorData.reason === 'PREMIUM_REQUIRED')) {
                 console.log(`[AuthContext] Playback transfer not needed or possible: ${errorData.reason}`);
            } else {
                console.error("Error transferring playback:", e.response?.data || e.message);
            }
        });
      }
    // We depend on isAuthenticated, deviceId, and accessToken to ensure this runs at the right time.
    }, [state.isAuthenticated, deviceId, state.accessToken]);
    
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

        // Only show loader if we aren't already playing Spotify.
        const showLoader = nowPlaying.source !== 'spotify' || !nowPlaying.spotifyState || nowPlaying.spotifyState.paused;

        // Set loading state but preserve current track info to prevent UI flicker.
        setNowPlaying(prev => ({
            ...prev,
            source: 'spotify',
            radioStation: null,
            radioContext: [],
            youtubeTrack: null,
            isLoading: showLoader,
        }));
        
        try {
            const body: { context_uri?: string; uris?: string[]; offset?: any; } = {};

            if (options.context_uri) {
                body.context_uri = options.context_uri;
                if (options.offset) body.offset = options.offset;
            } else if (options.uris) {
                body.uris = options.uris;
                if (options.offset) body.offset = options.offset;
            } else {
                 // If no URI is provided, it's just a "play" command for the current track.
            }

            await apiClient.put(
                `/me/player/play?device_id=${deviceId}`,
                body
            );
            refreshHomePage();
        } catch (err) {
            console.error('Failed to start playback', err);
            // On failure, just stop the loading indicator.
            setNowPlaying(prev => ({ ...prev, isLoading: false }));
        }
    }, [deviceId, refreshHomePage, nowPlaying.source, nowPlaying.spotifyState]);

    const playYouTube = useCallback((track: YouTubeTrackInfo, playlist?: YouTubeTrackInfo[]) => {
        pauseSpotify();

        // Only show loader if we aren't already playing a YouTube video.
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