import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiRadio, FiPlay
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
    spinnerSize: number;
    spinnerShuffleGap: number;
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    onStationChange: (direction: 'next' | 'prev') => void;
    activeApp: string | null;
    favoriteStationUUIDs: string[];
    onToggleFavorite: (station: RadioStation) => void;
    queuePopoverHeight: number;
    queuePopoverBottomOffset: number;
    queuePopoverScale: number;
    queuePopoverWidth: number;
    queuePopoverOffsetX: number;
    debugSpinner: boolean;
    showQueueOnTrackEnd: boolean;
}

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
                    <div className={`spotify-spinner w-4 h-4`} />
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


const QueuePopover = ({ isNight, nextTrack, position, onClose, isClosing, height, scale, width }: { isNight: boolean, nextTrack: { name: string, description: string, imageUrl: string } | null, position: { bottom: number, left: number, transform: string }, onClose: () => void, isClosing: boolean, height: number, scale: number, width: number }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    return ReactDOM.createPortal(
        <div
            ref={popoverRef}
            style={{
                bottom: `${position.bottom}px`,
                left: `${position.left}px`,
                transform: `${position.transform} scale(${scale})`,
                transformOrigin: 'bottom center',
                backgroundColor: 'var(--player-bg)',
                height: `${height}px`,
                width: `${width}px`,
            }}
            className={`fixed p-3 rounded-lg shadow-2xl z-50 border ${isNight ? 'border-zinc-700' : 'border-zinc-200'} ${isClosing ? 'animate-fade-out' : 'animate-fade-in'} flex flex-col`}
        >
            <p className="text-xs font-bold mb-2 flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>Prossima in coda</p>
            <div className="flex-grow flex items-center">
                {nextTrack ? (
                    <div className="flex items-center gap-3 min-w-0 w-full">
                        <img src={nextTrack.imageUrl} alt={nextTrack.name} className="w-10 h-10 rounded-md flex-shrink-0" />
                        <div className="overflow-hidden">
                            <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nextTrack.name}</p>
                            <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nextTrack.description}</p>
                        </div>
                    </div>
                ) : (
                    <p className="text-sm w-full text-center" style={{ color: 'var(--text-secondary)' }}>Nessuna canzone in coda.</p>
                )}
            </div>
        </div>,
        document.getElementById('scaled-portal-root')!
    );
};

