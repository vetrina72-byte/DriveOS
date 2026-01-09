
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiRadio, FiSmartphone, FiMonitor, FiSpeaker, FiTv, FiTablet, FiCast, FiHeadphones, FiBluetooth
} from 'react-icons/fi';
import { 
    IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp, IoPlaySkipForwardSharp, IoGameControllerOutline
} from 'react-icons/io5';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { BsList } from 'react-icons/bs';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';
import type { RadioStation, YouTubeTrackInfo, SpotifyDevice } from '../types';
import { getPlayerInstance } from '../lib/spotify-player';

interface MusicPlayerProps {
    activeApp: string | null;
    onStationChange: (direction: 'next' | 'prev') => void;
    isAnyAppOpen: boolean;
    isNight: boolean;
    dockedConfig: { width: number; bottom: number; left: number; height: number; };
    floatingConfig: { width: number; bottom: number; height: number; otherWidgetWidth: number; };
    playerControlsSize: number;
    playerControlsGap: number;
    playerControlsVerticalPosition: number;
    spinnerSize: number;
    spinnerShuffleGap: number;
    debugSpinner: boolean;
    widgetBgColor: string;
    dayPlayerButtonColor: string;
    nightPlayerButtonColor: string;
    favoriteStationUUIDs: string[];
    onToggleFavorite: (station: RadioStation) => void;
    queuePopoverHeight: number;
    queuePopoverBottomOffset: number;
    queuePopoverScale: number;
    queuePopoverWidth: number;
    queuePopoverOffsetX: number;
    spinnerTop: number | undefined;
    spinnerRight: number | undefined;
    spinnerBottom: number | undefined;
    spinnerLeft: number | undefined;
}

/**
 * A seekable progress bar for the Spotify player with smooth, real-time updates.
 * This component uses `requestAnimationFrame` to interpolate the track's progress between
 * official state updates from the Spotify SDK, providing a fluid user experience. It also
 * handles user seeking (clicking and dragging) with optimistic UI updates to prevent flickering.
 */
