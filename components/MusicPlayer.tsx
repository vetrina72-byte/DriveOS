import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiRadio, FiLoader
} from 'react-icons/fi';
import { 
    IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp, IoPlaySkipForwardSharp
} from 'react-icons/io5';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { BsList } from 'react-icons/bs';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';
import type { RadioStation } from '../types';

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

const SpotifyProgressBar = ({ player, state }: { player: SpotifyPlayer | null, state: SpotifyPlayerState }) => {
    const [position, setPosition] = useState(state.position);
    const [isSeeking, setIsSeeking] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef(0);
    const lastSeekTime = useRef(0); // Track when the last seek happened

    useEffect(() => {
        // Only update from Spotify if we are not seeking AND
        // it's been more than a second since we last seeked.
        // This prevents the jump-back from an old state update arriving after seek.
        if (!isSeeking && Date.now() - lastSeekTime.current > 1000) {
            setPosition(state.position);
        }
    }, [state.position, isSeeking]);

    useEffect(() => {
        if (state.paused || isSeeking) {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
            return;
        }

        let startTime = performance.now() - position;

        const animate = (currentTime: number) => {
            const newPosition = currentTime - startTime;
            setPosition(Math.min(newPosition, state.duration));
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animationFrameRef.current = requestAnimationFrame(animate);

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [state.paused, state.duration, isSeeking, position]);


    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !player) return;
        
        setIsSeeking(true);
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
        }
        
        const getSeekPosition = (clientX: number): number => {
            if (!progressRef.current) return 0;
            const rect = progressRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
            return Math.round(state.duration * ratio);
        };
        
        setPosition(getSeekPosition(e.clientX));

        const handleMouseMove = (moveEvent: MouseEvent) => {
            setPosition(getSeekPosition(moveEvent.clientX));
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            
            const finalPosition = getSeekPosition(upEvent.clientX);
            player.seek(finalPosition).then(() => {
                setPosition(finalPosition);
                lastSeekTime.current = Date.now(); // Record seek time
                setIsSeeking(false); // Set seeking to false immediately
            });
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [player, state.duration]);
    
    const progressPercentage = state.duration > 0 ? (position / state.duration) * 100 : 0;
    
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

    // Sync with external state only when not actively seeking
    useEffect(() => {
        if (!isSeeking) {
            setLocalPosition(progress.position);
        }
    }, [progress.position, isSeeking]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current) return;
        onSeekStart(); // Tell parent we are starting to seek

        const getSeekPosition = (clientX: number): number => {
            if (!progressRef.current || !progress.duration) return 0;
            const rect = progressRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
            return progress.duration * ratio;
        };

        const newPos = getSeekPosition(e.clientX);
        setLocalPosition(newPos); // Update visual state immediately
        onSeek(newPos); // Tell parent to seek the player immediately (authoritative)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const movePos = getSeekPosition(moveEvent.clientX);
            setLocalPosition(movePos); // Update visual state immediately on drag
            onSeek(movePos); // Tell parent to seek the player immediately (authoritative)
        };

        const handleMouseUp = (upEvent: MouseEvent) => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            onSeekEnd(); // Tell parent we are done seeking
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [onSeek, onSeekStart, onSeekEnd, progress.duration]);

    // Display our local, instantly-updated position while seeking, otherwise use the prop from the player.
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


