
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../spotifyClient';
import { useUIConfig } from '../context/UIConfigContext';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiRadio, FiSmartphone, FiMonitor, FiSpeaker, FiTv, FiTablet, FiCast, FiHeadphones, FiBluetooth
} from 'react-icons/fi';
import { 
    IoGameControllerOutline
} from 'react-icons/io5';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { BsList } from 'react-icons/bs';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';
import type { RadioStation, YouTubeTrackInfo, SpotifyDevice } from '../types';
import { getPlayerInstance, getDeviceId } from '../lib/spotify-player';

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
    dragProgress: React.MutableRefObject<number | null>;
    progressBarHeight: number;
    progressBarVerticalOffset: number;
    playButtonScale: number;
    skipButtonScale: number;
}

/**
 * SpotifyProgressBar - Visual Dictatorship Version
 */
const SpotifyProgressBar = ({ player, state, height, offset }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, height: number, offset: number }) => {
    const barFillRef = useRef<HTMLDivElement>(null);
    const progressContainerRef = useRef<HTMLDivElement>(null);
    const [isSeeking, setIsSeeking] = useState(false);

    // The absolute truth of what is currently rendered on screen explicitly for seeking
    const visualPosRef = useRef<number>(state.position);
    const optimisticSeekRef = useRef<{ pos: number, ts: number } | null>(null);

    // --- PAGE VISIBILITY API ---
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                // Fetch latest state immediately when tab is in focus again
                player?.getCurrentState().catch(() => {});
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [player]);

    // --- DYNAMIC UPDATE LOOP ---
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            if (!barFillRef.current) return;

            const duration = state.duration || 1;
            let currentPos = state.position;
            
            // Se lo stato dal SDK è più recente del nostro seek ottimistico, lo annulliamo
            if (optimisticSeekRef.current && state.timestamp > optimisticSeekRef.current.ts) {
                optimisticSeekRef.current = null;
            }

            if (isSeeking) {
                currentPos = visualPosRef.current;
            } else {
                if (optimisticSeekRef.current) {
                    if (!state.paused) {
                        currentPos = optimisticSeekRef.current.pos + (Date.now() - optimisticSeekRef.current.ts);
                    } else {
                        currentPos = optimisticSeekRef.current.pos;
                    }
                } else {
                    if (!state.paused) {
                        currentPos = state.position + (Date.now() - state.timestamp);
                    }
                }
            }

            if (currentPos > duration) currentPos = duration;
            const percent = (currentPos / duration) * 100;
            
            barFillRef.current.style.width = `${Math.max(0, Math.min(100, percent))}%`;
            
            if (!isSeeking) {
                visualPosRef.current = currentPos;
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        animationFrameId = requestAnimationFrame(loop);

        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [state.position, state.paused, state.timestamp, state.duration, isSeeking]);

    // --- USER INTERACTION ---
    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressContainerRef.current || !state.duration) return;
        setIsSeeking(true);
        updateSeekVisual(e.clientX);
    }, [state.duration]);

    const updateSeekVisual = (clientX: number) => {
        if (!progressContainerRef.current || !state.duration || !barFillRef.current) return;
        const rect = progressContainerRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
        const percent = ratio * 100;
        
        barFillRef.current.style.width = `${percent}%`;
        visualPosRef.current = Math.round(state.duration * ratio);
    };

    useEffect(() => {
        if (!isSeeking) return;

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            updateSeekVisual(e.clientX);
        };

        const handleMouseUp = (e: MouseEvent) => {
            setIsSeeking(false);
            if (player && state.duration) {
                optimisticSeekRef.current = { pos: visualPosRef.current, ts: Date.now() };
                player.seek(visualPosRef.current).catch(() => {});
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isSeeking, player, state.duration]);
    
    return (
        <div
            ref={progressContainerRef}
            className="spotify-progress-bar w-full rounded-full cursor-pointer group relative bg-[var(--progress-bg)] overflow-visible flex-shrink-0"
            style={{ height: `${(height) / 16}rem`, marginTop: `${(offset) / 16}rem` }}
            onMouseDown={handleMouseDown}
        >
            <div 
                ref={barFillRef}
                className="h-full rounded-full bg-[var(--progress-fill)] relative" 
                // Initial render width
                style={{ width: `${Math.max(0, Math.min(100, (visualPosRef.current / (state.duration || 1)) * 100))}%` }} 
            >
                 <div 
                    className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-[var(--progress-fill)] opacity-100"
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
    height,
    offset,
}: {
    progress: { position: number; duration: number };
    isSeeking: boolean;
    onSeek: (position: number) => void;
    onSeekStart: () => void;
    onSeekEnd: () => void;
    height: number;
    offset: number;
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
    const visualPercentage = Math.min(100, Math.max(0, progressPercentage));

    return (
        <div
            ref={progressRef}
            className="w-full rounded-full cursor-pointer group bg-[var(--progress-bg)] overflow-visible flex-shrink-0"
            style={{ height: `${(height) / 16}rem`, marginTop: `${(offset) / 16}rem` }}
            onMouseDown={handleMouseDown}
        >
            <div className="h-full rounded-full bg-[var(--progress-fill)] relative" style={{ width: `${visualPercentage}%` }}>
                <div 
                    className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-[var(--progress-fill)] opacity-100"
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
                height: `${(height) / 16}rem`,
                width: `${(width) / 16}rem`,
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
        const style = { width: '1.375rem', height: '1.375rem' };
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
                    <p className={`text-[0.625rem] font-bold uppercase tracking-wider ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>In riproduzione su</p>
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

const DisabledPlayerView = ({ 
    isNight, 
    playerControlsSize, 
    playerControlsGap, 
    playerControlsVerticalPosition, 
    dayPlayerButtonColor, 
    nightPlayerButtonColor,
    progressBarHeight,
    progressBarVerticalOffset,
    playButtonScale,
    skipButtonScale
}: Omit<MusicPlayerProps, 'onStationChange' | 'activeApp' | 'favoriteStationUUIDs' | 'onToggleFavorite' | 'queuePopoverHeight' | 'queuePopoverBottomOffset' | 'queuePopoverScale' | 'queuePopoverWidth' | 'queuePopoverOffsetX' | 'dockedConfig' | 'floatingConfig' | 'isAnyAppOpen' | 'widgetBgColor' | 'spinnerSize' | 'spinnerShuffleGap' | 'debugSpinner' | 'spinnerTop' | 'spinnerRight' | 'spinnerBottom' | 'spinnerLeft' | 'dragProgress'>) => {
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
            <div 
                className="w-full rounded-full cursor-not-allowed bg-[var(--progress-bg)] overflow-hidden flex-shrink-0" 
                style={{ height: `${(progressBarHeight) / 16}rem`, marginTop: `${(progressBarVerticalOffset) / 16}rem` }}
            />
            {/* Controls */}
            <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                <div className="flex-1 flex justify-start"></div>
                <div className="flex items-center" style={{ gap: `${(playerControlsGap) / 16}rem` }}>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: buttonColor }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z"/></svg>
                    </button>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: buttonColor }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
                    </button>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: buttonColor }}>
                        <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
                    </button>
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed transition" style={{ color: inactiveButtonColor }}><FiHeart style={{ width: `${(playerControlsSize * 0.9) / 16}rem`, height: `${(playerControlsSize * 0.9) / 16}rem`}} /></button>
                </div>
                <div className="flex-1 flex justify-end items-center">
                    <button disabled={!isReady} className="disabled:opacity-40 cursor-not-allowed p-1 rounded-full transition-all duration-200" style={{ color: inactiveButtonColor }}>
                        <BsList style={{ width: '1.25rem', height: '1.25rem'}} />
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
    dragProgress,
    progressBarHeight,
    progressBarVerticalOffset,
    playButtonScale,
    skipButtonScale
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
    
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobileOrTablet = windowWidth < 900;
    
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const playerEl = playerContainerRef.current;
        if (!playerEl) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const width = entry.contentRect.width;
                // Detect when the music player container width is less than 440px (threshold where items start overflow-clipping)
                setIsOverflowing(width < 440);
            }
        });

        observer.observe(playerEl);
        return () => observer.disconnect();
    }, []);

    const effectiveControlsGap = isMobileOrTablet 
        ? (isAnyAppOpen 
            ? (isOverflowing ? 33 : 18) 
            : 100) 
        : 100;
    
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

    const { sceneTransitionSpeed = 1.10 } = useUIConfig();

    // --- ANIMATION LOGIC FOR PLAYER SIZE/POSITION ---
    const visualState = useRef(isAnyAppOpen ? 0 : 1); // 0 = Docked (App Open), 1 = Floating (App Closed)
    const wasDraggingRef = useRef(false);

    const lastIsAnyAppOpen = useRef(isAnyAppOpen);
    const startT = useRef(isAnyAppOpen ? 0 : 1);
    const animStartTime = useRef(0);

    // Sync isAnyAppOpen changes to start an animation using the exact same power4.out easing/timing as subapps
    useEffect(() => {
        if (isAnyAppOpen !== lastIsAnyAppOpen.current) {
            lastIsAnyAppOpen.current = isAnyAppOpen;
            startT.current = visualState.current;
            animStartTime.current = performance.now();
        }
    }, [isAnyAppOpen]);

    // Single unified requestAnimationFrame loop that handles BOTH manual dragging AND smooth, beautifully easing transitions in real-time
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            const duration = (sceneTransitionSpeed || 1.10) * 1000; // ms

            if (dragProgress.current !== null) {
                wasDraggingRef.current = true;
                visualState.current = dragProgress.current;
                animStartTime.current = 0; // stop autotransition
            } else {
                const targetT = isAnyAppOpen ? 0 : 1;
                if (animStartTime.current > 0) {
                    const elapsed = performance.now() - animStartTime.current;
                    const normT = Math.min(elapsed / duration, 1.0);
                    // Match power4.out easing perfectly: 1 - (1 - x)^4
                    const easeT = 1 - Math.pow(1 - normT, 4);
                    visualState.current = startT.current + (targetT - startT.current) * easeT;
                    if (normT >= 1.0) {
                        animStartTime.current = 0;
                    }
                } else {
                    visualState.current = targetT;
                }
            }

            const t = Math.max(0, Math.min(1, visualState.current));

            if (playerContainerRef.current) {
                // Absolutely NO transitions or delays; the layout updates frame-by-frame on RAF in full synchronization
                playerContainerRef.current.style.transition = 'none';

                const isStacked = window.innerWidth < 900;
                const pct = 50 * t;
                const offsetPx = isStacked
                    ? dockedConfig.left * (1 - t) - (floatingConfig.width / 2) * t
                    : dockedConfig.left * (1 - t) - (floatingConfig.width / 2 + floatingConfig.otherWidgetWidth / 2 + 8) * t;
                
                const currentWidth = dockedConfig.width + (floatingConfig.width - dockedConfig.width) * t;
                const currentHeight = dockedConfig.height + (floatingConfig.height - dockedConfig.height) * t;
                const currentBottom = dockedConfig.bottom + (floatingConfig.bottom - dockedConfig.bottom) * t;

                playerContainerRef.current.style.width = `${(currentWidth) / 16}rem`;
                playerContainerRef.current.style.height = `${(currentHeight) / 16}rem`;
                playerContainerRef.current.style.bottom = `${(currentBottom) / 16}rem`;
                playerContainerRef.current.style.left = `calc(${pct}% + ${(offsetPx) / 16}rem)`;
                playerContainerRef.current.style.transform = 'none';
            }

            animationFrameId = requestAnimationFrame(loop);
        };

        loop();

        return () => cancelAnimationFrame(animationFrameId);
    }, [dockedConfig, floatingConfig, dragProgress, isAnyAppOpen, sceneTransitionSpeed]);

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
    // FIX: Relaxed checking. We allow playerState to exist even if 'player' instance (SDK) isn't fully ready yet.
    // This supports the optimistic UI state hydrated from localStorage in AuthContext.
    const isPlayerActive = playerState && playerState.track_window.current_track;
    
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
            const isCurrentlyPaused = playerState?.paused || !isPlayerActive;

            // OPTIMISTIC UI: Aggiorniamo istantaneamente il contesto
            setNowPlaying(prev => {
                if (!prev.spotifyState) return prev;
                const timeSinceUpdate = Date.now() - prev.spotifyState.timestamp;
                const newPos = prev.spotifyState.paused ? prev.spotifyState.position : prev.spotifyState.position + timeSinceUpdate;
                return {
                    ...prev,
                    spotifyState: {
                        ...prev.spotifyState,
                        paused: !isCurrentlyPaused,
                        position: newPos,
                        timestamp: Date.now()
                    }
                };
            });

            if (isCurrentlyPaused) {
                // Resume
                (async () => {
                    try {
                        if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                        await play({});
                    } catch (e) {
                        console.warn("Local play failed or device inactive, applying FALLBACK play...");
                        const deviceId = getDeviceId();
                        if (deviceId) {
                            const lastCtx = localStorage.getItem("spotify_last_context");
                            const lastUr = localStorage.getItem("spotify_last_track");
                            const lastPos = localStorage.getItem("spotify_last_position");

                            const body: any = {};
                            if (lastCtx && lastCtx !== "undefined") body.context_uri = lastCtx;
                            else if (lastUr && lastUr !== "undefined") body.uris = [lastUr];
                            if (lastPos && lastPos !== "undefined") body.position_ms = parseInt(lastPos, 10);
                            
                            try {
                                await apiClient.put(`/me/player/play?device_id=${deviceId}`, body);
                                console.log("REST API Fallback Play succeeded.");
                            } catch (err) {
                                console.error("REST API Fallback Play failed:", err);
                            }
                        }
                    }
                })();
            } else {
                // Pause
                (async () => {
                    try {
                        await pauseSpotify();
                        if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                    } catch (e) {
                        const deviceId = getDeviceId();
                        if (deviceId) {
                            try { await apiClient.put(`/me/player/pause?device_id=${deviceId}`); } catch (err) { console.error(err); }
                        }
                    }
                })();
            }
        } else if (source === 'radio') {
            const audio = audioRef.current;
            if (audio) {
                if (audio.paused) {
                    try { audio.play(); } catch(e) { console.error("Failed to play radio stream:", e); }
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

    const handleNextTrack = async () => {
        if (source === 'spotify') {
            try {
                if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                await player?.nextTrack();
            } catch (e) {
                const deviceId = getDeviceId();
                if (deviceId) {
                    console.log("Fallback nextTrack via REST API");
                    apiClient.post(`/me/player/next?device_id=${deviceId}`).catch(console.error);
                }
            }
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
    
    const handlePrevTrack = async () => {
        if (source === 'spotify') {
            try {
                if (!isPlayerActive) throw new Error("NO_ACTIVE_DEVICE");
                await player?.previousTrack();
            } catch (e) {
                const deviceId = getDeviceId();
                if (deviceId) {
                    console.log("Fallback previousTrack via REST API");
                    apiClient.post(`/me/player/previous?device_id=${deviceId}`).catch(console.error);
                }
            }
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
        
        // Optimistic UI update
        setNowPlaying(prev => prev.spotifyState ? {
            ...prev,
            spotifyState: {
                ...prev.spotifyState,
                shuffle: !prev.spotifyState.shuffle
            }
        } : prev);
        
        apiClient.put(`/me/player/shuffle?state=${!playerState.shuffle}`).catch(e => console.error("Failed to toggle shuffle", e));
    };

    const handleToggleRepeat = () => {
        if (!playerState || !player) return;
        const nextState = (playerState.repeat_mode + 1) % 3;
        const repeatMode = nextState === 0 ? 'off' : nextState === 1 ? 'context' : 'track';
        
        // Optimistic UI update
        setNowPlaying(prev => prev.spotifyState ? {
            ...prev,
            spotifyState: {
                ...prev.spotifyState,
                repeat_mode: nextState
            }
        } : prev);
        
        apiClient.put(`/me/player/repeat?state=${repeatMode}`).catch(e => console.error("Failed to toggle repeat", e));
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
                        <div className={`flex items-center min-w-0 ${isAnyAppOpen ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3'}`}>
                            <img src={thumbnail} alt={title} className={`${isAnyAppOpen ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12'} rounded-lg object-cover flex-shrink-0 shadow-lg`} />
                            <div className={`overflow-hidden flex-grow ${isAnyAppOpen ? 'min-w-0 shrink' : ''}`}>
                                <div className={`font-semibold truncate ${isAnyAppOpen ? 'text-xs sm:text-sm' : 'text-sm'}`} style={{ color: 'var(--text-primary)' }}>{title}</div>
                                <div className={`truncate ${isAnyAppOpen ? 'text-[10px] sm:text-xs' : 'text-xs'}`} style={{ color: 'var(--text-secondary)' }}>{channelTitle}</div>
                            </div>
                        </div>
                    </div>
                    <YouTubeProgressBar 
                        progress={youTubeProgress} 
                        isSeeking={isYouTubeSeeking}
                        onSeek={handleSeekYouTube}
                        onSeekStart={handleYouTubeSeekStart}
                        onSeekEnd={handleYouTubeSeekEnd}
                        height={progressBarHeight}
                        offset={progressBarVerticalOffset}
                    />
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                        <div className={`transition-all duration-300 ${isAnyAppOpen ? 'flex-none w-0 sm:flex-1' : 'flex-1'}`}></div>
                        <div 
                            className={isAnyAppOpen ? "flex items-center shrink" : "flex items-center"} 
                            style={{ gap: `${(effectiveControlsGap) / 16}rem` }}
                        >
                            <button onClick={handlePrevTrack} className={`transition ${!isYouTubePlaylist ? 'opacity-30' : ''}`} style={{ color: buttonActiveColor }} disabled={!isYouTubePlaylist}>
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z"/></svg>
                            </button>
                            <button onClick={handleTogglePlay} style={{ color: buttonActiveColor }}>
                                {isYouTubePlaying
                                    ? <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 -960 960 960" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M601.92-220q-18.51 0-31.94-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q583.41-740 601.92-740h70q18.51 0 31.95 13.44 13.44 13.44 13.44 31.95v429.22q0 18.51-13.44 31.95Q690.43-220 671.92-220h-70Zm-313.84 0q-18.51 0-31.95-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q269.57-740 288.08-740h70.38q18.21 0 31.8 13.44t13.59 31.95v429.22q0 18.51-13.59 31.95Q376.67-220 358.46-220h-70.38Z"/></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
                                }
                            </button>
                            <button onClick={handleNextTrack} className={`transition ${!isYouTubePlaylist ? 'opacity-30' : ''}`} style={{ color: buttonActiveColor }} disabled={!isYouTubePlaylist}>
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
                            </button>
                        </div>
                        <div className={`flex-1 flex justify-end items-center ${isAnyAppOpen ? 'shrink-0' : ''}`}>
                            <button ref={youTubeQueueButtonRef} onClick={() => handleToggleQueue('youtube')} className={`p-1 rounded-full transition-all duration-200`} style={{ color: visibleQueue === 'youtube' ? buttonActiveColor : (isNight ? '#464646' : '#b0b0b0') }}>
                                <BsList className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
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
                        <div className={`flex items-center min-w-0 ${isAnyAppOpen ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3'}`}>
                            {favicon ? 
                                <img src={favicon} alt={name} className={`${isAnyAppOpen ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12'} rounded-lg object-contain bg-zinc-800 flex-shrink-0 shadow-lg`} /> 
                                : 
                                <div className={`${isAnyAppOpen ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12'} rounded-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    <FiRadio className={`${isAnyAppOpen ? 'w-6 h-6 sm:w-7 sm:h-7' : 'w-7 h-7'} ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                                </div>
                            }
                            <div className={`overflow-hidden flex-grow ${isAnyAppOpen ? 'min-w-0 shrink' : ''}`}>
                                <div className={`font-semibold truncate ${isAnyAppOpen ? 'text-xs sm:text-sm' : 'text-sm'}`} style={{ color: 'var(--text-primary)' }}>{name}</div>
                                <div className={`truncate ${isAnyAppOpen ? 'text-[10px] sm:text-xs' : 'text-xs'}`} style={{ color: 'var(--text-secondary)'}}>{tags.split(',')[0] || 'Radio'}</div>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="w-full rounded-full bg-[var(--progress-bg)] flex-shrink-0"
                        style={{ height: `${(progressBarHeight) / 16}rem`, marginTop: `${(progressBarVerticalOffset) / 16}rem` }}
                    />
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                        <div className={`transition-all duration-300 ${isAnyAppOpen ? 'flex-none w-0 sm:flex-1' : 'flex-1'}`}></div>
                        <div 
                            className={isAnyAppOpen ? "flex items-center shrink" : "flex items-center"} 
                            style={{ gap: `${(effectiveControlsGap) / 16}rem` }}
                        >
                            <button onClick={handlePrevTrack} className={`transition`} style={{ color: buttonActiveColor }}>
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z"/></svg>
                            </button>
                            <button onClick={handleTogglePlay} style={{ color: buttonActiveColor }}>
                                {isRadioPlaying
                                    ? <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 -960 960 960" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M601.92-220q-18.51 0-31.94-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q583.41-740 601.92-740h70q18.51 0 31.95 13.44 13.44 13.44 13.44 31.95v429.22q0 18.51-13.44 31.95Q690.43-220 671.92-220h-70Zm-313.84 0q-18.51 0-31.95-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q269.57-740 288.08-740h70.38q18.21 0 31.8 13.44t13.59 31.95v429.22q0 18.51-13.59 31.95Q376.67-220 358.46-220h-70.38Z"/></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
                                }
                            </button>
                            <button onClick={handleNextTrack} className={`transition`} style={{ color: buttonActiveColor }}>
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
                            </button>
                            <button onClick={() => onToggleFavorite(radioStation)} className={`transition`} style={{ color: isFavorite ? buttonActiveColor : (isNight ? '#464646' : '#b0b0b0') }}>
                                <FiHeart style={{ width: `${(playerControlsSize * (isAnyAppOpen ? 0.8 : 0.9)) / 16}rem`, height: `${(playerControlsSize * (isAnyAppOpen ? 0.8 : 0.9)) / 16}rem`}} className={`${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                        <div className={`flex-1 flex justify-end items-center ${isAnyAppOpen ? 'shrink-0' : ''}`}></div>
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
                        <div className={`flex items-center min-w-0 ${isAnyAppOpen ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3'}`}>
                            {imageUrl && (
                                <div className="flex-shrink-0">
                                    <img src={imageUrl} alt={album.name} className={`${isAnyAppOpen ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12'} rounded-lg shadow-lg`} />
                                </div>
                            )}
                            <div className={`overflow-hidden flex-grow ${isAnyAppOpen ? 'min-w-0 shrink' : ''}`}>
                                <div className={`font-semibold truncate ${isAnyAppOpen ? 'text-xs sm:text-sm' : 'text-sm'}`} style={{ color: 'var(--text-primary)' }}>{trackName}</div>
                                <div className={`truncate ${isAnyAppOpen ? 'text-[10px] sm:text-xs' : 'text-xs'}`} style={{ color: 'var(--text-secondary)' }}>{artists.map(a => a.name).join(', ')}</div>
                            </div>
                        </div>
                        <div className={`flex items-center flex-shrink-0 pl-2 ${isAnyAppOpen ? 'gap-2 sm:gap-5' : 'gap-5'}`}>
                            <div className="flex items-center" style={{ gap: `${(spinnerShuffleGap) / 16}rem`}}>
                                <button
                                    onClick={handleToggleShuffle}
                                    className="transition"
                                    style={{ color: playerState.shuffle ? buttonActiveColor : inactiveButtonColor }}
                                    aria-label={playerState.shuffle ? "Disable shuffle" : "Enable shuffle"}
                                >
                                    <PiShuffleBold className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
                                </button>
                            </div>
                            <button
                                onClick={handleToggleRepeat}
                                className="transition"
                                style={{ color: playerState.repeat_mode > 0 ? buttonActiveColor : inactiveButtonColor }}
                                aria-label={`Set repeat mode. Current: ${playerState.repeat_mode === 0 ? 'off' : playerState.repeat_mode === 1 ? 'context' : 'track'}`}
                            >
                                {playerState.repeat_mode === 2 ? (
                                    <PiRepeatOnceBold className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
                                ) : (
                                    <PiRepeatBold className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
                                )}
                            </button>
                        </div>
                    </div>
                    
                    <SpotifyProgressBar 
                        player={player} 
                        state={playerState} 
                        height={progressBarHeight} 
                        offset={progressBarVerticalOffset} 
                    />
                    
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                         <div className={`transition-all duration-300 ${isAnyAppOpen ? 'flex-none w-0 sm:flex-1' : 'flex-1'}`}></div>
                        <div 
                            className={isAnyAppOpen ? "flex items-center shrink" : "flex items-center"} 
                            style={{ gap: `${(effectiveControlsGap) / 16}rem` }}
                        >
                            <button onClick={handlePrevTrack} disabled={playerState.disallows.skipping_prev} className="transition disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: buttonActiveColor }}>
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z"/></svg>
                            </button>
                            <button onClick={handleTogglePlay} style={{ color: buttonActiveColor }}>
                                {playerState.paused 
                                    ? <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 -960 960 960" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M601.92-220q-18.51 0-31.94-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q583.41-740 601.92-740h70q18.51 0 31.95 13.44 13.44 13.44 13.44 31.95v429.22q0 18.51-13.44 31.95Q690.43-220 671.92-220h-70Zm-313.84 0q-18.51 0-31.95-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q269.57-740 288.08-740h70.38q18.21 0 31.8 13.44t13.59 31.95v429.22q0 18.51-13.59 31.95Q376.67-220 358.46-220h-70.38Z"/></svg>
                                }
                            </button>
                            <button onClick={handleNextTrack} disabled={playerState.disallows.skipping_next} className="transition disabled:opacity-30 disabled:cursor-not-allowed" style={{ color: buttonActiveColor }}>
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
                            </button>
                            <button
                                onClick={handleToggleLike}
                                className="transition"
                                style={{ color: isLiked ? buttonActiveColor : inactiveButtonColor }}
                            >
                                <FiHeart style={{ width: `${(playerControlsSize * (isAnyAppOpen ? 0.8 : 0.9)) / 16}rem`, height: `${(playerControlsSize * (isAnyAppOpen ? 0.8 : 0.9)) / 16}rem`}} className={`${isLiked ? 'fill-current' : ''}`} />
                            </button>
                        </div>
                         <div className={`flex-1 flex justify-end items-center ${isAnyAppOpen ? 'shrink-0' : ''}`}>
                            <button ref={spotifyQueueButtonRef} onClick={() => handleToggleQueue('spotify')} className={`p-1 rounded-full transition-all duration-200 ${playerState.track_window.next_tracks.length === 0 ? 'opacity-40' : ''}`} style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}>
                                <BsList className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }
        
        // Default / Initial State
        return <DisabledPlayerView {...{ 
            isNight, 
            playerControlsSize, 
            playerControlsGap, 
            playerControlsVerticalPosition, 
            dayPlayerButtonColor, 
            nightPlayerButtonColor,
            progressBarHeight,
            progressBarVerticalOffset,
            playButtonScale,
            skipButtonScale
        }} />;
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
        top: spinnerTop !== undefined ? `${(spinnerTop) / 16}rem` : 'auto',
        right: spinnerRight !== undefined ? `${(spinnerRight) / 16}rem` : 'auto',
        bottom: spinnerBottom !== undefined ? `${(spinnerBottom) / 16}rem` : 'auto',
        left: spinnerLeft !== undefined ? `${(spinnerLeft) / 16}rem` : 'auto',
    };
    
    const spinnerVisualDivStyle: React.CSSProperties = {
        width: `${(spinnerSize) / 16}rem`,
        height: `${(spinnerSize) / 16}rem`,
        borderWidth: `${(Math.max(2, spinnerSize / 8)) / 16}rem`,
    };

    return (
        <>
            <div 
                ref={playerContainerRef}
                className={`fixed z-[2000] backdrop-blur-md rounded-xl shadow-lg overflow-hidden max-w-[calc(100vw-32px)] transition-all duration-500 ${themeClasses}`}
                style={{
                    // Style is now handled directly by the animation loop in useEffect
                    background: !isNight ? widgetBgColor : 'var(--player-bg)',
                    // Initial styles before JS takes over
                    width: isAnyAppOpen ? `${(dockedConfig.width) / 16}rem` : `${(floatingConfig.width) / 16}rem`,
                    height: isAnyAppOpen ? `${(dockedConfig.height) / 16}rem` : `${(floatingConfig.height) / 16}rem`,
                    bottom: isAnyAppOpen ? `${(dockedConfig.bottom) / 16}rem` : `${(floatingConfig.bottom) / 16}rem`,
                    left: isAnyAppOpen ? `${(dockedConfig.left) / 16}rem` : `calc(50% - ${(floatingConfig.width / 2 + floatingConfig.otherWidgetWidth / 2 + 8) / 16}rem)`,
                }}
            >
                <div className="relative w-full h-full">
                    {(nowPlaying.isLoading || debugSpinner) && (
                        <div className="player-spinner-overlay" style={spinnerStyle}>
                            <div className="spinner-visual" style={spinnerVisualDivStyle}></div>
                        </div>
                    )}
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