const SpotifyProgressBar = ({ player, state }: { player: SpotifyPlayer | null, state: SpotifyPlayerState }) => {
    const [displayPosition, setDisplayPosition] = useState(state.position);
    const [isSeeking, setIsSeeking] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef(0);
    const lastStatePositionRef = useRef(state.position);
    const lastStateUpdateTimestampRef = useRef(performance.now());
    
    // Ref to ignore incoming state updates for a short period after seeking
    // This prevents the bar from "bouncing" back to the old position before the server catches up
    const ignoreRemoteUpdatesUntil = useRef(0);

    useEffect(() => {
        if (!isSeeking) {
            // Critical check: ignore stale updates right after a seek
            if (Date.now() < ignoreRemoteUpdatesUntil.current) return;

            setDisplayPosition(state.position);
            lastStatePositionRef.current = state.position;
            lastStateUpdateTimestampRef.current = performance.now();
        }
    }, [state.position, isSeeking]);

    useEffect(() => {
        if (state.paused || isSeeking) {
            cancelAnimationFrame(animationFrameRef.current);
            return;
        }
        const animate = () => {
            const timeSinceLastUpdate = performance.now() - lastStateUpdateTimestampRef.current;
            const newAnimatedPosition = lastStatePositionRef.current + timeSinceLastUpdate;
            setDisplayPosition(Math.min(newAnimatedPosition, state.duration));
            animationFrameRef.current = requestAnimationFrame(animate);
        };
        animationFrameRef.current = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameRef.current);
    }, [state.paused, state.duration, isSeeking]);
    
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !player || !state.duration) return;
        cancelAnimationFrame(animationFrameRef.current);
        setIsSeeking(true);
    }, [player, state.duration]);

    useEffect(() => {
        if (!isSeeking) return;

        const getSeekPosition = (clientX: number): number => {
            if (!progressRef.current || !state.duration) return 0;
            const rect = progressRef.current.getBoundingClientRect();
            const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
            return Math.round(state.duration * ratio);
        };

        const handleMouseMove = (e: MouseEvent) => {
            setDisplayPosition(getSeekPosition(e.clientX));
        };

        const handleMouseUp = (e: MouseEvent) => {
            const finalPosition = getSeekPosition(e.clientX);
            player?.seek(finalPosition).catch(err => console.error("Seek failed", err));
            
            // Optimistically update local state so animation continues smoothly from here
            lastStatePositionRef.current = finalPosition;
            lastStateUpdateTimestampRef.current = performance.now();
            setDisplayPosition(finalPosition);
            
            // Ignore external state updates for 1.5 seconds to allow Spotify backend to sync
            ignoreRemoteUpdatesUntil.current = Date.now() + 1500;
            
            setIsSeeking(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSeeking, player, state.duration]);
    
    const progressPercentage = state.duration > 0 ? (displayPosition / state.duration) * 100 : 0;
    
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


const QueuePopover = ({ isNight, nextTrack, position, onClose, isClosing, height, scale, width, offsetX }: { 
    isNight: boolean, 
    nextTrack: { name: string, description: string, imageUrl: string } | null, 
    position: { bottom: number, left: number, transform: string }, 
    onClose: () => void, 
    isClosing: boolean, 
    height: number, 
    scale: number,
    width: number,
    offsetX: number,
}) => {
    const popoverRef = useRef<HTMLDivElement>(null);

    return ReactDOM.createPortal(
        <div
            ref={popoverRef}
            style={{
                bottom: `${position.bottom}px`,
                left: `${position.left + offsetX}px`,
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

const RemotePlayerView = ({ device, isNight, onTakeControl }: { device: SpotifyDevice, isNight: boolean, onTakeControl: () => void }) => {
    const DeviceIcon = () => {
        const type = device.type.toLowerCase();
        const style = { width: '22px', height: '22px' };
        if (type === 'smartphone' || type === 'phone') return <FiSmartphone style={style} />;
        if (type === 'computer' || type === 'desktop' || type === 'laptop') return <FiMonitor style={style} />;
        if (type === 'speaker') return <FiSpeaker style={style} />;
        if (type === 'tv' || type === 'castvideo') return <FiTv style={style} />;
        if (type === 'tablet') return <FiTablet style={style} />;
        if (type === 'castaudio' || type === 'audio_dongle') return <FiCast style={style} />;
        if (type === 'gameconsole') return <IoGameControllerOutline style={style} />;
        return <FiBluetooth style={style} />; // Default/Generic
    };

    return (
        <div className="w-full h-full flex flex-row items-center justify-between px-6 py-2 bg-black/40 backdrop-blur-md rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 min-w-0 flex-1">
                <div className={`p-3 rounded-full flex-shrink-0 ${isNight ? 'bg-zinc-800 text-green-500' : 'bg-white text-green-600'}`}>
                    <DeviceIcon />
                </div>
                <div className="flex flex-col justify-center overflow-hidden">
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>In riproduzione su</p>
                    <h3 className={`text-base font-bold truncate ${isNight ? 'text-white' : 'text-zinc-800'}`}>
                        {device.name}
                    </h3>
                </div>
            </div>
            
            <button 
                onClick={onTakeControl}
                className="flex-shrink-0 ml-4 px-5 py-2 bg-green-500 hover:bg-green-400 text-black font-bold rounded-full text-sm transition-transform active:scale-95 shadow-lg whitespace-nowrap"
            >
                Ascolta qui
            </button>
        </div>
    );
};

const DisabledPlayerView = ({ isNight, playerControlsSize, playerControlsGap, playerControlsVerticalPosition, dayPlayerButtonColor, nightPlayerButtonColor }: Omit<MusicPlayerProps, 'onStationChange' | 'activeApp' | 'favoriteStationUUIDs' | 'onToggleFavorite' | 'queuePopoverHeight' | 'queuePopoverBottomOffset' | 'queuePopoverScale' | 'queuePopoverWidth' | 'queuePopoverOffsetX' | 'dockedConfig' | 'floatingConfig' | 'isAnyAppOpen' | 'widgetBgColor' | 'spinnerSize' | 'spinnerShuffleGap' | 'debugSpinner' | 'spinnerTop' | 'spinnerRight' | 'spinnerBottom' | 'spinnerLeft'>) => {
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
                     <div className="flex items-center">
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
    spinnerTop,
    spinnerRight,
    spinnerBottom,
    spinnerLeft,
}) => {
  const { 
      isAuthenticated, 
      nowPlaying, 
      setNowPlaying, 
      volume, 
      playYouTube, 
      play, // Imported play from AuthContext
      pauseSpotify, // Imported pauseSpotify
      isAutoplayBlocked,
      unlockAutoplay
  } = useAuth();
    const playerContainerRef = useRef<HTMLDivElement>(null);
    
    const [visibleQueue, setVisibleQueue] = useState<'spotify' | 'youtube' | null>(null);
    const [isQueueClosing, setIsQueueClosing] = useState(false);
    const [isAutoQueueEnabled, setIsAutoQueueEnabled] = useState(true);
    
    const [isLiked, setIsLiked] = useState(false);

    const spotifyQueueButtonRef = useRef<HTMLButtonElement>(null);
    const youTubeQueueButtonRef = useRef<HTMLButtonElement>(null);
    const [popoverPosition, setPopoverPosition] = useState({ bottom: 0, left: 0, transform: '' });
    
    const playerState = nowPlaying.spotifyState;
    const { radioStation, youtubeTrack, youtubePlaylist, source, activeDevice } = nowPlaying;

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
    const prevPositionRef = useRef(0);

    useEffect(() => {
        const show = nowPlaying.isLoading || debugSpinner;
        if (show) {
            console.log('🔄 [SPINNER] show');
        } else {
            console.log('🔄 [SPINNER] hide');
        }
    }, [nowPlaying.isLoading, debugSpinner]);

    const player = getPlayerInstance();
    // Check if we are active LOCALLY
    const isPlayerActive = player && playerState && playerState.track_window.current_track;
    const currentTrack = playerState?.track_window.current_track;
    const currentTrackUri = currentTrack?.uri;

    const handleToggleQueue = useCallback((source: 'spotify' | 'youtube') => {
        if (source === 'spotify') {
            const newIsEnabled = !isAutoQueueEnabled;
            setIsAutoQueueEnabled(newIsEnabled);
    
            if (!newIsEnabled && visibleQueue === 'spotify') {
                setIsQueueClosing(true);
                setTimeout(() => {
                    setVisibleQueue(null);
                    setIsQueueClosing(false);
                }, 300);
            }
        } else if (source === 'youtube') {
            if (visibleQueue === 'youtube') {
                setIsQueueClosing(true);
                setTimeout(() => {
                    setVisibleQueue(null);
                    setIsQueueClosing(false);
                }, 300);
            } else {
                setIsQueueClosing(false); 
                setVisibleQueue('youtube');
            }
        }
    }, [isAutoQueueEnabled, visibleQueue]);

    useEffect(() => {
        if (!playerState || playerState.paused || !currentTrackUri) return;

        const { position, duration, disallows } = playerState;
        const positionDelta = position - prevPositionRef.current;
        const isBackwardsSeek = positionDelta < -2000; // User seeks back > 2s
        const isNearEnd = duration > 15000 && (duration - position) < 15000;
        const canSkipNext = !disallows.skipping_next;

        if (isBackwardsSeek && !isNearEnd && visibleQueue === 'spotify') {
            // Hide popover if user seeks away from the end
            setIsQueueClosing(true);
            setTimeout(() => { setVisibleQueue(null); setIsQueueClosing(false); }, 300);
        } else if (isNearEnd && canSkipNext && isAutoQueueEnabled && visibleQueue !== 'spotify') {
            // Show popover if near the end and it's not already visible
            setIsQueueClosing(false);
            setVisibleQueue('spotify');
        }

        prevPositionRef.current = position;
    }, [playerState, currentTrackUri, visibleQueue, isAutoQueueEnabled]);

    // Effect for hiding popover on track change
    const prevTrackUri = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (prevTrackUri.current && prevTrackUri.current !== currentTrackUri) {
            if (visibleQueue === 'spotify') {
                setIsQueueClosing(true);
                setTimeout(() => { setVisibleQueue(null); setIsQueueClosing(false); }, 300);
            }
        }
        prevTrackUri.current = currentTrackUri;
    }, [currentTrackUri, visibleQueue]);
    
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
    }, [visibleQueue, queuePopoverBottomOffset]);
    
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
            if (playerState?.paused) {
                // Resume
                play({});
            } else {
                // Pause
                pauseSpotify();
            }
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
            player?.nextTrack();
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
            player?.previousTrack();
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
        if (!playerState || !player) return;
        apiClient.put(`/me/player/shuffle?state=${!playerState.shuffle}`);
    };

    const handleToggleRepeat = () => {
        if (!playerState || !player) return;
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
                transform: 'none',
            };
        } else {
            const { width, bottom, height, otherWidgetWidth } = floatingConfig;
            baseStyle = {
                width: `${width}px`,
                height: `${height}px`,
                bottom: `${bottom}px`,
                left: `calc(50% - ${otherWidgetWidth / 2}px - 8px - ${width / 2}px)`,
                transform: 'none',
            };
        }
        baseStyle.background = !isNight ? widgetBgColor : 'var(--player-bg)';
        // Use a more specific transition property to avoid animating background-color
        baseStyle.transition = 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1), height 0.5s cubic-bezier(0.4, 0, 0.2, 1), bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1), left 0.5s cubic-bezier(0.4, 0, 0.2, 1)';
        return baseStyle;
    }, [isAnyAppOpen, dockedConfig, floatingConfig, widgetBgColor, isNight]);

    const themeClasses = isNight 
        ? 'border-zinc-700/80' 
        : 'border-zinc-300';
    
    const AutoplayUnlockOverlay = () => (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-4 rounded-xl">
            <p className="text-white font-semibold text-center">L'autoplay è bloccato dal browser.</p>
            <button
                onClick={() => unlockAutoplay()}
                className="bg-[#1DB954] hover:bg-[#1AA34A] text-white font-bold py-3 px-6 rounded-full text-base transition-all transform hover:scale-105"
            >
                Riprendi musica
            </button>
        </div>
    );
    
    const renderPlayerContent = () => {
        const showSpinner = nowPlaying.isLoading ?? false;

        // --- NEW: REMOTE DEVICE VIEW ---
        // If Spotify source is active, but local player is NOT active, and we have a remote device:
        if (source === 'spotify' && !isPlayerActive && activeDevice) {
            return (
                <RemotePlayerView 
                    device={activeDevice} 
                    isNight={isNight} 
                    onTakeControl={() => play({})} 
                />
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
                                <div className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{trackName}</div>
                                <div className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{artists.map(a => a.name).join(', ')}</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                            <div className="flex items-center" style={{ gap: `${spinnerShuffleGap}px`}}>
                                <button
                                    onClick={handleToggleShuffle}
                                    className="transition"
                                    style={{ color: playerState.shuffle ? buttonActiveColor : inactiveButtonColor }}
                                    aria-label={playerState.shuffle ? "Disable shuffle" : "Enable shuffle"}
                                >
                                    <PiShuffleBold className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={handleToggleRepeat}
                                className="transition"
                                style={{ color: playerState.repeat_mode > 0 ? buttonActiveColor : inactiveButtonColor }}
                                aria-label={`Set repeat mode. Current: ${playerState.repeat_mode === 0 ? 'off' : playerState.repeat_mode === 1 ? 'context' : 'track'}`}
                            >
                                {playerState.repeat_mode === 2 ? <PiRepeatOnceBold className="w-5 h-5" /> : <PiRepeatBold className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    
                    <SpotifyProgressBar player={player} state={playerState} />
                    
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                         <div className="flex-1 flex justify-start"></div>
                        <div className="flex items-center" style={{ gap: `${playerControlsGap}px` }}>
                            <button onClick={handlePrevTrack} disabled={playerState.disallows.skipping_prev} className="transition disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: buttonActiveColor }}><IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            <button onClick={handleTogglePlay} className="transition" style={{ color: buttonActiveColor }}>
                                {playerState.paused 
                                    ? <IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /> 
                                    : <IoPauseSharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />
                                }
                            </button>
                            <button onClick={handleNextTrack} disabled={playerState.disallows.skipping_next} className="transition disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: buttonActiveColor }}><IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} /></button>
                            <button
                                onClick={handleToggleLike}
                                className="transition"
                                style={{ color: isLiked ? buttonActiveColor : inactiveButtonColor }}
                            >
                                <FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} className={`${isLiked ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                         <div className="flex-1 flex justify-end items-center">
                            <button ref={spotifyQueueButtonRef} onClick={() => handleToggleQueue('spotify')} className={`p-1 rounded-full transition-all duration-200 ${playerState.track_window.next_tracks.length === 0 ? 'opacity-40' : ''}`} style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}>
                                <BsList style={{ width: '20px', height: '20px'}} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        // Default / Initial State
        return <DisabledPlayerView {...{ isNight, playerControlsSize, playerControlsGap, playerControlsVerticalPosition, dayPlayerButtonColor, nightPlayerButtonColor }} />;
    };

    const nextSpotifyTrack = playerState?.track_window.next_tracks[0];
    const nextYouTubeTrack = nowPlaying.youtubePlaylist && nowPlaying.youtubeTrack
        ? nowPlaying.youtubePlaylist[nowPlaying.youtubePlaylist.findIndex(t => t.videoId === nowPlaying.youtubeTrack?.videoId) + 1]
        : null;

    const nextTrackDetails = useMemo(() => {
        if (visibleQueue === 'spotify' && nextSpotifyTrack) {
            return {
                name: nextSpotifyTrack.name,
                description: nextSpotifyTrack.artists.map(a => a.name).join(', '),
                imageUrl: nextSpotifyTrack.album.images[0]?.url,
            };
        }
        if (visibleQueue === 'youtube' && nextYouTubeTrack) {
            return {
                name: nextYouTubeTrack.title,
                description: nextYouTubeTrack.channelTitle,
                imageUrl: nextYouTubeTrack.thumbnail,
            };
        }
        return null;
    }, [visibleQueue, nextSpotifyTrack, nextYouTubeTrack]);

    const spinnerStyle: React.CSSProperties = {
        top: spinnerTop !== undefined ? `${spinnerTop}px` : 'auto',
        right: spinnerRight !== undefined ? `${spinnerRight}px` : 'auto',
        bottom: spinnerBottom !== undefined ? `${spinnerBottom}px` : 'auto',
        left: spinnerLeft !== undefined ? `${spinnerLeft}px` : 'auto',
    };
    
    const spinnerVisualDivStyle: React.CSSProperties = {
        width: `${spinnerSize}px`,
        height: `${spinnerSize}px`,
        borderWidth: `${Math.max(2, spinnerSize / 8)}px`,
    };

    return (
        <>
            <div 
                ref={playerContainerRef}
                className={`fixed z-[2000] backdrop-blur-md rounded-xl shadow-lg ${themeClasses}`}
                style={playerStyle}
            >
                <div className="relative w-full h-full">
                    {(nowPlaying.isLoading || debugSpinner) && (
                        <div className="player-spinner-overlay" style={spinnerStyle}>
                            <div className="spinner-visual" style={spinnerVisualDivStyle}></div>
                        </div>
                    )}
                    {isAutoplayBlocked && <AutoplayUnlockOverlay />}
                    {renderPlayerContent()}
                    <audio ref={audioRef} playsInline crossOrigin="anonymous" />
                    <div style={{ display: 'none' }}>
                        <YouTube
                            videoId={currentYouTubeVideoId}
                            opts={{
                                height: '195',
                                width: '320',
                                playerVars: {
                                    autoplay: 1,
                                    controls: 0,
                                    disablekb: 1,
                                    modestbranding: 1,
                                    playsinline: 1,
                                },
                            }}
                            onReady={handleYoutubeReady}
                            onStateChange={handleYoutubeStateChange}
                            onEnd={handleYouTubeEnd}
                        />
                    </div>
                </div>
            </div>
            {visibleQueue && (
                <QueuePopover
                    isNight={isNight}
                    nextTrack={nextTrackDetails}
                    position={popoverPosition}
                    onClose={() => setVisibleQueue(null)}
                    isClosing={isQueueClosing}
                    height={queuePopoverHeight}
                    scale={queuePopoverScale}
                    width={queuePopoverWidth}
                    offsetX={queuePopoverOffsetX}
                />
            )}
        </>
    );
};

export default React.memo(MusicPlayer);
