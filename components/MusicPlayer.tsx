import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiRadio
} from 'react-icons/fi';
import { 
    IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp, IoPlaySkipForwardSharp
} from 'react-icons/io5';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { BsList } from 'react-icons/bs';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';
import type { RadioStation, YouTubeTrackInfo } from '../types';

interface MusicPlayerProps {
    isAnyAppOpen: boolean;
    isNight: boolean;
    dockedConfig: { width: number; bottom: number; left: number; height: number; };
    floatingConfig: { width: number; bottom: number; height: number; otherWidgetWidth: number; };
    playerControlsSize: number;
    playerControlsGap: number;
    playerControlsVerticalPosition: number;
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    onStationChange: (direction: 'next' | 'prev') => void;
    activeApp: string | null;
    favoriteStationUUIDs: string[];
    onToggleFavorite: (station: RadioStation) => void;
}

type PlayerStatus = 'connecting' | 'ready' | 'error';

/**
 * A seekable progress bar for the Spotify player with smooth, real-time updates.
 * This component uses `requestAnimationFrame` to interpolate the track's progress between
 * official state updates from the Spotify SDK, providing a fluid user experience. It also
 * handles user seeking (clicking and dragging) and displays a loading indicator.
 * 
 * @param {SpotifyPlayer | null} player - The Spotify Web Playback SDK player instance.
 * @param {SpotifyPlayerState} state - The current player state from the SDK.
 * @param {boolean} isLoading - A flag from the AuthContext indicating if a track is being loaded.
 * @param {boolean} isNight - A flag to determine which theme (light/dark) to apply to the loading spinner.
 */
const SpotifyProgressBar = ({ player, state, isLoading, isNight }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, isLoading: boolean, isNight: boolean }) => {
    // 'position' holds the locally animated progress in milliseconds for a smooth display.
    const [position, setPosition] = useState(state.position);
    // 'isSeeking' is a flag to prevent animation while the user is dragging the progress handle.
    const [isSeeking, setIsSeeking] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef(0);
    const lastStateUpdate = useRef(performance.now());
    const justSoughtRef = useRef(false); // Ref to ignore first state update after seeking

    // Effect to synchronize the local animated position with the actual state from Spotify.
    useEffect(() => {
        // If we just finished a seek, ignore the next state update because it might be stale.
        if (justSoughtRef.current) {
            return;
        }
        if (!isSeeking) {
            setPosition(state.position);
            lastStateUpdate.current = performance.now();
        }
    }, [state.position, isSeeking]);

    // This effect creates the smooth animation loop using requestAnimationFrame.
    useEffect(() => {
        // Stop the animation if the track is paused or the user is seeking.
        if (state.paused || isSeeking) {
            cancelAnimationFrame(animationFrameRef.current);
            return;
        }

        const animate = () => {
            // Calculate how much time has passed since the last real update from Spotify.
            const elapsed = performance.now() - lastStateUpdate.current;
            // Predict the new position by adding the elapsed time to the last known position.
            const newPosition = state.position + elapsed;
            
            // Update the visual progress, ensuring it doesn't exceed the track's duration.
            if (newPosition < state.duration) {
                setPosition(newPosition);
                // Request the next frame to continue the animation.
                animationFrameRef.current = requestAnimationFrame(animate);
            } else {
                setPosition(state.duration);
            }
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        // Cleanup function to cancel the animation frame when the component unmounts or dependencies change.
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [state.paused, state.duration, state.position, isSeeking]);

    // Callback to handle user interaction (mousedown and drag) for seeking.
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !player) return;
        
        // Immediately stop the animation loop.
        setIsSeeking(true);
        if (justSoughtRef.current) {
            justSoughtRef.current = false; // Clear any lingering seek flags
        }
        
        // Helper function to calculate the seek position in milliseconds from a mouse coordinate.
        const getSeekPosition = (clientX: number): number => {
            if (!progressRef.current) return 0;
            const rect = progressRef.current.getBoundingClientRect();
            // Calculate the click position as a ratio (0.0 to 1.0) along the bar's width.
            const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
            return Math.round(state.duration * ratio);
        };
        
        // Update the visual position instantly for immediate feedback.
        setPosition(getSeekPosition(e.clientX));

        const handleMouseMove = (moveEvent: MouseEvent) => {
            // Update the visual position as the user drags the mouse.
            setPosition(getSeekPosition(moveEvent.clientX));
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            // Remove the global listeners when the user releases the mouse.
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            // Calculate the final position and send the 'seek' command to the Spotify player.
            const finalPosition = getSeekPosition(upEvent.clientX);
            player.seek(finalPosition).then(() => {
                // Once the seek is confirmed, sync our local state and re-enable animations.
                setPosition(finalPosition);
                setIsSeeking(false);
                // Flag that we just sought and should ignore the next state update.
                justSoughtRef.current = true;
                // After a short delay, reset the flag to resume normal syncing.
                setTimeout(() => {
                    justSoughtRef.current = false;
                }, 300); // 300ms should be enough for state to propagate.
            });
        };
        
        // Add listeners to the window to track mouse movement anywhere on the screen.
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [player, state.duration]);
    
    const progressPercentage = state.duration > 0 ? (position / state.duration) * 100 : 0;
    
    return (
        <div
            ref={progressRef}
            className="spotify-progress-bar w-full h-1.5 rounded-full cursor-pointer group relative bg-[var(--progress-bg)]"
            onMouseDown={handleMouseDown}
        >
            <div className="h-full rounded-full bg-[var(--progress-fill)] relative" style={{ width: `${progressPercentage}%` }}>
                 <div 
                    className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-[var(--progress-fill)] opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ transform: 'translateY(-50%)' }} 
                />
            </div>
            {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className={`${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'} w-4 h-4`} />
                </div>
            )}
        </div>
    );
};