const QueuePopover = ({ isNight, nextTrack, position, onClose, isClosing }: { isNight: boolean, nextTrack: SpotifyTrack | null, position: { bottom: number, left: number, transform: string }, onClose: () => void, isClosing: boolean }) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

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
                    <img src={nextTrack.album.images[0].url} alt={nextTrack.name} className="w-10 h-10 rounded-md flex-shrink-0" />
                    <div className="overflow-hidden">
                        <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nextTrack.name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>{nextTrack.artists.map(a => a.name).join(', ')}</p>
                    </div>
                </div>
            ) : (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nessuna canzone in coda.</p>
            )}
        </div>,
        document.getElementById('portal-root')!
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
  const { accessToken, logout, setDeviceId, isAuthenticated, nowPlaying, setNowPlaying, _setPlayerState, volume, setVolume, silentRefreshToken, setPlayerAsReadyForAutoplay, youTubeFavorites, onToggleYouTubeFavorite, playYouTube } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('connecting');
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [isAutoQueueEnabled, setIsAutoQueueEnabled] = useState(false);
    
    const [showQueue, setShowQueue] = useState(false);
    const [isQueuePopoverRendered, setIsQueuePopoverRendered] = useState(false);
    const queuePopoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isLiked, setIsLiked] = useState(false);

    const queueButtonRef = useRef<HTMLButtonElement>(null);
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
    const currentTrackId = playerState?.track_window.current_track?.id;
    const currentTrackUri = playerState?.track_window.current_track?.uri;
    const internalVolumeUpdate = useRef(false);
  const tokenRef = useRef<string | null>(accessToken);
  useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

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
    
    // FIX #2: Maintain the last YouTube video ID to prevent the player from being re-created
    // when the source changes to something else and `youtubeTrack` becomes null.
    useEffect(() => {
        if (source === 'youtube' && youtubeTrack?.videoId) {
            setCurrentYouTubeVideoId(youtubeTrack.videoId);
        }
    }, [source, youtubeTrack]);
    
    // FIX #2: Add an effect to explicitly pause the YouTube player if the media source changes away from it.
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
            console.log("End of YouTube playlist.");
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
                
                // Handle progress update
                if (playerState === 1 && !isYouTubeSeeking) { // PLAYING
                    if (duration > 0) {
                        setYouTubeProgress({ position, duration });
                    }
                }
                
                // A track is considered finished if its state is ENDED (0),
                // OR if its current time is very close to the end. This second condition
                // helps catch cases where the ENDED event is missed in a throttled background tab.
                const hasFinished = playerState === 0 || (duration > 0 && position >= duration - 0.6);

                if (hasFinished && !hasEndedRef.current) {
                    hasEndedRef.current = true;
                    console.log(`Polling detected YouTube track end (state=${playerState}, pos=${position.toFixed(2)}, dur=${duration.toFixed(2)}). Advancing.`);
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
        if (!accessToken) {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
            setPlayerStatus('connecting');
            _setPlayerState(null);
            return;
        }

        const scriptId = 'spotify-sdk';
        if (document.getElementById(scriptId) && window.Spotify && !playerRef.current) {
             window.onSpotifyWebPlaybackSDKReady();
             return;
        }
        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

    window.onSpotifyWebPlaybackSDKReady = () => {
         if (playerRef.current || !accessToken) return;
 
         setPlayerStatus('connecting');
         const player = new window.Spotify.Player({
             name: 'DrivingOS',
            getOAuthToken: cb => {
              if (tokenRef.current) cb(tokenRef.current);
            },
             volume: 0.5
         });
 
         player.on('ready', async ({ device_id }) => {
             console.log('Player SDK pronto. Tento di attivare il contesto audio...');
             await player.activateElement();
             console.log('Contesto audio attivato.');
             
             setDeviceId(device_id);
             setPlayerStatus('ready');
             setPlayerAsReadyForAutoplay();
         });
 
         player.on('not_ready', () => {
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
 
        const handleGenericError = (error: { message: string }) => {
          console.error("Spotify Player Error:", error.message);
          setPlayerStatus('error');
        };
        player.on('initialization_error', handleGenericError);
        player.on('account_error', handleGenericError);
        player.on('authentication_error', async (error: { message: string }) => {
          console.warn("Spotify authentication_error:", error.message);
          try {
            await silentRefreshToken();
            const state = await player.getCurrentState();
            if (!state) {
              console.warn("[Spotify] State nullo dopo refresh → reconnect necessario.");
              playerRef.current?.disconnect();
              playerRef.current = null;
              setPlayerStatus('connecting');
              if (window.onSpotifyWebPlaybackSDKReady) {
                window.onSpotifyWebPlaybackSDKReady();
              }
            } else {
              console.log("[Spotify] Token refresh ok, playback in corso non interrotto 🎵");
            }
          } catch (e) {
            console.error("Refresh fallito dopo authentication_error. Logout.", e);
            logout();
          }
        });
 
         player.connect();
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
        if (!isAutoQueueEnabled || !playerState || playerState.paused) {
            return;
        }
        const { duration, position } = playerState;
        const timeLeft = duration - position;
        if (duration > 0 && timeLeft < 15000 && timeLeft > 0 && !showQueue) {
            setShowQueue(true);
        }
    }, [playerState, isAutoQueueEnabled, showQueue]);

    const prevTrackUri = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (isAutoQueueEnabled && prevTrackUri.current && prevTrackUri.current !== currentTrackUri) {
            setShowQueue(false);
        }
        prevTrackUri.current = currentTrackUri;
    }, [currentTrackUri, isAutoQueueEnabled]);

    useEffect(() => {
        const playerEl = playerContainerRef.current;
        if (!showQueue || !playerEl) return;

        let animationFrameId: number;

        const calculatePosition = () => {
            const playerRect = playerEl.getBoundingClientRect();
            setPopoverPosition({
                bottom: window.innerHeight - playerRect.top + 16,
                left: playerRect.right - 288,
                transform: '',
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
    }, [showQueue]);

    useEffect(() => {
        if (queuePopoverTimeoutRef.current) {
            clearTimeout(queuePopoverTimeoutRef.current);
        }
        if (showQueue) {
            setIsQueuePopoverRendered(true);
        } else {
            queuePopoverTimeoutRef.current = setTimeout(() => {
                setIsQueuePopoverRendered(false);
            }, 300);
        }
    }, [showQueue]);

    useEffect(() => {
        const checkIsLiked = async () => {
            if (!currentTrackId) return;
            try {
                const { data } = await apiClient.get(`/me/tracks/contains?ids=${currentTrackId}`);
                setIsLiked(data[0] || false);
            } catch (e) {
                console.error("Failed to check if track is liked", e);
                setIsLiked(false);
            }
        };
        checkIsLiked();
    }, [currentTrackId]);

    const handleYoutubeReady = (event: { target: any }) => {
        youtubePlayerRef.current = event.target;
        youtubePlayerRef.current.setVolume(volume * 100);
    };

    const handleYoutubeStateChange = (event: { data: number }) => {
        const playerState = event.data;
        const playerIsPlaying = playerState === 1; // 1 = PLAYING
        setIsYouTubePlaying(playerIsPlaying);
    
        if (playerIsPlaying) {
            hasEndedRef.current = false; // Reset the ended flag when a new video starts
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
            if (playerState === 1) { // 1 = playing
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
        if (!currentTrackId) return;
        try {
            if (isLiked) {
                await apiClient.delete(`/me/tracks`, { data: { ids: [currentTrackId] } });
                setIsLiked(false);
            } else {
                await apiClient.put(`/me/tracks`, { ids: [currentTrackId] });
                setIsLiked(true);
            }
        } catch (e) {
            console.error("Failed to update like status", e);
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
    
    const handleToggleAutoQueue = () => {
        setIsAutoQueueEnabled(prev => {
            const newState = !prev;
            if (!newState) {
                setShowQueue(false);
            }
            return newState;
        });
    };
    
    // FIX #1: Authoritative seek handler. Only commands the player.
    const handleSeekYouTube = useCallback((position: number) => {
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(position, true);
        }
    }, []);
    
    // FIX #1: Handler to set the seeking flag to true.
    const handleYouTubeSeekStart = useCallback(() => {
        setIsYouTubeSeeking(true);
    }, []);
    
    // FIX #1: Handler to set the seeking flag to false and resync state.
    const handleYouTubeSeekEnd = useCallback(() => {
        setIsYouTubeSeeking(false);
        // Optional: Force a progress update immediately after seek to resync UI
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
            const transformX = -otherWidgetWidth / 2 - 8;
            baseStyle = {
                width: `${width}px`,
                height: `${height}px`,
                bottom: `${bottom}px`,
                left: '50%',
                transform: `translateX(calc(-50% + ${transformX}px))`,
            };
        }
        baseStyle.background = !isNight ? widgetBgColor : 'var(--player-bg)';
        return baseStyle;
    }, [isAnyAppOpen, dockedConfig, floatingConfig, widgetBgColor, isNight]);

    const themeClasses = isNight 
        ? 'border-zinc-700/80' 
        : 'border-zinc-300';
    
    const renderPlayerContent = () => {
        if (nowPlaying.isLoading) {
            return (
                <div className="w-full h-full flex items-center gap-5 px-4 animate-pulse" style={{backgroundColor: 'var(--player-bg)'}}>
                    <div className={`w-12 h-12 rounded-lg flex-shrink-0 ${isNight ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                    <div className="flex-grow overflow-hidden space-y-2">
                        <div className={`h-4 rounded w-3/4 ${isNight ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                        <div className={`h-3 rounded w-1/2 ${isNight ? 'bg-zinc-700' : 'bg-zinc-200'}`} />
                    </div>
                    <div className="flex-shrink-0">
                        <FiLoader className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'} animate-spin`} />
                    </div>
                </div>
            );
        }

        if (source === 'youtube' && youtubeTrack) {
            const { title, channelTitle, thumbnail } = youtubeTrack;
            const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
            const isYouTubePlaylist = youtubePlaylist && youtubePlaylist.length > 0;
            const isFavorite = youTubeFavorites.includes(youtubeTrack.videoId);

            return (
                 <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-3 min-w-0">
                            <img src={thumbnail} alt={title} className="w-12 h-12 rounded-lg object-cover" />
                            <div className="overflow-hidden">
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
                            <button onClick={() => onToggleYouTubeFavorite(youtubeTrack.videoId)} className="transition" style={{ color: isFavorite ? buttonActiveColor : (isNight ? '#464646' : '#b0b0b0') }}>
                                <FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} className={`${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                        <div className="flex-1 flex justify-end items-center"></div>
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
                            {favicon ? <img src={favicon} alt={name} className="w-12 h-12 rounded-lg object-contain bg-zinc-800" /> : <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}><FiRadio className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} /></div>}
                            <div className="overflow-hidden">
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
                            {imageUrl && <img src={imageUrl} alt={album.name} className="w-12 h-12 rounded-lg" />}
                            <div className="overflow-hidden">
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
                        <SpotifyProgressBar player={playerRef.current} state={playerState} />
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
                            <button ref={queueButtonRef} onClick={handleToggleAutoQueue} className={`p-1 rounded-full transition-all duration-200`} style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}>
                                <BsList style={{ width: '20px', height: '20px'}} />
                            </button>
                        </div>
                    </div>
                    {isQueuePopoverRendered && (
                        <QueuePopover
                            isNight={isNight}
                            nextTrack={playerState.track_window.next_tracks[0]}
                            position={popoverPosition}
                            isClosing={!showQueue}
                            onClose={() => setShowQueue(false)}
                        />
                    )}
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
                     <div className={`w-12 h-12 rounded-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className="overflow-hidden">
                        <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)'}}>Spotify</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)'}}>Accedi con Spotify</div>
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