const DisabledPlayerView = ({ showSpinner, isNight, playerControlsSize, playerControlsGap, playerControlsVerticalPosition, dayPlayerButtonColor, nightPlayerButtonColor, spinnerSize, spinnerShuffleGap }: { 
    showSpinner: boolean; isNight: boolean; playerControlsSize: number; playerControlsGap: number; playerControlsVerticalPosition: number; dayPlayerButtonColor: string; nightPlayerButtonColor: string; spinnerSize: number; spinnerShuffleGap: number; 
}) => {
    const isReady = false; // Always disabled
    const buttonColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
    const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';

    return (
        <div className="w-full h-full flex flex-col justify-between px-4 py-2">
            {/* Top part: Track info */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-lg shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className="overflow-hidden flex-grow">
                        <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>Nessun brano in riproduzione</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>Scegli qualcosa da ascoltare</div>
                    </div>
                </div>
                {/* Shuffle/Repeat etc. */}
                <div className="flex items-center gap-5">
                     <div className="flex items-center" style={{ gap: `${spinnerShuffleGap}px`}}>
                        {showSpinner && (
                            <div className="spotify-spinner" style={{ width: `${spinnerSize}px`, height: `${spinnerSize}px` }}/>
                        )}
                        <button disabled={!isReady} className="transition" style={{ color: inactiveButtonColor }}>
                            <PiShuffleBold className="w-5 h-5" />
                        </button>
                    </div>
                    <button disabled={!isReady} className="transition" style={{ color: inactiveButtonColor }}>
                        <PiRepeatBold className="w-5 h-5" />
                    </button>
                </div>
            </div>
            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full cursor-not-allowed bg-[var(--progress-bg)]" />
            {/* Controls */}
            <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                <div className="flex-1 flex justify-start"></div>
                <div className="flex items-center" style={{ gap: `${playerControlsGap}px` }}>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: buttonColor }}><IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: buttonColor }}><IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /></button>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: buttonColor }}><IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: inactiveButtonColor }}><FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} /></button>
                </div>
                <div className="flex-1 flex justify-end items-center">
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed p-1 rounded-full transition-all duration-200" style={{ color: inactiveButtonColor }}>
                        <BsList style={{ width: '20px', height: '20px'}} />
                    </button>
                </div>
            </div>
        </div>
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
    spinnerSize,
    spinnerShuffleGap,
    debugSpinner,
    widgetBgColor,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    onStationChange,
    activeApp,
    favoriteStationUUIDs,
    onToggleFavorite,
    queuePopoverHeight,
    queuePopoverBottomOffset,
    queuePopoverScale,
    queuePopoverWidth,
    queuePopoverOffsetX,
    showQueueOnTrackEnd,
}) => {
  const { 
      isAuthenticated, 
      nowPlaying, 
      setNowPlaying, 
      volume, 
      playYouTube, 
      playerRef,
      isAutoplayBlocked,
      unlockAutoplay
  } = useAuth();
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

    const popoverShownForTrack = useRef<string | null>(null);
    const prevTrackUriForPopover = useRef<string | undefined>(undefined);

    const isPlayerActive = playerRef.current && playerState && playerState.track_window.current_track;

    // Auto-show queue popover near end of track
    useEffect(() => {
        const interval = setInterval(() => {
            const currentSpotifyState = nowPlaying.spotifyState;
            const isSpotifyActive = playerRef.current && currentSpotifyState && currentSpotifyState.track_window.current_track;

            if (!showQueueOnTrackEnd || !currentSpotifyState || currentSpotifyState.paused || !isSpotifyActive) {
                return;
            }

            const { duration, position, track_window } = currentSpotifyState;
            const currentTrack = track_window.current_track;
            const hasNextTrack = track_window.next_tracks.length > 0;
            
            if (!currentTrack) return;
            
            // Reset trigger if track has changed
            if (popoverShownForTrack.current !== currentTrack.uri) {
                popoverShownForTrack.current = null;
            }

            const remainingTime = duration - position;

            // Show condition: less than 15s remaining, has a next track, and not already shown for this track
            if (remainingTime < 15000 && remainingTime > 0 && hasNextTrack && popoverShownForTrack.current !== currentTrack.uri) {
                setVisibleQueue('spotify');
                popoverShownForTrack.current = currentTrack.uri;
            }

        }, 1000); // Check every second

        return () => clearInterval(interval);
    }, [nowPlaying.spotifyState, showQueueOnTrackEnd, playerRef]);
    
    // Hide popover on track change
    useEffect(() => {
        const currentTrackUri = nowPlaying.spotifyState?.track_window?.current_track?.uri;
        if (prevTrackUriForPopover.current && prevTrackUriForPopover.current !== currentTrackUri) {
            setVisibleQueue(null);
        }
        prevTrackUriForPopover.current = currentTrackUri;
    }, [nowPlaying.spotifyState?.track_window?.current_track?.uri]);


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
    
    useEffect(() => {
        const playerEl = playerContainerRef.current;
        const buttonRef = visibleQueue === 'spotify' ? spotifyQueueButtonRef.current : youTubeQueueButtonRef.current;
        if (!visibleQueue || !playerEl || !buttonRef) return;

        let animationFrameId: number;

        const calculatePosition = () => {
            const playerRect = playerEl.getBoundingClientRect();
            setPopoverPosition({
                bottom: window.innerHeight - playerRect.top + queuePopoverBottomOffset,
                left: playerRect.left + playerRect.width / 2,
                transform: `translateX(calc(-50% + ${queuePopoverOffsetX}px))`,
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
    }, [visibleQueue, queuePopoverBottomOffset, queuePopoverOffsetX]);

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
            console.error("Failed to toggle like status", e);
            setIsLiked(originalIsLiked); // Revert on error
        }
    };

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

    const handleToggleShuffle = () => playerRef.current?.setShuffle(!playerState?.shuffle);
    const handleToggleRepeat = () => playerRef.current?.setRepeatMode((playerState?.repeat_mode + 1) % 3);
    
    const handleYouTubeSeek = (position: number) => {
        setYouTubeProgress(prev => ({ ...prev, position }));
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(position);
        }
    };

    const currentTrack: SpotifyTrack | null = playerState?.track_window.current_track ?? null;
    const isReady = !!(isAuthenticated && playerRef.current);

    const isShowingPlayer = (source === 'spotify' && isPlayerActive) || source === 'radio' || source === 'youtube';
    const showSpinner = nowPlaying.isLoading || debugSpinner;

    if (!isShowingPlayer) {
        return (
             <div 
                ref={playerContainerRef}
                className="music-player backdrop-blur-md border rounded-xl shadow-lg transition-all"
                style={{
                    width: `${isAnyAppOpen ? dockedConfig.width : floatingConfig.width}px`,
                    height: `${isAnyAppOpen ? dockedConfig.height : floatingConfig.height}px`,
                    bottom: isAnyAppOpen ? '20px' : `${floatingConfig.bottom}px`,
                    left: isAnyAppOpen ? `${dockedConfig.left}px` : '50%',
                    transform: isAnyAppOpen ? 'none' : `translateX(calc(-50% - ${floatingConfig.otherWidgetWidth / 2 + 8}px))`,
                    backgroundColor: !isNight ? widgetBgColor : 'var(--player-bg)',
                    borderColor: isNight ? 'rgba(55, 55, 55, 0.8)' : 'rgba(200, 200, 200, 0.5)',
                }}
            >
                <DisabledPlayerView
                    showSpinner={showSpinner}
                    isNight={isNight}
                    playerControlsSize={playerControlsSize}
                    playerControlsGap={playerControlsGap}
                    playerControlsVerticalPosition={playerControlsVerticalPosition}
                    spinnerSize={spinnerSize}
                    spinnerShuffleGap={spinnerShuffleGap}
                    dayPlayerButtonColor={dayPlayerButtonColor}
                    nightPlayerButtonColor={nightPlayerButtonColor}
                />
            </div>
        );
    }
    
    const PlayPauseIcon = (source === 'spotify' && playerState?.paused === false) ||
                         (source === 'radio' && isRadioPlaying) ||
                         (source === 'youtube' && isYouTubePlaying)
                         ? IoPauseSharp : IoPlaySharp;
    
    const isStationFavorite = favoriteStationUUIDs.includes(radioStation?.stationuuid ?? '');

    const buttonColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
    const inactiveButtonColor = isNight ? '#a0a0a0' : '#808080';
    const activeShuffleRepeatColor = isNight ? '#1DB954' : '#188b43';

    const getRepeatIcon = () => {
        if(playerState?.repeat_mode === 2) return <PiRepeatOnceBold className="w-5 h-5" />;
        return <PiRepeatBold className="w-5 h-5" />;
    };
    
    const nextSpotifyTrack = playerState?.track_window.next_tracks[0];
    const nextYouTubeTrack = youtubePlaylist && youtubeTrack
        ? youtubePlaylist[youtubePlaylist.findIndex(t => t.videoId === youtubeTrack.videoId) + 1]
        : null;

    let nextTrackInfo = null;
    if (visibleQueue === 'spotify' && nextSpotifyTrack) {
        nextTrackInfo = {
            name: nextSpotifyTrack.name,
            description: nextSpotifyTrack.artists.map(a => a.name).join(', '),
            imageUrl: nextSpotifyTrack.album.images[0].url,
        };
    } else if (visibleQueue === 'youtube' && nextYouTubeTrack) {
        nextTrackInfo = {
            name: nextYouTubeTrack.title,
            description: nextYouTubeTrack.channelTitle,
            imageUrl: nextYouTubeTrack.thumbnail,
        };
    }

    return (
        <>
            <audio ref={audioRef} className="hidden" />
            <div className="hidden">
                 {currentYouTubeVideoId && (
                     <YouTube
                        videoId={currentYouTubeVideoId}
                        opts={{
                            height: '0',
                            width: '0',
                            playerVars: { autoplay: 1, controls: 0 },
                        }}
                        onReady={handleYoutubeReady}
                        onStateChange={handleYoutubeStateChange}
                        onEnd={handleYouTubeEnd}
                    />
                 )}
            </div>
            
            <div 
                ref={playerContainerRef}
                className="music-player backdrop-blur-md border rounded-xl shadow-lg transition-all"
                style={{
                    width: `${isAnyAppOpen ? dockedConfig.width : floatingConfig.width}px`,
                    height: `${isAnyAppOpen ? dockedConfig.height : floatingConfig.height}px`,
                    bottom: isAnyAppOpen ? '20px' : `${floatingConfig.bottom}px`,
                    left: isAnyAppOpen ? `${dockedConfig.left}px` : '50%',
                    transform: isAnyAppOpen ? 'none' : `translateX(calc(-50% - ${floatingConfig.otherWidgetWidth / 2 + 8}px))`,
                    backgroundColor: !isNight ? widgetBgColor : 'var(--player-bg)',
                    borderColor: isNight ? 'rgba(55, 55, 55, 0.8)' : 'rgba(200, 200, 200, 0.5)',
                }}
            >
                {/* Autoplay Unlocker */}
                {isAutoplayBlocked && (
                     <div 
                        className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white text-center rounded-xl p-4"
                        onClick={unlockAutoplay}
                     >
                        <FiPlay className="w-12 h-12" />
                        <p className="font-semibold">Clicca per attivare la riproduzione</p>
                    </div>
                )}
                
                {/* Main Content */}
                <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    {/* Top part: Track info & extra controls */}
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0">
                            {/* Album art */}
                            <div className="w-12 h-12 rounded-lg shadow-lg flex-shrink-0">
                                {source === 'spotify' && currentTrack && <img src={currentTrack.album.images[0].url} alt={currentTrack.album.name} className="w-full h-full rounded-lg object-cover" />}
                                {source === 'radio' && radioStation && (
                                    radioStation.favicon ?
                                    <img src={radioStation.favicon} alt={radioStation.name} className={`w-full h-full rounded-lg object-contain ${isNight ? 'bg-zinc-800' : 'bg-white'} p-1`} />
                                    : <div className={`w-full h-full rounded-lg flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}><FiRadio className="w-7 h-7 text-zinc-500"/></div>
                                )}
                                {source === 'youtube' && youtubeTrack && <img src={youtubeTrack.thumbnail} alt={youtubeTrack.title} className="w-full h-full rounded-lg object-cover" />}
                            </div>
                            {/* Track details */}
                             <div className="overflow-hidden flex-grow">
                                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)'}}>{
                                    (source === 'spotify' && currentTrack?.name) ||
                                    (source === 'radio' && radioStation?.name) ||
                                    (source === 'youtube' && youtubeTrack?.title) ||
                                    'Nessun brano in riproduzione'
                                }</div>
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)'}}>{
                                    (source === 'spotify' && currentTrack?.artists.map(a => a.name).join(', ')) ||
                                    (source === 'radio' && 'Stazione Radio') ||
                                    (source === 'youtube' && youtubeTrack?.channelTitle) ||
                                    'Scegli qualcosa da ascoltare'
                                }</div>
                            </div>
                        </div>
                        {/* Shuffle, Repeat etc */}
                         <div className="flex items-center gap-5">
                            {source === 'spotify' && (
                                <>
                                    <div className="flex items-center" style={{ gap: `${spinnerShuffleGap}px`}}>
                                        {showSpinner && (
                                            <div className="spotify-spinner" style={{ width: `${spinnerSize}px`, height: `${spinnerSize}px` }}/>
                                        )}
                                        <button onClick={handleToggleShuffle} disabled={!isReady} className="transition" style={{ color: playerState?.shuffle ? activeShuffleRepeatColor : inactiveButtonColor }}>
                                            <PiShuffleBold className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button onClick={handleToggleRepeat} disabled={!isReady} className="transition" style={{ color: playerState?.repeat_mode !== 0 ? activeShuffleRepeatColor : inactiveButtonColor }}>
                                        {getRepeatIcon()}
                                    </button>
                                </>
                            )}
                            {source === 'radio' && radioStation && (
                                 <button onClick={() => onToggleFavorite(radioStation)} className="transition">
                                    <FiHeart className={`w-5 h-5 ${isStationFavorite ? 'fill-current text-red-500' : ''}`} style={{ color: isStationFavorite ? '' : inactiveButtonColor }} />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full">
                        {source === 'spotify' && playerState && <SpotifyProgressBar player={playerRef.current} state={playerState} isLoading={nowPlaying.isLoading ?? false} isNight={isNight}/>}
                        {source === 'radio' && <div className="w-full h-1.5 rounded-full bg-green-500/50" />}
                        {source === 'youtube' && <YouTubeProgressBar progress={youTubeProgress} isSeeking={isYouTubeSeeking} onSeek={handleYouTubeSeek} onSeekStart={() => setIsYouTubeSeeking(true)} onSeekEnd={() => setIsYouTubeSeeking(false)} />}
                    </div>
                    
                    {/* Main Controls */}
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                        {/* Placeholder for spacing */}
                        <div className="flex-1 flex justify-start"></div>

                        <div className="flex items-center" style={{ gap: `${playerControlsGap}px` }}>
                            <button onClick={handlePrevTrack} disabled={!isReady} className="disabled:opacity-40 transition" style={{ color: buttonColor }}><IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            <button onClick={handleTogglePlay} disabled={!isReady} className="disabled:opacity-40 transition" style={{ color: buttonColor }}><PlayPauseIcon style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /></button>
                            <button onClick={handleNextTrack} disabled={!isReady} className="disabled:opacity-40 transition" style={{ color: buttonColor }}><IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            
                            {source === 'spotify' && (
                                <button onClick={handleToggleLike} disabled={!isReady || !currentTrack} className="disabled:opacity-40 transition" style={{ color: isLiked ? activeShuffleRepeatColor : buttonColor }}>
                                    <FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} className={isLiked ? 'fill-current' : ''} />
                                </button>
                            )}
                        </div>
                        
                        <div className="flex-1 flex justify-end items-center">
                            {(source === 'spotify' && playerState && playerState.track_window.next_tracks.length > 0) && (
                                 <button ref={spotifyQueueButtonRef} onClick={() => handleToggleQueue('spotify')} className={`p-1 rounded-full transition-all duration-200 ${visibleQueue === 'spotify' ? 'bg-white/20' : ''}`} style={{ color: inactiveButtonColor }}>
                                    <BsList style={{ width: '20px', height: '20px'}} />
                                </button>
                            )}
                             {(source === 'youtube' && nextYouTubeTrack) && (
                                 <button ref={youTubeQueueButtonRef} onClick={() => handleToggleQueue('youtube')} className={`p-1 rounded-full transition-all duration-200 ${visibleQueue === 'youtube' ? 'bg-white/20' : ''}`} style={{ color: inactiveButtonColor }}>
                                    <BsList style={{ width: '20px', height: '20px'}} />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            {visibleQueue && (
                <QueuePopover
                    isNight={isNight}
                    nextTrack={nextTrackInfo}
                    position={popoverPosition}
                    onClose={() => handleToggleQueue(visibleQueue)}
                    isClosing={isQueueClosing}
                    height={queuePopoverHeight}
                    scale={queuePopoverScale}
                    width={queuePopoverWidth}
                />
            )}
        </>
    );
};

export default MusicPlayer;