const YouTubeProgressBar = ({
    progress,
    isSeeking,
    onSeek,
    onSeekStart,
    onSeekEnd,
}: {
    progress: { position: number; duration: number };
    isSeeking: boolean;
    onSeek: (position: number) => void;
    onSeekStart: () => void;
    onSeekEnd: () => void;
}) => {
    const [localPosition, setLocalPosition] = useState(progress.position);
    const progressRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isSeeking) {
            setLocalPosition(progress.position);
        }
    }, [progress.position, isSeeking]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current) return;
        onSeekStart();

        const getSeekPosition = (clientX: number): number => {
            if (!progressRef.current || !progress.duration) return 0;
            const rect = progressRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
            return progress.duration * ratio;
        };

        const newPos = getSeekPosition(e.clientX);
        setLocalPosition(newPos);
        onSeek(newPos);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const movePos = getSeekPosition(moveEvent.clientX);
            setLocalPosition(movePos);
            onSeek(movePos);
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            onSeekEnd();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [onSeek, onSeekStart, onSeekEnd, progress.duration]);

    const displayPosition = isSeeking ? localPosition : progress.position;
    const progressPercentage = progress.duration > 0 ? (displayPosition / progress.duration) * 100 : 0;

    return (
        <div
            ref={progressRef}
            className="w-full h-1.5 rounded-full cursor-pointer group bg-[var(--progress-bg)]"
            onMouseDown={handleMouseDown}
        >
            <div className="h-full rounded-full bg-[var(--progress-fill)] relative" style={{ width: `${progressPercentage}%` }}>
                <div 
                    className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-[var(--progress-fill)]"
                    style={{ transform: 'translateY(-50%)' }} 
                />
            </div>
        </div>
    );
};


const QueuePopover = ({ isNight, nextTrack, position, onClose, isClosing }: { isNight: boolean, nextTrack: { name: string, description: string, imageUrl: string } | null, position: { bottom: number, left: number, transform: string }, onClose: () => void, isClosing: boolean }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    return ReactDOM.createPortal(
        <div
            ref={popoverRef}
            style={{
                bottom: `${position.bottom}px`,
                left: `${position.left}px`,
                transform: position.transform,
                backgroundColor: 'var(--player-bg)'
            }}
            className={`fixed w-72 p-3 rounded-lg shadow-2xl z-50 border ${isNight ? 'border-zinc-700' : 'border-zinc-200'} ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        >
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--text-secondary)' }}>Prossima in coda</p>
            {nextTrack ? (
                <div className="flex items-center gap-3 min-w-0">
                    <img src={nextTrack.imageUrl} alt={nextTrack.name} className="w-10 h-10 rounded-md flex-shrink-0" />
                    <div className="overflow-hidden">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nextTrack.name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nextTrack.description}</p>
                    </div>
                </div>
            ) : (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nessuna canzone in coda.</p>
            )}
        </div>,
        document.getElementById('scaled-portal-root')!
    );
};

const MusicPlayer: React.FC<MusicPlayerProps> = ({ 
    isAnyAppOpen, 
    isNight, 
    dockedConfig, 
    floatingConfig, 
    playerControlsSize,
    playerControlsGap,
    playerControlsVerticalPosition,
    widgetBgColor,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    onStationChange,
    activeApp,
    favoriteStationUUIDs,
    onToggleFavorite,
}) => {
  const { accessToken, logout, setDeviceId, isAuthenticated, nowPlaying, setNowPlaying, _setPlayerState, volume, setVolume, silentRefreshToken, setPlayerAsReadyForAutoplay, playYouTube } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('connecting');
    const playerContainerRef = useRef<HTMLDivElement>(null);
    
    const [visibleQueue, setVisibleQueue] = useState<'spotify' | 'youtube' | null>(null);
    const [isQueueClosing, setIsQueueClosing] = useState(false);
    
    const [isLiked, setIsLiked] = useState(false);

    const spotifyQueueButtonRef = useRef<HTMLButtonElement>(null);
    const youTubeQueueButtonRef = useRef<HTMLButtonElement>(null);
    const [popoverPosition, setPopoverPosition] = useState({ bottom: 0, left: 0, transform: '' });
    
    const playerState = nowPlaying.spotifyState;
    const { radioStation, youtubeTrack, youtubePlaylist, source } = nowPlaying;

    const audioRef = useRef<HTMLAudioElement>(null);
    const hlsRef = useRef<any>(null);
    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const youtubePlayerRef = useRef<any>(null);
    const [isYouTubePlaying, setIsYouTubePlaying] = useState(false);
    const [youTubeProgress, setYouTubeProgress] = useState({ position: 0, duration: 1 });
    const progressIntervalRef = useRef<number | null>(null);
    const [isYouTubeSeeking, setIsYouTubeSeeking] = useState(false);
    const [currentYouTubeVideoId, setCurrentYouTubeVideoId] = useState<string | undefined>();
    const hasEndedRef = useRef(false);


    const isPlayerActive = playerStatus === 'ready' && playerState && playerState.track_window.current_track;
    const internalVolumeUpdate = useRef(false);
    const tokenRef = useRef<string | null>(accessToken);
    useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

    const handleToggleQueue = (source: 'spotify' | 'youtube') => {
        if (visibleQueue === source) {
            setIsQueueClosing(true);
            setTimeout(() => {
                setVisibleQueue(null);
                setIsQueueClosing(false);
            }, 300);
        } else {
            setIsQueueClosing(false);
            setVisibleQueue(source);
        }
    };

    useEffect(() => {
        if (playerRef.current && typeof volume === 'number') {
            if (internalVolumeUpdate.current) {
                internalVolumeUpdate.current = false;
                return;
            }
            playerRef.current.setVolume(volume).catch(e => console.error("Failed to set Spotify volume", e));
        }
    }, [volume]);
    
    useEffect(() => {
        if (audioRef.current) {
            audioRef.current.volume = volume;
        }
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.setVolume(volume * 100);
        }
    }, [volume]);
    
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const cleanup = () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
            audio.pause();
            audio.removeAttribute('src');
            audio.load();
        };
        
        const handleCanPlay = () => {
            if (nowPlaying.source === 'radio') {
                setNowPlaying(s => ({ ...s, isLoading: false }));
            }
        };

        if (source === 'radio' && radioStation?.url_resolved) {
            const streamUrl = radioStation.url_resolved;
            cleanup();

            if (window.Hls.isSupported() && streamUrl.includes('.m3u8')) {
                const hls = new window.Hls();
                hlsRef.current = hls;
                hls.loadSource(streamUrl);
                hls.attachMedia(audio);
                hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                    audio.play().catch(e => console.error("Radio autoplay failed:", e));
                });
                hls.on(window.Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error('Fatal HLS error, destroying instance.', data);
                        cleanup();
                    }
                });
            } else {
                audio.src = streamUrl;
                audio.play().catch(e => console.error("Radio autoplay failed:", e));
            }
        } else {
            cleanup();
        }

        const handlePlay = () => setIsRadioPlaying(true);
        const handlePause = () => setIsRadioPlaying(false);

        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('canplay', handleCanPlay);

        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('canplay', handleCanPlay);
            cleanup();
        };
    }, [source, radioStation?.url_resolved, nowPlaying.source, setNowPlaying]);
    
    useEffect(() => {
        if (source === 'youtube' && youtubeTrack?.videoId) {
            setCurrentYouTubeVideoId(youtubeTrack.videoId);
        }
    }, [source, youtubeTrack]);
    
    useEffect(() => {
        const player = youtubePlayerRef.current;
        if (player && typeof player.pauseVideo === 'function') {
            if (source !== 'youtube') {
                player.pauseVideo();
            }
        }
    }, [source]);

    const handleYouTubeEnd = useCallback(() => {
        if (nowPlaying.source !== 'youtube' || !nowPlaying.youtubePlaylist || !nowPlaying.youtubeTrack) {
            return;
        }
    
        const currentTrackIndex = nowPlaying.youtubePlaylist.findIndex(
            track => track.videoId === nowPlaying.youtubeTrack?.videoId
        );
    
        if (currentTrackIndex === -1 || currentTrackIndex >= nowPlaying.youtubePlaylist.length - 1) {
            return;
        }
    
        const nextTrack = nowPlaying.youtubePlaylist[currentTrackIndex + 1];
        playYouTube(nextTrack, nowPlaying.youtubePlaylist);
    }, [nowPlaying, playYouTube]);

    useEffect(() => {
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }

        if (source === 'youtube' && youtubePlayerRef.current) {
            progressIntervalRef.current = window.setInterval(() => {
                const player = youtubePlayerRef.current;
                if (!player || typeof player.getPlayerState !== 'function' || typeof player.getCurrentTime !== 'function') return;

                const playerState = player.getPlayerState();
                const position = player.getCurrentTime();
                const duration = player.getDuration();
                
                if (playerState === 1 && !isYouTubeSeeking) {
                    if (duration > 0) {
                        setYouTubeProgress({ position, duration });
                    }
                }
                
                const hasFinished = playerState === 0 || (duration > 0 && position >= duration - 0.6);

                if (hasFinished && !hasEndedRef.current) {
                    hasEndedRef.current = true;
                    handleYouTubeEnd();
                }
            }, 500);
        }

        return () => {
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
        };
    }, [source, isYouTubePlaying, isYouTubeSeeking, handleYouTubeEnd]);
    
    useEffect(() => {
        if (source === 'youtube') {
            setYouTubeProgress({ position: 0, duration: 1 });
        }
    }, [youtubeTrack?.videoId, source]);

    // ** L'effetto più importante per l'SDK **
    // Viene eseguito solo quando `accessToken` diventa disponibile.
    useEffect(() => {
        if (!accessToken) {
            // Se il token viene rimosso (logout), distruggiamo l'istanza del player.
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
            setPlayerStatus('connecting');
            _setPlayerState(null);
            setDeviceId(null); // Pulisce il device ID
            return;
        }

        // Previene la reinizializzazione se lo script è già presente.
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
     
             setPlayerStatus('connecting');
             const player = new window.Spotify.Player({
                 name: 'Mio Infotainment',
                 getOAuthToken: cb => {
                    // Usa un ref per l'accessToken per evitare che la callback usi un token vecchio.
                    if (tokenRef.current) cb(tokenRef.current);
                 },
                 volume: volume
             });
     
             // ** Evento cruciale: il device è pronto **
             player.on('ready', async ({ device_id }) => {
                 console.log('%c[Spotify SDK] Ready! Device ID:', 'color: lime; font-weight: bold', device_id);
                 await player.activateElement(); // Attiva il contesto audio per il browser
                 setDeviceId(device_id); // Invia l'ID al nostro AuthContext
                 setPlayerStatus('ready');
                 // Ora che il player è veramente pronto, possiamo tentare di ripristinare la sessione.
                 setPlayerAsReadyForAutoplay();
             });
     
             player.on('not_ready', ({ device_id }) => {
                 console.warn('[Spotify SDK] Device has gone offline', device_id);
                 setDeviceId(null);
                 setPlayerStatus('connecting');
             });
             
             player.on('player_state_changed', (state) => {
                 _setPlayerState(state);
                 player.getVolume().then(sdkVolume => {
                     if (typeof sdkVolume === 'number' && sdkVolume !== volume) {
                         internalVolumeUpdate.current = true;
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

            player.on('account_error', (error) => {
                console.error("Spotify account error:", error.message);
                setPlayerStatus('error');
            });
             player.on('initialization_error', (error) => {
                console.error("Spotify initialization error:", error.message);
                setPlayerStatus('error');
            });
     
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
    }, [accessToken, logout, setDeviceId, _setPlayerState, setVolume, volume, silentRefreshToken, setPlayerAsReadyForAutoplay]);
    
    useEffect(() => {
        const playerEl = playerContainerRef.current;
        const buttonRef = visibleQueue === 'spotify' ? spotifyQueueButtonRef.current : youTubeQueueButtonRef.current;
        if (!visibleQueue || !playerEl || !buttonRef) return;

        let animationFrameId: number;

        const calculatePosition = () => {
            const playerRect = playerEl.getBoundingClientRect();
            setPopoverPosition({
                bottom: window.innerHeight - playerRect.top + 16,
                left: playerRect.left + playerRect.width / 2,
                transform: 'translateX(-50%)',
            });
        };
        
        const updateLoop = () => {
            calculatePosition();
            animationFrameId = requestAnimationFrame(updateLoop);
        };

        animationFrameId = requestAnimationFrame(updateLoop);
        window.addEventListener('resize', calculatePosition);
    
        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('resize', calculatePosition);
        };
    }, [visibleQueue]);

    const prevTrackUri = useRef<string | undefined>(undefined);
    useEffect(() => {
        const currentTrackUri = playerState?.track_window?.current_track?.uri;
        if (prevTrackUri.current && prevTrackUri.current !== currentTrackUri) {
            setVisibleQueue(null);
        }
        prevTrackUri.current = currentTrackUri;
    }, [playerState?.track_window?.current_track?.uri]);


    useEffect(() => {
        const checkIsLiked = async () => {
            const trackId = playerState?.track_window?.current_track?.id;
            if (!trackId) return;
            try {
                const { data } = await apiClient.get(`/me/tracks/contains?ids=${trackId}`);
                setIsLiked(data[0] || false);
            } catch (e) {
                console.error("Failed to check if track is liked", e);
                setIsLiked(false);
            }
        };
        checkIsLiked();
    }, [playerState?.track_window?.current_track?.id]);

    const handleYoutubeReady = (event: { target: any }) => {
        youtubePlayerRef.current = event.target;
        youtubePlayerRef.current.setVolume(volume * 100);
    };

    const handleYoutubeStateChange = (event: { data: number }) => {
        const playerState = event.data;
        const playerIsPlaying = playerState === 1;
        setIsYouTubePlaying(playerIsPlaying);
    
        if (playerIsPlaying) {
            hasEndedRef.current = false;
            setNowPlaying(s => ({ ...s, isLoading: false }));
        }
    };

    const handleTogglePlay = () => {
        if (source === 'spotify') {
            playerRef.current?.togglePlay();
        } else if (source === 'radio') {
            const audio = audioRef.current;
            if (audio) {
                if (audio.paused) {
                    audio.play().catch(e => console.error("Failed to play radio stream:", e));
                } else {
                    audio.pause();
                }
            }
        } else if (source === 'youtube' && youtubePlayerRef.current) {
            const playerState = youtubePlayerRef.current.getPlayerState();
            if (playerState === 1) {
                youtubePlayerRef.current.pauseVideo();
            } else {
                youtubePlayerRef.current.playVideo();
            }
        }
    };

    const handleNextTrack = () => {
        if (source === 'spotify') {
            playerRef.current?.nextTrack();
        } else if (source === 'radio') {
            onStationChange('next');
        } else if (source === 'youtube' && youtubePlayerRef.current && nowPlaying.youtubePlaylist) {
             const currentTrackIndex = nowPlaying.youtubePlaylist.findIndex(
                track => track.videoId === nowPlaying.youtubeTrack?.videoId
            );
            if (currentTrackIndex > -1 && currentTrackIndex < nowPlaying.youtubePlaylist.length - 1) {
                const nextTrack = nowPlaying.youtubePlaylist[currentTrackIndex + 1];
                playYouTube(nextTrack, nowPlaying.youtubePlaylist);
            }
        }
    };
    const handlePrevTrack = () => {
        if (source === 'spotify') {
            playerRef.current?.previousTrack();
        } else if (source === 'radio') {
            onStationChange('prev');
        } else if (source === 'youtube' && youtubePlayerRef.current && nowPlaying.youtubePlaylist) {
             const currentTrackIndex = nowPlaying.youtubePlaylist.findIndex(
                track => track.videoId === nowPlaying.youtubeTrack?.videoId
            );
            if (currentTrackIndex > 0) {
                const prevTrack = nowPlaying.youtubePlaylist[currentTrackIndex - 1];
                playYouTube(prevTrack, nowPlaying.youtubePlaylist);
            }
        }
    };

    const handleToggleLike = async () => {
        const trackId = playerState?.track_window?.current_track?.id;
        if (!trackId) return;
        const originalIsLiked = isLiked;
        setIsLiked(!originalIsLiked);
        try {
            if (originalIsLiked) {
                await apiClient.delete(`/me/tracks`, { data: { ids: [trackId] } });
            } else {
                await apiClient.put(`/me/tracks`, { ids: [trackId] });
            }
        } catch (e) {
            console.error("Failed to update like status", e);
            setIsLiked(originalIsLiked);
        }
    };

    const handleToggleShuffle = () => {
        if (!playerState) return;
        apiClient.put(`/me/player/shuffle?state=${!playerState.shuffle}`);
    };

    const handleToggleRepeat = () => {
        if (!playerState) return;
        const nextState = (playerState.repeat_mode + 1) % 3;
        const repeatMode = nextState === 0 ? 'off' : nextState === 1 ? 'context' : 'track';
        apiClient.put(`/me/player/repeat?state=${repeatMode}`);
    };
    
    const handleSeekYouTube = useCallback((position: number) => {
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(position, true);
        }
    }, []);
    
    const handleYouTubeSeekStart = useCallback(() => {
        setIsYouTubeSeeking(true);
    }, []);
    
    const handleYouTubeSeekEnd = useCallback(() => {
        setIsYouTubeSeeking(false);
        if (youtubePlayerRef.current) {
            const position = youtubePlayerRef.current.getCurrentTime();
            const duration = youtubePlayerRef.current.getDuration();
            setYouTubeProgress({ position, duration });
        }
    }, []);

    const playerStyle: React.CSSProperties = useMemo(() => {
        let baseStyle: React.CSSProperties;
        if (isAnyAppOpen) {
            baseStyle = {
                width: `${dockedConfig.width}px`,
                height: `${dockedConfig.height}px`,
                bottom: `${dockedConfig.bottom}px`,
                left: `${dockedConfig.left}px`,
                transform: 'translateX(0)',
            };
        } else {
            const { width, bottom, height, otherWidgetWidth } = floatingConfig;
            baseStyle = {
                width: `${width}px`,
                height: `${height}px`,
                bottom: `${bottom}px`,
                left: '50%',
                transform: `translateX(calc(-50% - (${otherWidgetWidth}px / 2) - 8px))`,
            };
        }
        baseStyle.background = !isNight ? widgetBgColor : 'var(--player-bg)';
        return baseStyle;
    }, [isAnyAppOpen, dockedConfig, floatingConfig, widgetBgColor, isNight]);

    const themeClasses = isNight 
        ? 'border-zinc-700/80' 
        : 'border-zinc-300';
    
    const renderPlayerContent = () => {
        if (nowPlaying.isLoading && source !== 'radio') {
            return (
                <div className="w-full h-full flex items-center gap-5 px-4 animate-pulse" style={{backgroundColor: 'var(--player-bg)'}}>
                    <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${isNight ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                    <div className="flex-grow overflow-hidden space-y-2">
                        <div className={`h-4 rounded w-3/4 ${isNight ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                        <div className={`h-3 rounded w-1/2 ${isNight ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                    </div>
                    <div className="flex-shrink-0">
                        <div className={`w-7 h-7 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`} />
                    </div>
                </div>
            );
        }

        if (source === 'youtube' && youtubeTrack) {
            const { title, channelTitle, thumbnail } = youtubeTrack;
            const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
            const isYouTubePlaylist = youtubePlaylist && youtubePlaylist.length > 0;

            return (
                 <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={thumbnail} alt={title} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 shadow-lg" />
                            <div className="overflow-hidden flex-grow">
                                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{title}</div>
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{channelTitle}</div>
                            </div>
                        </div>
                    </div>
                    <YouTubeProgressBar 
                        progress={youTubeProgress} 
                        isSeeking={isYouTubeSeeking}
                        onSeek={handleSeekYouTube}
                        onSeekStart={handleYouTubeSeekStart}
                        onSeekEnd={handleYouTubeSeekEnd}
                    />
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                        <div className="flex-1 flex justify-start"></div>
                        <div className="flex items-center" style={{ gap: `${playerControlsGap * 0.8}px` }}>
                            <button onClick={handlePrevTrack} className={`transition ${!isYouTubePlaylist ? 'opacity-30' : ''}`} style={{ color: buttonActiveColor }} disabled={!isYouTubePlaylist}><IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            <button onClick={handleTogglePlay} className="transition" style={{ color: buttonActiveColor }}>
                                {isYouTubePlaying
                                    ? <IoPauseSharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />
                                    : <IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />
                                }
                            </button>
                            <button onClick={handleNextTrack} className={`transition ${!isYouTubePlaylist ? 'opacity-30' : ''}`} style={{ color: buttonActiveColor }} disabled={!isYouTubePlaylist}><IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                        </div>
                        <div className="flex-1 flex justify-end items-center">
                            <button ref={youTubeQueueButtonRef} onClick={() => handleToggleQueue('youtube')} className={`p-1 rounded-full transition-all duration-200`} style={{ color: visibleQueue === 'youtube' ? buttonActiveColor : (isNight ? '#464646' : '#b0b0b0') }}>
                                <BsList style={{ width: '20px', height: '20px'}} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (source === 'radio' && radioStation) {
            const { name, favicon, tags } = radioStation;
            const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
            const isFavorite = favoriteStationUUIDs.includes(radioStation.stationuuid);
            
            return (
                <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0">
                            {favicon ? 
                                <img src={favicon} alt={name} className="w-12 h-12 rounded-lg object-contain bg-zinc-800 flex-shrink-0 shadow-lg" /> 
                                : 
                                <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    <FiRadio className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                                </div>
                            }
                            <div className="overflow-hidden flex-grow">
                                <div className={`font-semibold text-sm truncate`} style={{ color: 'var(--text-primary)' }}>{name}</div>
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)'}}>{tags.split(',')[0] || 'Radio'}</div>
                            </div>
                        </div>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[var(--progress-bg)]" />
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                        <div className="flex-1 flex justify-start"></div>
                        <div className="flex items-center" style={{ gap: `${playerControlsGap}px` }}>
                            <button onClick={handlePrevTrack} className={`transition`} style={{ color: buttonActiveColor }}><IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            <button onClick={handleTogglePlay} className={`transition`} style={{ color: buttonActiveColor }}>
                                {isRadioPlaying
                                    ? <IoPauseSharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />
                                    : <IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />
                                }
                            </button>
                            <button onClick={handleNextTrack} className={`transition`} style={{ color: buttonActiveColor }}><IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            <button onClick={() => onToggleFavorite(radioStation)} className={`transition`} style={{ color: isFavorite ? buttonActiveColor : (isNight ? '#464646' : '#b0b0b0') }}>
                                <FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} className={`${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                        <div className="flex-1 flex justify-end items-center"></div>
                    </div>
                </div>
            );
        }

        if (source === 'spotify' && isPlayerActive) {
            const { name: trackName, album, artists } = playerState.track_window.current_track!;
            const imageUrl = album.images[0]?.url;
            const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
            const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';
            const songTitleColor = isNight ? '#f7f7f7' : (playerState.paused ? '#454545' : '#000000');
            
            return (
                <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0">
                            {imageUrl && (
                                <div className="flex-shrink-0">
                                    <img src={imageUrl} alt={album.name} className="w-12 h-12 rounded-lg shadow-lg" />
                                </div>
                            )}
                            <div className="overflow-hidden flex-grow">
                                <div className={`font-semibold text-sm truncate`} style={{ color: songTitleColor }}>{trackName}</div>
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)'}}>
                                    {artists.map(a => a.name).join(', ')}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            <button onClick={handleToggleShuffle} className={`transition`} style={{ color: playerState.shuffle ? buttonActiveColor : inactiveButtonColor }}>
                                <PiShuffleBold className="w-5 h-5" />
                            </button>
                            <button onClick={handleToggleRepeat} className={`transition`} style={{ color: playerState.repeat_mode !== 0 ? buttonActiveColor : inactiveButtonColor }}>
                               {playerState.repeat_mode === 2 ? <PiRepeatOnceBold className="w-5 h-5"/> : <PiRepeatBold className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    <div className="w-full">
                        <SpotifyProgressBar player={playerRef.current} state={playerState} isLoading={nowPlaying.isLoading === true && source === 'spotify'} isNight={isNight} />
                    </div>
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                        <div className="flex-1 flex justify-start"></div>
                        <div className="flex items-center" style={{ gap: `${playerControlsGap}px`}}>
                            <button onClick={handlePrevTrack} disabled={playerState.disallows.skipping_prev} className={`disabled:opacity-30 transition`} style={{ color: buttonActiveColor }}>
                                <IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} />
                            </button>
                            <button onClick={handleTogglePlay} className={`transition`} style={{ color: buttonActiveColor }}>
                                {playerState.paused 
                                    ? <IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /> 
                                    : <IoPauseSharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />}
                            </button>
                            <button onClick={handleNextTrack} disabled={playerState.disallows.skipping_next} className={`disabled:opacity-30 transition`} style={{ color: buttonActiveColor }}>
                                <IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} />
                            </button>
                             <button onClick={handleToggleLike} className={`transition`} style={{ color: isLiked ? buttonActiveColor : inactiveButtonColor }}>
                                <FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} className={`${isLiked ? 'fill-current' : ''}`} />
                             </button>
                        </div>
                        <div className="flex-1 flex justify-end items-center">
                            <button ref={spotifyQueueButtonRef} onClick={() => handleToggleQueue('spotify')} className={`p-1 rounded-full transition-all duration-200`} style={{ color: visibleQueue === 'spotify' ? buttonActiveColor : inactiveButtonColor }}>
                                <BsList style={{ width: '20px', height: '20px'}} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (playerStatus === 'error') {
            return (
                <div className="flex items-center w-full h-full gap-5 px-4 text-red-500">
                    <FiAlertTriangle className="w-8 h-8 flex-shrink-0"/>
                    <div className="overflow-hidden">
                        <div className="font-semibold truncate">Connection Error</div>
                        <div className="text-sm truncate">Could not connect to Spotify.</div>
                    </div>
                </div>
            );
        }

        if (activeApp === 'spotify' && !isAuthenticated) {
            return (
                <div className="flex items-center w-full h-full gap-5 px-4">
                     <div className={`w-12 h-12 rounded-lg shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-primary)'}}>Spotify</div>
                        <div className="text-sm truncate" style={{ color: 'var(--text-secondary)'}}>Accedi con Spotify</div>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="flex items-center w-full h-full gap-5 px-4">
                <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="font-semibold truncate" style={{ color: 'var(--text-primary)'}}>Niente in riproduzione</div>
                    <div className="text-sm truncate" style={{ color: 'var(--text-secondary)'}}>
                        Scegli qualcosa da ascoltare.
                    </div>
                </div>
            </div>
        );
    };
    
    const isPopoverVisible = visibleQueue !== null;

    let genericNextTrack: { name: string, description: string, imageUrl: string } | null = null;
    if (visibleQueue === 'spotify' && playerState?.track_window.next_tracks[0]) {
        const next = playerState.track_window.next_tracks[0];
        genericNextTrack = { 
            name: next.name, 
            description: next.artists.map(a => a.name).join(', '), 
            imageUrl: next.album.images[0].url 
        };
    } else if (visibleQueue === 'youtube') {
        const currentYouTubeIndex = nowPlaying.youtubePlaylist?.findIndex(
            t => t.videoId === nowPlaying.youtubeTrack?.videoId
        ) ?? -1;
        const nextYouTubeTrack = (nowPlaying.youtubePlaylist && currentYouTubeIndex > -1 && currentYouTubeIndex < nowPlaying.youtubePlaylist.length - 1)
            ? nowPlaying.youtubePlaylist[currentYouTubeIndex + 1]
            : null;
        if (nextYouTubeTrack) {
            genericNextTrack = {
                name: nextYouTubeTrack.title,
                description: nextYouTubeTrack.channelTitle,
                imageUrl: nextYouTubeTrack.thumbnail
            };
        }
    }

    return (
        <>
            <div 
                ref={playerContainerRef}
                className={`music-player ${themeClasses} backdrop-blur-md border rounded-xl shadow-lg flex items-center gap-5 overflow-hidden`}
                style={playerStyle}
            >
                {renderPlayerContent()}
                <audio ref={audioRef} style={{ display: 'none' }} crossOrigin="anonymous" />
            </div>
            {isPopoverVisible && (
                <QueuePopover
                    isNight={isNight}
                    nextTrack={genericNextTrack}
                    position={popoverPosition}
                    isClosing={isQueueClosing}
                    onClose={() => handleToggleQueue(visibleQueue!)}
                />
            )}
            <div style={{ position: 'fixed', top: -9999, left: -9999, pointerEvents: 'none', opacity: 0 }}>
                <YouTube
                    videoId={currentYouTubeVideoId}
                    opts={{
                        height: '360',
                        width: '640',
                        playerVars: {
                            autoplay: 1,
                            controls: 0,
                        }
                    }}
                    onReady={handleYoutubeReady}
                    onStateChange={handleYoutubeStateChange}
                />
            </div>
        </>
    );
};

export default MusicPlayer;