
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../spotifyClient';
import { useUIConfig } from '../context/UIConfigContext';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiSearch, FiRadio, FiSmartphone, FiMonitor, FiSpeaker, FiTv, FiTablet, FiCast, FiHeadphones, FiBluetooth, FiX
} from 'react-icons/fi';
import { Sparkles, Activity } from 'lucide-react';
import { 
    IoGameControllerOutline
} from 'react-icons/io5';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { BsList } from 'react-icons/bs';
import { HiOutlineQueueList, HiQueueList } from 'react-icons/hi2';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';
import type { RadioStation, YouTubeTrackInfo, SpotifyDevice } from '../types';
import { getPlayerInstance, getDeviceId } from '../lib/spotify-player';
import { isSpotifyAiDj, isSpotifyAiDjPlaying, aiDjVisualState } from '../services/AiDjVisualState';
import { cubicBezierEase } from './VehicleCanvas';
import { SPLIT_APPS_WITH_MAP_UNDER } from '../App';
import { APP_TRANSITION_DURATION } from '../context/UIConfigContext';
import { drawerLayout } from '../lib/drawerLayout';

// Lucide Player Control Icons requested by user
const PrevTrackIcon = ({ size, scale = 1 }: { size: string; scale?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ height: size, width: size, transform: `scale(${scale})`, transformOrigin: 'center' }}
    className="flex-shrink-0 block"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M17.971 4.285A2 2 0 0 1 21 6v12a2 2 0 0 1-3.029 1.715l-9.997-5.998a2 2 0 0 1-.003-3.432z" />
    <path d="M3 20V4" />
  </svg>
);

const NextTrackIcon = ({ size, scale = 1 }: { size: string; scale?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ height: size, width: size, transform: `scale(${scale})`, transformOrigin: 'center' }}
    className="flex-shrink-0 block"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 4v16" />
    <path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z" />
  </svg>
);

const PlayIcon = ({ size, scale = 1 }: { size: string; scale?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ height: size, width: size, transform: `scale(${scale})`, transformOrigin: 'center' }}
    className="flex-shrink-0 block"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
  </svg>
);

const PauseIcon = ({ size, scale = 1 }: { size: string; scale?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ height: size, width: size, transform: `scale(${scale})`, transformOrigin: 'center' }}
    className="flex-shrink-0 block"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="14" y="3" width="5" height="18" rx="1" />
    <rect x="5" y="3" width="5" height="18" rx="1" />
  </svg>
);

const SearchIcon = ({ size, scale = 1 }: { size: string; scale?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    style={{ height: size, width: size, transform: `scale(${scale})`, transformOrigin: 'center' }}
    className="flex-shrink-0 block"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m21 21-4.34-4.34" />
    <circle cx="11" cy="11" r="8" />
  </svg>
);

interface MusicPlayerProps {
    activeApp: string | null;
    onOpenApp?: (appId: string) => void;
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
 * Helper to format milliseconds into MM:SS
 */
const formatTime = (ms: number) => {
  if (!ms || isNaN(ms)) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * Helper to format remaining milliseconds into -M:SS countdown
 */
const formatRemainingTime = (ms: number) => {
  if (!ms || isNaN(ms) || ms <= 0) return '-0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `-${m}:${s < 10 ? '0' : ''}${s}`;
};

/**
 * DynamicTrackTitle - only animates if the text truly overflows its container.
 * If the title fits completely within the player, it stays static with zero movement.
 * When overflowing, it moves strictly by the overflow delta, never detaching.
 */
const DynamicTrackTitle = ({ title, isAnyAppOpen }: { title: string; isAnyAppOpen: boolean }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [overflow, setOverflow] = useState(0);

    useLayoutEffect(() => {
        const calculateOverflow = () => {
            if (containerRef.current && textRef.current) {
                const containerWidth = containerRef.current.clientWidth;
                const textWidth = textRef.current.scrollWidth;
                const diff = textWidth - containerWidth;
                setOverflow(diff > 6 ? diff : 0);
            }
        };
        calculateOverflow();
        const ro = new ResizeObserver(() => calculateOverflow());
        if (containerRef.current) ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [title, isAnyAppOpen]);

    return (
        <div 
            ref={containerRef} 
            className="font-semibold overflow-hidden whitespace-nowrap w-full text-sm" 
            style={{ color: 'var(--text-primary)' }}
        >
            <span
                ref={textRef}
                className={overflow > 0 ? 'inline-block whitespace-nowrap marquee-dynamic' : 'truncate block'}
                style={overflow > 0 ? {
                    '--marquee-offset': `-${overflow + 8}px`,
                    animationDuration: `${Math.max(6, (overflow / 20) + 4)}s`
                } as React.CSSProperties : undefined}
            >
                {title}
            </span>
        </div>
    );
};

/**
 * SpotifyProgressBar - Visual Dictatorship Version with MM:SS Timestamps
 */
const SpotifyProgressBar = ({ player, state, height, offset }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, height: number, offset: number }) => {
    const barFillRef = useRef<HTMLDivElement>(null);
    const progressContainerRef = useRef<HTMLDivElement>(null);
    const [isSeeking, setIsSeeking] = useState(false);

    // The absolute truth of what is currently rendered on screen explicitly for seeking
    const visualPosRef = useRef<number>(state.position);
    const optimisticSeekRef = useRef<{ pos: number, ts: number } | null>(null);
    const lastRenderedPosRef = useRef<number>(state.position || 0);
    const lastTrackKeyRef = useRef<string>('');

    // Local progress state incremented every second when playing
    const [progressMs, setProgressMs] = useState<number>(state.position || 0);

    const currentTrackKey = state.track_window?.current_track?.id || state.track_window?.current_track?.uri || '';

    // Reset baseline when track changes
    useEffect(() => {
        if (currentTrackKey !== lastTrackKeyRef.current) {
            lastTrackKeyRef.current = currentTrackKey;
            lastRenderedPosRef.current = state.position || 0;
            optimisticSeekRef.current = null;
        }
    }, [currentTrackKey, state.position]);

    // Sync with incoming state.position
    useEffect(() => {
        if (!isSeeking) {
            setProgressMs(state.position || 0);
        }
    }, [state.position, isSeeking]);

    // Timer incrementing progressMs every second when playing
    useEffect(() => {
        if (state.paused || isSeeking) return;

        const interval = setInterval(() => {
            setProgressMs(prev => {
                const next = prev + 1000;
                return state.duration ? Math.min(next, state.duration) : next;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [state.paused, isSeeking, state.duration]);

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

    // --- DYNAMIC UPDATE LOOP (Jitter-free and smooth with DJ/fast speech support) ---
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            if (!barFillRef.current) return;

            const duration = state.duration || 1;
            let currentPos = state.position;
            
            // Se lo stato dal SDK è più recente del nostro seek ottimistico (dopo almeno 1.5s), lo rilasciamo
            if (optimisticSeekRef.current && (Date.now() - optimisticSeekRef.current.ts > 1500) && state.timestamp > optimisticSeekRef.current.ts) {
                optimisticSeekRef.current = null;
            }

            const lastActionTs = parseInt(localStorage.getItem("last_action_ts") || "0", 10);
            const isRecentAction = Date.now() - lastActionTs < 1500;

            if (isSeeking) {
                currentPos = visualPosRef.current;
            } else if (optimisticSeekRef.current) {
                if (!state.paused && !isRecentAction) {
                    currentPos = optimisticSeekRef.current.pos + (Date.now() - optimisticSeekRef.current.ts);
                } else {
                    currentPos = optimisticSeekRef.current.pos;
                }
            } else {
                if (!state.paused && !isRecentAction) {
                    const rawElapsed = Date.now() - (state.timestamp || Date.now());
                    const safeElapsed = (rawElapsed >= 0 && rawElapsed < 120000) ? rawElapsed : 0;
                    let calculated = state.position + safeElapsed;
                    
                    // Monotonic guard: during rapid events / Spotify DJ talk, prevent progress bar from jittering backwards
                    if (calculated < lastRenderedPosRef.current && (lastRenderedPosRef.current - calculated < 3500)) {
                        calculated = lastRenderedPosRef.current;
                    }
                    currentPos = calculated;
                } else {
                    currentPos = state.position;
                }
            }

            if (currentPos > duration) currentPos = duration;
            if (currentPos < 0) currentPos = 0;
            lastRenderedPosRef.current = currentPos;

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
    const updateSeekVisual = (clientX: number) => {
        if (!progressContainerRef.current || !state.duration || !barFillRef.current) return;
        const rect = progressContainerRef.current.getBoundingClientRect();
        const ratio = Math.max(0, Math.min((clientX - rect.left) / rect.width, 1));
        const percent = ratio * 100;
        
        barFillRef.current.style.width = `${percent}%`;
        const newPos = Math.round(state.duration * ratio);
        visualPosRef.current = newPos;
        setProgressMs(newPos);
    };

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressContainerRef.current || !state.duration) return;
        setIsSeeking(true);
        updateSeekVisual(e.clientX);
    }, [state.duration]);

    const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
        if (!progressContainerRef.current || !state.duration || !e.touches[0]) return;
        setIsSeeking(true);
        updateSeekVisual(e.touches[0].clientX);
    }, [state.duration]);

    useEffect(() => {
        if (!isSeeking) return;

        const handleMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            updateSeekVisual(e.clientX);
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches[0]) {
                updateSeekVisual(e.touches[0].clientX);
            }
        };

        const finishSeek = () => {
            setIsSeeking(false);
            if (state.duration) {
                const targetPos = Math.round(visualPosRef.current);
                setProgressMs(targetPos);
                const now = Date.now();
                optimisticSeekRef.current = { pos: targetPos, ts: now };
                localStorage.setItem("last_progress_ms", String(targetPos));
                localStorage.setItem("spotify_last_position", String(targetPos));
                localStorage.setItem("last_seek_ts", String(now));
                
                // Invia ESCLUSIVAMENTE un unico comando di seek per evitare glitch audio/doppio seek
                if (player) {
                    player.seek(targetPos).catch((err) => {
                        console.warn('[SpotifyProgressBar] player.seek fallback to API:', err);
                        const deviceId = getDeviceId();
                        const seekUrl = deviceId 
                            ? `/me/player/seek?position_ms=${targetPos}&device_id=${deviceId}`
                            : `/me/player/seek?position_ms=${targetPos}`;
                        apiClient.put(seekUrl).catch(() => {});
                    });
                } else {
                    const deviceId = getDeviceId();
                    const seekUrl = deviceId 
                        ? `/me/player/seek?position_ms=${targetPos}&device_id=${deviceId}`
                        : `/me/player/seek?position_ms=${targetPos}`;
                    apiClient.put(seekUrl).catch(() => {});
                }
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            finishSeek();
        };

        const handleTouchEnd = () => {
            finishSeek();
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('touchmove', handleTouchMove);
        window.addEventListener('touchend', handleTouchEnd);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
        };
    }, [isSeeking, player, state.duration]);
    
    const durationMs = state.duration || 0;
    const remainingMs = Math.max(0, durationMs - progressMs);

    return (
        <div 
            className="flex items-center gap-2 w-full select-none flex-shrink-0 relative" 
            style={{ height: `${(height) / 16}rem`, marginTop: `${(offset) / 16}rem` }}
        >
            <div
                ref={progressContainerRef}
                className="spotify-progress-bar flex-1 rounded-full cursor-pointer group relative bg-[var(--progress-bg)] overflow-visible select-none"
                style={{ height: `${(height) / 16}rem` }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
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
            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 tabular-nums select-none leading-none -translate-y-px">
                {formatRemainingTime(remainingMs)}
            </span>
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
    const remainingMs = Math.max(0, ((progress.duration || 0) - displayPosition) * 1000);

    return (
        <div 
            className="flex items-center gap-2 w-full select-none flex-shrink-0 relative" 
            style={{ height: `${(height) / 16}rem`, marginTop: `${(offset) / 16}rem` }}
        >
            <div
                ref={progressRef}
                className="flex-1 rounded-full cursor-pointer group bg-[var(--progress-bg)] overflow-visible"
                style={{ height: `${(height) / 16}rem` }}
                onMouseDown={handleMouseDown}
            >
                <div className="h-full rounded-full bg-[var(--progress-fill)] relative" style={{ width: `${visualPercentage}%` }}>
                    <div 
                        className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-[var(--progress-fill)] opacity-100"
                        style={{ transform: 'translateY(-50%)' }} 
                    />
                </div>
            </div>
            <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 tabular-nums select-none leading-none -translate-y-px">
                {formatRemainingTime(remainingMs)}
            </span>
        </div>
    );
};


const QueuePopover = ({ 
    isNight, 
    nextTrack, 
    onClose, 
    isClosing, 
}: { 
    isNight: boolean, 
    nextTrack: { name: string, description: string, imageUrl: string } | null, 
    onClose: () => void, 
    isClosing: boolean, 
}) => {
    return (
        <div
            className={`queue-popover-card absolute bottom-[calc(100%+8px)] right-0 w-[205px] sm:w-[230px] p-3 sm:p-3.5 squircle-card rounded-xl shadow-2xl border backdrop-blur-2xl transition-all duration-300 pointer-events-auto select-none ${
                isNight 
                    ? 'border-white/20 bg-[#1e1e1e]/95 text-white shadow-black/80' 
                    : 'border-black/15 bg-white/95 text-zinc-900 shadow-xl'
            } ${isClosing ? 'animate-queue-bubble-out' : 'animate-queue-bubble-in'} flex flex-col justify-between overflow-visible group`}
            style={{
                zIndex: isClosing ? 10 : 50,
                transformOrigin: 'calc(100% - 25px) calc(100% + 4px)',
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {/* Bubble arrow / tail pointing down to the queue button on player */}
            <div 
                className={`absolute -bottom-1 right-5 w-2.5 h-2.5 rotate-45 border-r border-b ${
                    isNight 
                        ? 'bg-[#1e1e1e] border-white/20' 
                        : 'bg-white border-black/15'
                }`}
                style={{ zIndex: 9501 }}
            />

            {/* Header / Badge */}
            <div className="flex items-center justify-between mb-1.5 flex-shrink-0 z-10 relative">
                <div className="flex items-center gap-1">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] sm:text-[9.5px] font-bold tracking-wider uppercase ${
                        isNight 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                        In coda
                    </span>
                </div>
                <button 
                    onClick={onClose} 
                    className={`p-0.5 rounded-full ${isNight ? 'hover:bg-white/10 text-zinc-400 hover:text-white' : 'hover:bg-black/10 text-zinc-500 hover:text-zinc-900'} transition-colors cursor-pointer`}
                    aria-label="Chiudi coda"
                >
                    <FiX className="w-3.5 h-3.5" />
                </button>
            </div>

            {/* Track Info */}
            <div className="flex items-center gap-2.5 min-w-0 w-full z-10 relative">
                {nextTrack ? (
                    <>
                        {nextTrack.imageUrl ? (
                            <div className="relative flex-shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-lg overflow-hidden shadow-md border border-black/10 dark:border-white/10">
                                <img 
                                    src={nextTrack.imageUrl} 
                                    alt={nextTrack.name} 
                                    className="w-full h-full object-cover" 
                                
                                />
                            </div>
                        ) : (
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-lg ${isNight ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-100 text-zinc-600'} flex items-center justify-center flex-shrink-0 shadow-inner`}>
                                <FiMusic className="w-4 h-4" />
                            </div>
                        )}
                        <div className="min-w-0 flex-1 overflow-hidden">
                            <p className="font-bold text-[11px] sm:text-[12px] truncate leading-tight">
                                {nextTrack.name}
                            </p>
                            <p className={`text-[9.5px] sm:text-[10px] truncate leading-tight mt-0.5 ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                {nextTrack.description}
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="flex items-center justify-center w-full py-0.5 text-center">
                        <p className={`text-[10.5px] ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                            Nessun brano in coda
                        </p>
                    </div>
                )}
            </div>
        </div>
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
        <div className={`w-full h-full flex flex-row items-center justify-between px-6 py-2 rounded-xl overflow-hidden ${isNight ? 'bg-black/40 backdrop-blur-md' : 'bg-transparent'}`}>
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
                className="flex-shrink-0 ml-4 px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-full text-sm transition-all active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.4)] hover:shadow-[0_0_22px_rgba(16,185,129,0.6)] whitespace-nowrap"
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
        <div className="w-full h-full flex flex-col justify-between px-4 py-2 flex-1 self-stretch">
            {/* Top part: Track info */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-lg shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className="overflow-hidden flex-grow">
                        <div className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>Nessun brano in riproduzione</div>
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
                className="flex items-center gap-2 w-full select-none flex-shrink-0 relative" 
                style={{ height: `${(progressBarHeight) / 16}rem`, marginTop: `${(progressBarVerticalOffset) / 16}rem` }}
            >
                <div 
                    className="flex-1 rounded-full cursor-not-allowed bg-[var(--progress-bg)] overflow-hidden" 
                    style={{ height: `${(progressBarHeight) / 16}rem` }}
                />
                <span className="text-[10px] text-gray-400 font-mono flex-shrink-0 tabular-nums select-none leading-none -translate-y-px">
                    -0:00
                </span>
            </div>
            {/* Controls */}
            <div className="w-full flex items-center justify-between" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                <div className="w-[22%] flex justify-center items-center">
                    <button disabled={!isReady} className="p-1 rounded-full flex items-center justify-center disabled:opacity-40 cursor-not-allowed transition hover:bg-white/5 active:scale-95" style={{ color: buttonColor }}>
                        <PrevTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale} />
                    </button>
                </div>
                <div className="w-[26%] flex justify-center items-center">
                    <button disabled={!isReady} className="p-1 rounded-full flex items-center justify-center disabled:opacity-40 cursor-not-allowed transition hover:bg-white/5 active:scale-95" style={{ color: buttonColor }}>
                        <PlayIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale} />
                    </button>
                </div>
                <div className="w-[22%] flex justify-center items-center">
                    <button disabled={!isReady} className="p-1 rounded-full flex items-center justify-center disabled:opacity-40 cursor-not-allowed transition hover:bg-white/5 active:scale-95" style={{ color: buttonColor }}>
                        <NextTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale} />
                    </button>
                </div>
                <div className="w-[30%] flex justify-end items-center gap-1.5 sm:gap-2">
                    <button disabled={true} className="p-1 rounded-full flex items-center justify-center disabled:opacity-40 cursor-not-allowed transition hover:bg-white/5 active:scale-95" style={{ color: inactiveButtonColor }}><FiHeart style={{ width: `${(playerControlsSize * 0.9) / 16}rem`, height: `${(playerControlsSize * 0.9) / 16}rem` }} /></button>
                    <button disabled={true} className="p-1 rounded-full flex items-center justify-center disabled:opacity-40 cursor-not-allowed transition hover:bg-white/5 active:scale-95" style={{ color: inactiveButtonColor }} title="Cerca su Spotify" aria-label="Cerca su Spotify">
                        <SearchIcon size={`${(playerControlsSize * 0.9) / 16}rem`} />
                    </button>
                    <button 
                        disabled={true} 
                        className="p-1 rounded-full flex items-center justify-center disabled:opacity-40 cursor-not-allowed transition hover:bg-white/5"
                        style={{ color: inactiveButtonColor }}
                        title="Prossimo in coda: Disattivato"
                        aria-label="Prossimo in coda: Disattivato"
                    >
                        <HiOutlineQueueList style={{ width: `${(playerControlsSize * 0.9) / 16}rem`, height: `${(playerControlsSize * 0.9) / 16}rem` }} className="flex-shrink-0 block" />
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
    const innerWaveBackdropRef = useRef<HTMLDivElement>(null);
    const outerWaveBackdropRef = useRef<HTMLDivElement>(null);
    
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    const isMobileOrTablet = windowWidth < 1180;
    
    const [containerWidth, setContainerWidth] = useState<number | null>(null);
    const [isCompactLayout, setIsCompactLayout] = useState(false);

    useEffect(() => {
        const playerEl = playerContainerRef.current;
        if (!playerEl) return;

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const w = entry.contentRect.width;
                setContainerWidth(w);

                // Dynamic layout mode selection based strictly on actual player width with hysteresis
                // Thresholds: Enter compact below 420px, exit compact above 435px
                setIsCompactLayout((prevIsCompact) => {
                    if (prevIsCompact) {
                        return w < 435; // Stay compact until width exceeds 435px
                    } else {
                        return w < 420; // Become compact when width drops below 420px
                    }
                });
            }
        });

        observer.observe(playerEl);
        return () => observer.disconnect();
    }, []);

    // Proportional scale factor based on actual container width (440px is reference desktop width)
    const scaleFactor = containerWidth && containerWidth < 440 ? Math.max(0.72, containerWidth / 440) : 1.0;

    // Gentle icon scale so buttons stay large, legible, and clickable
    const buttonScaleFactor = containerWidth && containerWidth < 410 ? Math.max(0.98, containerWidth / 440) : 1.0;

    // Scale controls gap proportionally so relative spatial distances are strictly preserved
    const currentControlsGap = containerWidth && containerWidth < 410 ? Math.max(8, playerControlsGap * (containerWidth / 440)) : playerControlsGap;

    const currentArtworkClass = `w-12 h-12 flex-shrink-0 aspect-square object-cover rounded-lg shadow-lg`;

    const currentTopRightGapClass = isCompactLayout ? 'gap-2 sm:gap-3' : 'gap-3 sm:gap-5';
    
    const [visibleQueue, setVisibleQueue] = useState<'spotify' | 'youtube' | null>(null);
    const [isQueueClosing, setIsQueueClosing] = useState(false);
    const [isAutoQueueEnabled, setIsAutoQueueEnabled] = useState(true);
    const dismissedTrackUriRef = useRef<string | null>(null);
    const dismissedYouTubeTrackRef = useRef<string | null>(null);
    const manualCloseTimerRef = useRef<any | null>(null);
    const isManuallyOpenedRef = useRef<boolean>(false);
    
    const [isLiked, setIsLiked] = useState(false);

    const spotifyQueueButtonRef = useRef<HTMLButtonElement>(null);
    const youTubeQueueButtonRef = useRef<HTMLButtonElement>(null);
    
    const playerState = nowPlaying.spotifyState;
    const { radioStation, youtubeTrack, youtubePlaylist, source, activeDevice } = nowPlaying;

    const audioRef = useRef<HTMLAudioElement>(null);
    const hlsRef = useRef<any>(null);
    const [isRadioPlaying, setIsRadioPlaying] = useState(false);
    const youtubePlayerRef = useRef<any>(null);
    const [isYouTubePlaying, setIsYouTubePlaying] = useState(false);
    const [isYouTubeShuffle, setIsYouTubeShuffle] = useState(false);
    const [youtubeRepeatMode, setYoutubeRepeatMode] = useState<0 | 1 | 2>(0);
    const [youTubeProgress, setYouTubeProgress] = useState({ position: 0, duration: 1 });
    const progressIntervalRef = useRef<number | null>(null);
    const [isYouTubeSeeking, setIsYouTubeSeeking] = useState(false);
    const [currentYouTubeVideoId, setCurrentYouTubeVideoId] = useState<string | undefined>();
    const hasEndedRef = useRef(false);
    const prevPositionRef = useRef(0);
    const lastTogglePlayTimeRef = useRef<number>(0);
    const lastTrackDataRef = useRef<{
        name: string;
        imageUrl: string;
        albumName: string;
        artists: string;
    } | null>(null);

    const isDjActive = useMemo(() => {
        if (source !== 'spotify' || !playerState) return false;
        return isSpotifyAiDj(playerState);
    }, [source, playerState]);

    const isDjPlaying = useMemo(() => {
        return Boolean(isDjActive && isSpotifyAiDjPlaying(playerState));
    }, [isDjActive, playerState]);

    const { sceneTransitionSpeed = 1.10 } = useUIConfig();

    // --- ANIMATION LOGIC FOR PLAYER SIZE/POSITION ---
    const visualState = useRef(isAnyAppOpen ? 0 : 1); // 0 = Docked (App Open), 1 = Floating (App Closed)
    const wasDraggingRef = useRef(false);

    const lastIsAnyAppOpen = useRef(isAnyAppOpen);
    const startT = useRef(isAnyAppOpen ? 0 : 1);
    const animStartTime = useRef(0);

    const playingStateRef = useRef({ isPlaying: false });

    const isDjActiveRef = useRef(isDjActive);
    useEffect(() => {
        isDjActiveRef.current = isDjActive;
    }, [isDjActive]);

    const isDjPlayingRef = useRef(isDjPlaying);
    useEffect(() => {
        isDjPlayingRef.current = isDjPlaying;
    }, [isDjPlaying]);

    const isNightRef = useRef(isNight);
    useEffect(() => {
        isNightRef.current = isNight;
    }, [isNight]);

    const playerStateRef = useRef(playerState);
    useEffect(() => {
        playerStateRef.current = playerState;
    }, [playerState]);

    const nowPlayingRef = useRef(nowPlaying);
    useEffect(() => {
        nowPlayingRef.current = nowPlaying;
    }, [nowPlaying]);

    const isPlayingGlobal = source === 'spotify' 
        ? !playerState?.paused 
        : (source === 'youtube' ? isYouTubePlaying : (source === 'radio' ? isRadioPlaying : false));

    useEffect(() => {
        playingStateRef.current.isPlaying = isPlayingGlobal;
    }, [isPlayingGlobal]);

    const targetDockedWidthRef = useRef<number>(dockedConfig.width);
    const lastFrameTimeRef = useRef<number>(performance.now());

    // Calculate real app left edge and symmetric docked width
    const updateTargetDockedWidth = useCallback(() => {
        const wWidth = window.innerWidth;
        const sideMargin = wWidth < 1024 ? 16 : 24;

        // Determine FINAL_APP_LEFT boundary
        let appLeft = wWidth;
        const mapsPanel = document.getElementById('maps-app-panel');
        if (mapsPanel && mapsPanel.offsetWidth > 0 && mapsPanel.offsetWidth < wWidth) {
            appLeft = wWidth - mapsPanel.offsetWidth;
        } else {
            const appElements = document.querySelectorAll('.spotify-app-panel');
            for (let i = 0; i < appElements.length; i++) {
                const el = appElements[i] as HTMLElement;
                if (el.offsetWidth > 0 && el.offsetWidth < wWidth && !el.closest('#maps-anchored-container')) {
                    appLeft = wWidth - el.offsetWidth;
                    break;
                }
            }
        }
        if (appLeft === wWidth && activeApp) {
            appLeft = Math.round(wWidth * (1 / 3));
        }

        // Available width inside left column with perfectly symmetrical margins on left and right
        const availablePx = appLeft - (2 * sideMargin);
        targetDockedWidthRef.current = Math.max(200, Math.round(availablePx));
    }, [activeApp]);

    // Recalculate fixed target when opening state or active app changes
    useEffect(() => {
        if (isAnyAppOpen !== lastIsAnyAppOpen.current) {
            lastIsAnyAppOpen.current = isAnyAppOpen;
            startT.current = visualState.current;
            animStartTime.current = performance.now();
            updateTargetDockedWidth();
        }
    }, [isAnyAppOpen, updateTargetDockedWidth]);

    useEffect(() => {
        updateTargetDockedWidth();
    }, [activeApp, updateTargetDockedWidth]);

    useEffect(() => {
        window.addEventListener('resize', updateTargetDockedWidth);
        return () => window.removeEventListener('resize', updateTargetDockedWidth);
    }, [updateTargetDockedWidth]);

    const remScaleRef = useRef(1.0);
    const updateRemScale = useCallback(() => {
        remScaleRef.current = (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16) / 16;
    }, []);

    useEffect(() => {
        updateRemScale();
        window.addEventListener('resize', updateRemScale);
        return () => window.removeEventListener('resize', updateRemScale);
    }, [updateRemScale]);

    // Single unified requestAnimationFrame loop that handles BOTH manual dragging AND smooth, beautifully easing transitions in real-time
    useEffect(() => {
        let animationFrameId: number;

        const loop = () => {
            const duration = APP_TRANSITION_DURATION; // 580ms synchronized transition (perfect lockstep with 3D camera and app panels)

            if (dragProgress.current !== null) {
                wasDraggingRef.current = true;
                visualState.current = dragProgress.current;
                animStartTime.current = 0; // stop autotransition
            } else {
                const targetT = isAnyAppOpen ? 0 : 1;
                if (animStartTime.current > 0) {
                    const elapsed = performance.now() - animStartTime.current;
                    const normT = Math.min(elapsed / duration, 1.0);
                    // Match cubic-bezier(0.16, 1, 0.3, 1) perfectly with 3D car
                    const easeT = cubicBezierEase(normT);
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

                const winWidth = window.innerWidth;
                const isStacked = winWidth < 480;
                const pct = 50 * t;
                const sideMargin = winWidth < 1024 ? 16 : 24;

                // Root rem scaling factor read from cached ref (avoids forced layout recalc every frame)
                const remScale = remScaleRef.current;

                // Determine app boundary (the real left edge of the open right-hand panel) in current coordinate space
                let appLeft = winWidth;
                if (drawerLayout.activeApp && drawerLayout.progress < 0.999) {
                    appLeft = Math.round(drawerLayout.currentLeftPx);
                } else if (activeApp) {
                    appLeft = Math.round(winWidth * (1 / 3));
                }

                // --- DOCKED GEOMETRY (when t = 0, app is open) ---
                // Available width inside left column with perfectly symmetrical margins on left and right:
                // leftMargin = sideMargin, rightMargin = sideMargin
                // playerLeft = sideMargin, playerRight = appLeft - sideMargin
                // playerWidth = appLeft - 2 * sideMargin
                const effectiveDockedWidth = Math.max(200, Math.round(appLeft - 2 * sideMargin));
                const dockedLeft = sideMargin;
                const dockedBottom = dockedConfig.bottom * remScale;
                const dockedHeight = dockedConfig.height * remScale;

                // --- HOME GEOMETRY (when t = 1, home view) ---
                // Scaled exactly in lockstep with NavigateTool / NavigationWidget so they are vertically and horizontally aligned
                const homeWidth = floatingConfig.width * remScale;
                const homeHeight = floatingConfig.height * remScale;
                const homeBottom = floatingConfig.bottom * remScale;
                const homeOffsetPx = isStacked
                    ? -(homeWidth / 2)
                    : -(homeWidth / 2 + (floatingConfig.otherWidgetWidth * remScale) / 2 + (6 * remScale));

                // --- FLUID INTERPOLATION (0 = Docked, 1 = Home) ---
                const offsetPx = dockedLeft * (1 - t) + homeOffsetPx * t;
                const currentWidth = effectiveDockedWidth + (homeWidth - effectiveDockedWidth) * t;
                const currentHeight = dockedHeight + (homeHeight - dockedHeight) * t;
                const currentBottom = dockedBottom + (homeBottom - dockedBottom) * t;

                const displayWidth = currentWidth;

                // Use exact pixel dimensions (px)
                const posWidth = `${Math.round(displayWidth)}px`;
                const posHeight = `${Math.round(currentHeight)}px`;
                const posBottom = `${Math.round(currentBottom)}px`;
                const posLeft = `calc(${pct}% + ${Math.round(offsetPx)}px)`;

                // Main player is ALWAYS COMPLETELY STATIC (transform: none)
                playerContainerRef.current.style.width = posWidth;
                playerContainerRef.current.style.height = posHeight;
                playerContainerRef.current.style.bottom = posBottom;
                playerContainerRef.current.style.left = posLeft;
                playerContainerRef.current.style.transform = 'none';
                playerContainerRef.current.style.margin = '0';

                // --- AI DJ MULTI-LAYER AMBIENT GLOW & EVENT ENGINE ---
                const isDjActiveVal = isDjActiveRef.current && source === 'spotify';
                const isDjPlayingVal = isDjPlayingRef.current && source === 'spotify';

                const nowMs = performance.now();
                const deltaSec = Math.min(0.1, (nowMs - lastFrameTimeRef.current) / 1000);
                lastFrameTimeRef.current = nowMs;

                const solidBg = isNightRef.current ? '#212121' : (widgetBgColor || '#ffffff');
                const baseShadow = isNightRef.current 
                    ? '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)' 
                    : '0 20px 40px -15px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)';

                const currentTrackItem = playerStateRef.current?.track_window?.current_track ?? (playerStateRef.current as any)?.item;
                const currentTrackKey = currentTrackItem?.id || currentTrackItem?.uri;
                const artworkUrl = currentTrackItem?.album?.images?.[0]?.url || nowPlayingRef.current?.imageUrl;

                const glowFrame = aiDjVisualState.update(
                    deltaSec,
                    isDjActiveVal,
                    isDjPlayingVal,
                    currentTrackKey,
                    artworkUrl,
                    baseShadow
                );

                // Apply Base Glow to static player container
                playerContainerRef.current.style.boxShadow = glowFrame.baseShadow;
                playerContainerRef.current.style.borderColor = glowFrame.baseBorderColor;
                playerContainerRef.current.style.background = solidBg;
                playerContainerRef.current.style.backgroundColor = solidBg;
                playerContainerRef.current.style.opacity = '1';

                // Synchronize Inner Wave Backdrop (Crisp concentric contour wave)
                if (innerWaveBackdropRef.current) {
                    const innerD = glowFrame.innerWaveExcursionPx;
                    const innerW = displayWidth + 2 * innerD;
                    const innerH = currentHeight + 2 * innerD;
                    const innerB = currentBottom - innerD;
                    const innerOff = offsetPx - innerD;
                    const innerRad = 12 + innerD;

                    innerWaveBackdropRef.current.style.width = `${Math.round(innerW)}px`;
                    innerWaveBackdropRef.current.style.height = `${Math.round(innerH)}px`;
                    innerWaveBackdropRef.current.style.bottom = `${Math.round(innerB)}px`;
                    innerWaveBackdropRef.current.style.left = `calc(${pct}% + ${Math.round(innerOff)}px)`;
                    innerWaveBackdropRef.current.style.borderRadius = `${Math.round(innerRad)}px`;
                    innerWaveBackdropRef.current.style.transform = 'none';
                    innerWaveBackdropRef.current.style.opacity = `${glowFrame.innerWaveOpacity.toFixed(3)}`;
                    innerWaveBackdropRef.current.style.boxShadow = glowFrame.innerWaveShadow;
                    innerWaveBackdropRef.current.style.border = glowFrame.innerWaveBorder;
                    innerWaveBackdropRef.current.style.display = (glowFrame.activeOpacity > 0.005 && glowFrame.innerWaveOpacity > 0.005) ? 'block' : 'none';
                }

                // Synchronize Outer Wave Backdrop (Soft ambient concentric wave)
                if (outerWaveBackdropRef.current) {
                    const outerD = glowFrame.outerWaveExcursionPx;
                    const outerW = displayWidth + 2 * outerD;
                    const outerH = currentHeight + 2 * outerD;
                    const outerB = currentBottom - outerD;
                    const outerOff = offsetPx - outerD;
                    const outerRad = 12 + outerD;

                    outerWaveBackdropRef.current.style.width = `${Math.round(outerW)}px`;
                    outerWaveBackdropRef.current.style.height = `${Math.round(outerH)}px`;
                    outerWaveBackdropRef.current.style.bottom = `${Math.round(outerB)}px`;
                    outerWaveBackdropRef.current.style.left = `calc(${pct}% + ${Math.round(outerOff)}px)`;
                    outerWaveBackdropRef.current.style.borderRadius = `${Math.round(outerRad)}px`;
                    outerWaveBackdropRef.current.style.transform = 'none';
                    outerWaveBackdropRef.current.style.opacity = `${glowFrame.outerWaveOpacity.toFixed(3)}`;
                    outerWaveBackdropRef.current.style.boxShadow = glowFrame.outerWaveShadow;
                    outerWaveBackdropRef.current.style.border = glowFrame.outerWaveBorder || 'none';
                    outerWaveBackdropRef.current.style.display = (glowFrame.activeOpacity > 0.005 && glowFrame.outerWaveOpacity > 0.005) ? 'block' : 'none';
                }

                // Schedule next frame ONLY if animation, drag or AI DJ glow is actively running
                const isTransitioning = animStartTime.current > 0;
                const isDragging = dragProgress.current !== null;
                const isDjActiveAnim = isDjActiveVal && isDjPlayingVal;

                if (isTransitioning || isDragging || isDjActiveAnim) {
                    animationFrameId = requestAnimationFrame(loop);
                }
            }
        };

        const handleDragEvent = () => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(loop);
        };

        const handleResize = () => {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(loop);
        };

        window.addEventListener('app-drag-state', handleDragEvent);
        window.addEventListener('resize', handleResize);

        // Run initial loop
        loop();

        return () => {
            cancelAnimationFrame(animationFrameId);
            window.removeEventListener('app-drag-state', handleDragEvent);
            window.removeEventListener('resize', handleResize);
        };
    }, [dockedConfig, floatingConfig, dragProgress, isAnyAppOpen, activeApp]);

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
    const isPlayerActive = Boolean(playerState && (playerState?.track_window?.current_track || (playerState as any)?.item));
    
    const currentTrack = playerState?.track_window?.current_track ?? (playerState as any)?.item;
    const currentTrackUri = currentTrack?.uri;

    const handleCloseQueuePopover = useCallback(() => {
        if (currentTrackUri) {
            dismissedTrackUriRef.current = currentTrackUri;
        }
        if (youtubeTrack?.videoId) {
            dismissedYouTubeTrackRef.current = youtubeTrack.videoId;
        }

        // Clear manual close timer when closed
        if (manualCloseTimerRef.current) {
            clearTimeout(manualCloseTimerRef.current);
            manualCloseTimerRef.current = null;
        }
        isManuallyOpenedRef.current = false;

        setIsQueueClosing(true);
        setTimeout(() => {
            setVisibleQueue(null);
            setIsQueueClosing(false);
        }, 350);
    }, [currentTrackUri, youtubeTrack]);

    const handleToggleQueue = useCallback((targetSource: 'spotify' | 'youtube') => {
        // Clear any existing manual close timer
        if (manualCloseTimerRef.current) {
            clearTimeout(manualCloseTimerRef.current);
            manualCloseTimerRef.current = null;
        }

        if (visibleQueue) {
            // If already open, close it!
            handleCloseQueuePopover();
        } else {
            // If closed, open it!
            dismissedTrackUriRef.current = null;
            dismissedYouTubeTrackRef.current = null;
            setIsQueueClosing(false);
            setVisibleQueue(targetSource);

            // Set manual mode flag
            isManuallyOpenedRef.current = true;
            // Set the 5-second timer to auto-dismiss the queue popover
            manualCloseTimerRef.current = setTimeout(() => {
                setIsQueueClosing(true);
                setTimeout(() => {
                    setVisibleQueue(null);
                    setIsQueueClosing(false);
                }, 350);
                isManuallyOpenedRef.current = false;
            }, 5000);
        }
    }, [visibleQueue, handleCloseQueuePopover]);

    // Cleanup manual close timer on unmount
    useEffect(() => {
        return () => {
            if (manualCloseTimerRef.current) {
                clearTimeout(manualCloseTimerRef.current);
            }
        };
    }, []);

    // near-end for Spotify
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
            setTimeout(() => { setVisibleQueue(null); setIsQueueClosing(false); }, 350);
        } else if (isNearEnd && canSkipNext && isAutoQueueEnabled && visibleQueue !== 'spotify' && dismissedTrackUriRef.current !== currentTrackUri) {
            // Show popover if near the end and it's not already visible and wasn't manually dismissed for this song
            setIsQueueClosing(false);
            setVisibleQueue('spotify');
        }

        prevPositionRef.current = position;
    }, [playerState, currentTrackUri, visibleQueue, isAutoQueueEnabled]);

    // near-end for YouTube
    useEffect(() => {
        if (source !== 'youtube' || !youtubeTrack || isYouTubeSeeking) return;
        const { position, duration } = youTubeProgress;
        if (!duration || duration <= 0) return;

        const remaining = duration - position;
        const isNearEnd = duration > 15 && remaining < 15;

        const currentYouTubeVideoId = youtubeTrack.videoId;

        if (isNearEnd && isAutoQueueEnabled && visibleQueue !== 'youtube' && dismissedYouTubeTrackRef.current !== currentYouTubeVideoId) {
            setIsQueueClosing(false);
            setVisibleQueue('youtube');
        }
    }, [youTubeProgress, youtubeTrack, source, isYouTubeSeeking, visibleQueue, isAutoQueueEnabled]);

    // Effect for hiding popover on track change (Spotify)
    const prevTrackUri = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (prevTrackUri.current && prevTrackUri.current !== currentTrackUri) {
            // New track started playing -> reset dismissed ref
            dismissedTrackUriRef.current = null;
            if (visibleQueue === 'spotify') {
                // Clear manual close timer
                if (manualCloseTimerRef.current) {
                    clearTimeout(manualCloseTimerRef.current);
                    manualCloseTimerRef.current = null;
                }
                isManuallyOpenedRef.current = false;

                setIsQueueClosing(true);
                setTimeout(() => { setVisibleQueue(null); setIsQueueClosing(false); }, 350);
            }
        }
        prevTrackUri.current = currentTrackUri;
    }, [currentTrackUri, visibleQueue]);

    // Effect for hiding popover on track change (YouTube)
    const prevYouTubeVideoId = useRef<string | undefined>(undefined);
    useEffect(() => {
        const currentYouTubeVideoId = youtubeTrack?.videoId;
        if (prevYouTubeVideoId.current && prevYouTubeVideoId.current !== currentYouTubeVideoId) {
            // New track started playing -> reset dismissed ref
            dismissedYouTubeTrackRef.current = null;
            if (visibleQueue === 'youtube') {
                // Clear manual close timer
                if (manualCloseTimerRef.current) {
                    clearTimeout(manualCloseTimerRef.current);
                    manualCloseTimerRef.current = null;
                }
                isManuallyOpenedRef.current = false;

                setIsQueueClosing(true);
                setTimeout(() => { setVisibleQueue(null); setIsQueueClosing(false); }, 350);
            }
        }
        prevYouTubeVideoId.current = currentYouTubeVideoId;
    }, [youtubeTrack, visibleQueue]);

    // --- AI DJ CUSTOM QUEUE INTERLEAVING LOGIC ---
    const djCustomQueueRef = useRef<{ uri: string; name: string }[]>([]);
    const isPlayingInterleavedTrackRef = useRef(false);
    const hasTriggeredInterleaveRef = useRef(false);

    useEffect(() => {
        const handleQueueAdd = (e: any) => {
            const trackDetail = e.detail;
            if (trackDetail?.uri) {
                console.log('🎵 [DJ QUEUE INTERLEAVE] Track queued for AI DJ:', trackDetail.name);
                djCustomQueueRef.current.push({ uri: trackDetail.uri, name: trackDetail.name });
            }
        };
        window.addEventListener('spotify-queue-add', handleQueueAdd as EventListener);
        return () => {
            window.removeEventListener('spotify-queue-add', handleQueueAdd as EventListener);
        };
    }, []);

    // Monitor near-end of AI DJ track to play user queued track
    useEffect(() => {
        if (!playerState || playerState.paused || source !== 'spotify') return;

        const { position, duration } = playerState;
        const isNearEnd = duration > 8000 && (duration - position) < 2500;
        const isCurrentlyDj = isDjActiveRef.current;

        if (isCurrentlyDj && djCustomQueueRef.current.length > 0 && isNearEnd && !hasTriggeredInterleaveRef.current) {
            hasTriggeredInterleaveRef.current = true;
            const nextCustomTrack = djCustomQueueRef.current.shift();
            if (nextCustomTrack) {
                isPlayingInterleavedTrackRef.current = true;
                const deviceId = localStorage.getItem('spotify_device_id') || (playerState as any)?.device?.id;
                apiClient.put(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, { uris: [nextCustomTrack.uri] })
                    .catch(err => console.warn('DJ queue interleave play failed:', err));
            }
        }
    }, [playerState, source]);

    // On track transition, check if we need to continue playing custom queue or switch back to Spotify AI DJ
    useEffect(() => {
        if (prevTrackUri.current && prevTrackUri.current !== currentTrackUri) {
            hasTriggeredInterleaveRef.current = false;

            if (isPlayingInterleavedTrackRef.current) {
                if (djCustomQueueRef.current.length > 0) {
                    const nextCustomTrack = djCustomQueueRef.current.shift();
                    if (nextCustomTrack) {
                        const deviceId = localStorage.getItem('spotify_device_id') || (playerState as any)?.device?.id;
                        apiClient.put(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, { uris: [nextCustomTrack.uri] })
                            .catch(err => console.warn('DJ queue interleave play next failed:', err));
                    }
                } else {
                    // All custom queued tracks played -> RETURN TO SPOTIFY AI DJ!
                    isPlayingInterleavedTrackRef.current = false;
                    const deviceId = localStorage.getItem('spotify_device_id') || (playerState as any)?.device?.id;
                    apiClient.put(`/me/player/play${deviceId ? `?device_id=${deviceId}` : ''}`, { context_uri: 'spotify:playlist:37i9dQZF1EYkqdzj48dyYq' })
                        .catch(err => console.warn('Return to AI DJ failed:', err));
                }
            }
        }
    }, [currentTrackUri, playerState]);
    
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

        if (youtubeRepeatMode === 2) {
            youtubePlayerRef.current?.seekTo(0);
            youtubePlayerRef.current?.playVideo();
            return;
        }
    
        const currentTrackIndex = nowPlaying.youtubePlaylist.findIndex(
            track => track.videoId === nowPlaying.youtubeTrack?.videoId
        );

        if (isYouTubeShuffle && nowPlaying.youtubePlaylist.length > 1) {
            let nextIdx = Math.floor(Math.random() * nowPlaying.youtubePlaylist.length);
            if (nextIdx === currentTrackIndex) {
                nextIdx = (nextIdx + 1) % nowPlaying.youtubePlaylist.length;
            }
            playYouTube(nowPlaying.youtubePlaylist[nextIdx], nowPlaying.youtubePlaylist);
            return;
        }
    
        if (currentTrackIndex > -1 && currentTrackIndex < nowPlaying.youtubePlaylist.length - 1) {
            const nextTrack = nowPlaying.youtubePlaylist[currentTrackIndex + 1];
            playYouTube(nextTrack, nowPlaying.youtubePlaylist);
        } else if (youtubeRepeatMode === 1 && nowPlaying.youtubePlaylist.length > 0) {
            playYouTube(nowPlaying.youtubePlaylist[0], nowPlaying.youtubePlaylist);
        }
    }, [nowPlaying, playYouTube, youtubeRepeatMode, isYouTubeShuffle]);

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
        const now = Date.now();
        localStorage.setItem("last_action_ts", String(now));

        if (source === 'spotify') {
            const isCurrentlyPaused = Boolean(playerState?.paused);
            const targetPaused = !isCurrentlyPaused;
            const previousSpotifyState = playerState;

            localStorage.setItem("last_action_target_paused", String(targetPaused));

            // OPTIMISTIC UI: Aggiornamento istantaneo al click (0ms di ritardo)
            setNowPlaying(prev => {
                if (!prev.spotifyState) return prev;
                const timeSinceUpdate = Date.now() - prev.spotifyState.timestamp;
                const newPos = prev.spotifyState.paused ? prev.spotifyState.position : prev.spotifyState.position + timeSinceUpdate;
                return {
                    ...prev,
                    spotifyState: {
                        ...prev.spotifyState,
                        paused: targetPaused,
                        position: newPos,
                        timestamp: Date.now()
                    }
                };
            });

            if (isCurrentlyPaused) {
                // Resume in background
                (async () => {
                    try {
                        if (player && isPlayerActive && playerState?.track_window?.current_track) {
                            await player.resume();
                            return;
                        }
                        await play({});
                    } catch (e) {
                        console.warn("Local play failed or device inactive, applying FALLBACK play...", e);
                        const deviceId = getDeviceId();
                        if (deviceId) {
                            const lastPos = localStorage.getItem("spotify_last_position") || localStorage.getItem("last_progress_ms");
                            const hasLoadedTrack = Boolean(playerState?.track_window?.current_track);

                            const body: any = {};
                            if (!hasLoadedTrack) {
                                const lastCtx = localStorage.getItem("spotify_last_context");
                                const lastUr = localStorage.getItem("spotify_last_track");
                                if (lastCtx && lastCtx !== "undefined") body.context_uri = lastCtx;
                                else if (lastUr && lastUr !== "undefined") body.uris = [lastUr];
                            }
                            if (lastPos && lastPos !== "undefined") {
                                const parsedPos = parseInt(lastPos, 10);
                                if (!isNaN(parsedPos) && parsedPos >= 0) {
                                    body.position_ms = parsedPos;
                                }
                            }
                            
                            try {
                                await apiClient.put(`/me/player/play?device_id=${deviceId}`, body);
                                console.log("REST API Fallback Play succeeded.");
                            } catch (err) {
                                console.error("REST API Fallback Play failed:", err);
                                // Rollback optimistic state if failed
                                if (previousSpotifyState) {
                                    setNowPlaying(prev => prev.spotifyState ? ({ ...prev, spotifyState: previousSpotifyState }) : prev);
                                }
                            }
                        } else if (previousSpotifyState) {
                            // Rollback if no device available
                            setNowPlaying(prev => prev.spotifyState ? ({ ...prev, spotifyState: previousSpotifyState }) : prev);
                        }
                    }
                })();
            } else {
                // Pause in background
                (async () => {
                    try {
                        if (player && isPlayerActive) {
                            await player.pause().catch(() => {});
                        }
                        await pauseSpotify();
                    } catch (e) {
                        console.warn("Pause failed, attempting REST API fallback...", e);
                        const deviceId = getDeviceId();
                        if (deviceId) {
                            try { 
                                await apiClient.put(`/me/player/pause?device_id=${deviceId}`); 
                            } catch (err) { 
                                console.error("REST API Pause failed:", err);
                                // Rollback optimistic state if failed
                                if (previousSpotifyState) {
                                    setNowPlaying(prev => prev.spotifyState ? ({ ...prev, spotifyState: previousSpotifyState }) : prev);
                                }
                            }
                        } else if (previousSpotifyState) {
                            setNowPlaying(prev => prev.spotifyState ? ({ ...prev, spotifyState: previousSpotifyState }) : prev);
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
            if (isYouTubeShuffle && nowPlaying.youtubePlaylist.length > 1) {
                let nextIdx = Math.floor(Math.random() * nowPlaying.youtubePlaylist.length);
                if (nextIdx === currentTrackIndex) {
                    nextIdx = (nextIdx + 1) % nowPlaying.youtubePlaylist.length;
                }
                playYouTube(nowPlaying.youtubePlaylist[nextIdx], nowPlaying.youtubePlaylist);
            } else if (currentTrackIndex > -1 && currentTrackIndex < nowPlaying.youtubePlaylist.length - 1) {
                const nextTrack = nowPlaying.youtubePlaylist[currentTrackIndex + 1];
                playYouTube(nextTrack, nowPlaying.youtubePlaylist);
            } else if (youtubeRepeatMode === 1 && nowPlaying.youtubePlaylist.length > 0) {
                playYouTube(nowPlaying.youtubePlaylist[0], nowPlaying.youtubePlaylist);
            }
        }
    };
    
    const handleOpenSpotifySearch = (e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        window.dispatchEvent(new CustomEvent('spotify-open-search'));
        if (onOpenApp) {
            onOpenApp('spotify');
        }
        const focusInput = () => {
            const searchInput = document.querySelector('input[placeholder*="ascoltare"], input[placeholder*="Cerca"]') as HTMLInputElement;
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
                searchInput.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
            }
        };
        focusInput();
        requestAnimationFrame(focusInput);
        setTimeout(focusInput, 30);
        setTimeout(focusInput, 100);
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
            } else if (youtubeRepeatMode === 1 && nowPlaying.youtubePlaylist.length > 0) {
                playYouTube(nowPlaying.youtubePlaylist[nowPlaying.youtubePlaylist.length - 1], nowPlaying.youtubePlaylist);
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
        const nextState = (playerState.repeat_mode + 1) % 3 as 0 | 1 | 2;
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

    const handleToggleYouTubeShuffle = () => {
        setIsYouTubeShuffle(prev => !prev);
    };

    const handleToggleYouTubeRepeat = () => {
        setYoutubeRepeatMode(prev => ((prev + 1) % 3) as 0 | 1 | 2);
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
            const inactiveButtonColor = isNight ? '#464646' : '#9ca3af';
            const isYouTubePlaylist = Boolean(youtubePlaylist && youtubePlaylist.length > 0);
            const currentTrackIndex = youtubePlaylist ? youtubePlaylist.findIndex(track => track.videoId === youtubeTrack.videoId) : -1;

            return (
                 <div className="w-full h-full flex flex-col justify-between px-4 py-2 flex-1 self-stretch">
                    <div className="flex items-center justify-between w-full h-12">
                        <div className={`flex items-center min-w-0 ${isCompactLayout ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3 flex-1 shrink'}`}>
                            <img src={thumbnail} alt={title} className={`${currentArtworkClass} rounded-lg object-cover flex-shrink-0 shadow-lg`} />
                            <div className="overflow-hidden flex-grow min-w-0 flex-shrink pr-1">
                                <DynamicTrackTitle title={title} isAnyAppOpen={Boolean(isAnyAppOpen)} />
                                <div className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{channelTitle}</div>
                            </div>
                        </div>
                        <div className={`flex items-center flex-shrink-0 pl-2 ${currentTopRightGapClass}`}>
                            <div className="flex items-center" style={{ gap: `${(spinnerShuffleGap) / 16}rem`}}>
                                <button
                                    onClick={handleToggleYouTubeShuffle}
                                    className="transition"
                                    style={{ color: isYouTubeShuffle ? buttonActiveColor : inactiveButtonColor }}
                                    aria-label={isYouTubeShuffle ? "Disable shuffle" : "Enable shuffle"}
                                >
                                    <PiShuffleBold className="w-5 h-5" />
                                </button>
                            </div>
                            <button
                                onClick={handleToggleYouTubeRepeat}
                                className="transition"
                                style={{ color: youtubeRepeatMode > 0 ? buttonActiveColor : inactiveButtonColor }}
                                aria-label="Set repeat mode"
                            >
                                {youtubeRepeatMode === 2 ? (
                                    <PiRepeatOnceBold className="w-5 h-5" />
                                ) : (
                                    <PiRepeatBold className="w-5 h-5" />
                                )}
                            </button>
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
                    <div className="w-full flex items-center justify-between" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                        <div className="w-[22%] flex justify-center items-center">
                            <button 
                                onClick={handlePrevTrack} 
                                disabled={!isYouTubePlaylist || (youtubeRepeatMode === 0 && currentTrackIndex <= 0)} 
                                className="p-1 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5" 
                                style={{ color: buttonActiveColor }}
                            >
                                <PrevTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale * buttonScaleFactor} />
                            </button>
                        </div>
                        <div className="w-[26%] flex justify-center items-center">
                            <button onClick={handleTogglePlay} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                {isYouTubePlaying
                                    ? <PauseIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale * buttonScaleFactor} />
                                    : <PlayIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale * buttonScaleFactor} />
                                }
                            </button>
                        </div>
                        <div className="w-[22%] flex justify-center items-center">
                            <button 
                                onClick={handleNextTrack} 
                                disabled={!isYouTubePlaylist || (youtubeRepeatMode === 0 && !isYouTubeShuffle && currentTrackIndex >= (youtubePlaylist?.length ?? 1) - 1)} 
                                className="p-1 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5" 
                                style={{ color: buttonActiveColor }}
                            >
                                <NextTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale * buttonScaleFactor} />
                            </button>
                        </div>
                        <div className="w-[30%] flex justify-end items-center gap-1.5 sm:gap-2">
                            <button className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: inactiveButtonColor }}>
                                <FiHeart style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} />
                            </button>
                            <button onClick={handleOpenSpotifySearch} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: inactiveButtonColor }} title="Cerca su Spotify" aria-label="Cerca su Spotify">
                                <SearchIcon size={`${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`} />
                            </button>
                            <button 
                                ref={youTubeQueueButtonRef} 
                                onClick={() => handleToggleQueue('youtube')} 
                                className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5"
                                style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}
                                title={isAutoQueueEnabled ? "Prossimo in coda: Attivo" : "Prossimo in coda: Disattivato"}
                                aria-label={isAutoQueueEnabled ? "Disattiva prossimo in coda" : "Attiva prossimo in coda"}
                            >
                                {isAutoQueueEnabled ? (
                                    <HiQueueList style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} className="flex-shrink-0 block fill-current" />
                                ) : (
                                    <HiOutlineQueueList style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} className="flex-shrink-0 block" />
                                )}
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
                <div className="w-full h-full flex flex-col justify-between px-4 py-2 flex-1 self-stretch">
                    <div className="flex items-center justify-between w-full h-12">
                        <div className={`flex items-center min-w-0 ${isCompactLayout ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3 flex-1 shrink'}`}>
                            {favicon ? 
                                <img src={favicon} alt={name} className={`${currentArtworkClass} rounded-lg object-contain bg-zinc-800 flex-shrink-0 shadow-lg`} /> 
                                : 
                                <div className={`${currentArtworkClass} rounded-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                                    <FiRadio className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                                </div>
                            }
                            <div className="overflow-hidden flex-grow min-w-0 flex-shrink pr-1">
                                <div className="font-semibold truncate text-sm" style={{ color: 'var(--text-primary)' }}>{name}</div>
                                <div className="truncate text-xs" style={{ color: 'var(--text-secondary)'}}>{tags.split(',')[0] || 'Radio'}</div>
                            </div>
                        </div>
                    </div>
                    <div 
                        className="w-full rounded-full bg-[var(--progress-bg)] flex-shrink-0"
                        style={{ height: `${(progressBarHeight) / 16}rem`, marginTop: `${(progressBarVerticalOffset) / 16}rem` }}
                    />
                    <div className="w-full flex items-center justify-between" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                        <div className="w-[22%] flex justify-center items-center">
                            <button onClick={handlePrevTrack} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                <PrevTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale * buttonScaleFactor} />
                            </button>
                        </div>
                        <div className="w-[26%] flex justify-center items-center">
                            <button onClick={handleTogglePlay} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                {isRadioPlaying
                                    ? <PauseIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale * buttonScaleFactor} />
                                    : <PlayIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale * buttonScaleFactor} />
                                }
                            </button>
                        </div>
                        <div className="w-[22%] flex justify-center items-center">
                            <button onClick={handleNextTrack} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                <NextTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale * buttonScaleFactor} />
                            </button>
                        </div>
                        <div className="w-[30%] flex justify-end items-center gap-1.5 sm:gap-2">
                            <button onClick={() => onToggleFavorite(radioStation)} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: isFavorite ? buttonActiveColor : (isNight ? '#464646' : '#b0b0b0') }}>
                                <FiHeart style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} className={`${isFavorite ? 'fill-current' : ''}`} />
                            </button>
                            <button onClick={handleOpenSpotifySearch} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: inactiveButtonColor }} title="Cerca su Spotify" aria-label="Cerca su Spotify">
                                <SearchIcon size={`${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`} />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        if (source === 'spotify' && isPlayerActive) {
            const currentTrack = playerState?.track_window?.current_track ?? playerState?.item ?? null;
            const rawName = currentTrack?.name ?? (currentTrack as any)?.title;
            const rawImage = currentTrack?.album?.images?.[0]?.url ?? currentTrack?.images?.[0]?.url ?? (currentTrack as any)?.image;
            const rawAlbum = currentTrack?.album?.name;
            const rawArtists = currentTrack?.artists?.map((a: any) => a.name).join(', ');

            // Keep Previous Data logic: cache valid track data so buffering does not cause jumps
            if (rawName && rawName !== 'In riproduzione') {
                lastTrackDataRef.current = {
                    name: rawName,
                    imageUrl: rawImage || lastTrackDataRef.current?.imageUrl || '/placeholder.png',
                    albumName: rawAlbum || lastTrackDataRef.current?.albumName || 'Musica',
                    artists: rawArtists || lastTrackDataRef.current?.artists || ''
                };
            }

            const trackName = rawName || lastTrackDataRef.current?.name || 'In riproduzione';
            const imageUrl = rawImage || lastTrackDataRef.current?.imageUrl || '/placeholder.png';
            const albumName = rawAlbum || lastTrackDataRef.current?.albumName || 'Musica';
            const artists = rawArtists || lastTrackDataRef.current?.artists || (currentTrack?.uri?.includes('episode') ? 'Podcast' : '');
            
            const isPodcastEpisode = Boolean(currentTrack?.uri?.includes('episode') || (currentTrack as any)?.type === 'episode');
            const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
            const inactiveButtonColor = isNight ? '#464646' : '#9ca3af';
            const songTitleColor = isNight ? '#f7f7f7' : (playerState.paused ? '#454545' : '#000000');
            return (
                <div className="w-full h-full flex flex-col justify-between px-4 py-2 flex-1 self-stretch">
                    <div className="flex items-center justify-between w-full h-12">
                        <div className={`flex items-center min-w-0 ${isCompactLayout ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3 flex-1 shrink'}`}>
                            {imageUrl && (
                                <div className="flex-shrink-0 relative">
                                    <img src={imageUrl} alt={albumName} className={`${currentArtworkClass} rounded-lg shadow-lg object-cover`} />
                                    {(nowPlaying.isLoading || (playerState as any)?.isLoading) && (
                                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center backdrop-blur-[1px]">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="overflow-hidden flex-grow min-w-0 flex-shrink pr-1">
                                <DynamicTrackTitle title={trackName} isAnyAppOpen={Boolean(isAnyAppOpen)} />
                                <div className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{artists}</div>
                            </div>
                        </div>
                        <div className={`flex items-center flex-shrink-0 pl-2 ${currentTopRightGapClass}`}>
                            <div className="flex items-center" style={{ gap: `${(spinnerShuffleGap) / 16}rem`}}>
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
                                {playerState.repeat_mode === 2 ? (
                                    <PiRepeatOnceBold className="w-5 h-5" />
                                ) : (
                                    <PiRepeatBold className="w-5 h-5" />
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
                    
                    <div className="w-full flex items-center justify-between" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                        <div className="w-[22%] flex justify-center items-center">
                            <button onClick={handlePrevTrack} disabled={playerState.disallows.skipping_prev} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                <PrevTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale * buttonScaleFactor} />
                            </button>
                        </div>
                        <div className="w-[26%] flex justify-center items-center">
                            <button onClick={handleTogglePlay} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                {playerState.paused 
                                    ? <PlayIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale * buttonScaleFactor} />
                                    : <PauseIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={playButtonScale * buttonScaleFactor} />
                                }
                            </button>
                        </div>
                        <div className="w-[22%] flex justify-center items-center">
                            <button onClick={handleNextTrack} disabled={playerState.disallows.skipping_next} className="p-1 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5" style={{ color: buttonActiveColor }}>
                                <NextTrackIcon size={`${(playerControlsSize * 1.25) / 16}rem`} scale={skipButtonScale * buttonScaleFactor} />
                            </button>
                        </div>
                        <div className="w-[30%] flex justify-end items-center gap-1.5 sm:gap-2">
                            <button
                                onClick={handleToggleLike}
                                className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5"
                                style={{ color: isLiked ? buttonActiveColor : inactiveButtonColor }}
                            >
                                <FiHeart style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} className={`${isLiked ? 'fill-current' : ''}`} />
                            </button>
                            <button
                                onClick={handleOpenSpotifySearch}
                                className="p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5"
                                style={{ color: inactiveButtonColor }}
                                title="Cerca su Spotify"
                                aria-label="Cerca su Spotify"
                            >
                                <SearchIcon size={`${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`} />
                            </button>
                            <button 
                                ref={spotifyQueueButtonRef} 
                                onClick={() => handleToggleQueue('spotify')} 
                                className={`p-1 rounded-full flex items-center justify-center transition active:scale-95 hover:bg-white/5 ${
                                    (playerState?.track_window?.next_tracks ?? []).length === 0 ? 'opacity-40' : ''
                                }`}
                                style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}
                                title={isAutoQueueEnabled ? "Prossimo in coda: Attivo" : "Prossimo in coda: Disattivato"}
                                aria-label={isAutoQueueEnabled ? "Disattiva prossimo in coda" : "Attiva prossimo in coda"}
                            >
                                {isAutoQueueEnabled ? (
                                    <HiQueueList style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} className="flex-shrink-0 block fill-current" />
                                ) : (
                                    <HiOutlineQueueList style={{ width: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem`, height: `${(playerControlsSize * 0.9 * buttonScaleFactor) / 16}rem` }} className="flex-shrink-0 block" />
                                )}
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
            playerControlsGap: currentControlsGap, 
            playerControlsVerticalPosition, 
            dayPlayerButtonColor, 
            nightPlayerButtonColor,
            progressBarHeight,
            progressBarVerticalOffset,
            playButtonScale,
            skipButtonScale
        }} />;
    };

    const nextSpotifyTrack = playerState?.track_window?.next_tracks?.[0];
    const nextYouTubeTrack = nowPlaying.youtubePlaylist && nowPlaying.youtubeTrack
        ? nowPlaying.youtubePlaylist[nowPlaying.youtubePlaylist.findIndex(t => t.videoId === nowPlaying.youtubeTrack?.videoId) + 1]
        : null;

    const nextTrackDetails = useMemo(() => {
        if (visibleQueue === 'spotify') {
            if (nextSpotifyTrack) {
                return {
                    name: nextSpotifyTrack.name,
                    description: nextSpotifyTrack.artists?.map((a: any) => a.name).join(', ') || 'Artista sconosciuto',
                    imageUrl: nextSpotifyTrack.album?.images?.[0]?.url || '',
                };
            }
            return {
                name: 'Nessun brano in coda',
                description: 'La tua coda di riproduzione è vuota',
                imageUrl: '',
            };
        }
        if (visibleQueue === 'youtube') {
            if (nextYouTubeTrack) {
                return {
                    name: nextYouTubeTrack.title,
                    description: nextYouTubeTrack.channelTitle || 'YouTube Music',
                    imageUrl: nextYouTubeTrack.thumbnail || '',
                };
            }
            return {
                name: 'Nessun video in coda',
                description: 'Nessun prossimo brano nella playlist',
                imageUrl: '',
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
            {/* AI DJ OUTER WAVE BACKDROP LAYER */}
            <div 
                ref={outerWaveBackdropRef}
                className="fixed z-[1996] pointer-events-none"
                style={{
                    display: 'none',
                    willChange: 'width, height, bottom, left, opacity, box-shadow'
                }}
            />

            {/* AI DJ INNER WAVE BACKDROP LAYER */}
            <div 
                ref={innerWaveBackdropRef}
                className="fixed z-[1997] pointer-events-none"
                style={{
                    display: 'none',
                    willChange: 'width, height, bottom, left, opacity, box-shadow, border'
                }}
            />

            <div 
                ref={playerContainerRef}
                className={`music-player-container box-border fixed z-[2000] rounded-2xl squircle-card overflow-visible border flex flex-col justify-between self-stretch ${themeClasses} ${isNight ? 'bg-[#212121]' : 'bg-white'} shadow-xl ${
                    isDjActive 
                        ? (isNight ? 'ring-1 ring-emerald-500/30' : 'ring-1 ring-emerald-600/20') 
                        : (isNight ? 'ring-1 ring-white/10' : 'ring-1 ring-black/5')
                }`}
                style={{
                    // Background rimane solido e mai trasparente
                    background: isNight ? '#212121' : (widgetBgColor || '#ffffff'),
                    backgroundColor: isNight ? '#212121' : (widgetBgColor || '#ffffff'),
                    opacity: 1,
                    // Initial styles before JS takes over
                    width: isAnyAppOpen ? `${dockedConfig.width}px` : `${floatingConfig.width}px`,
                    height: isAnyAppOpen ? `${dockedConfig.height}px` : `${floatingConfig.height}px`,
                    bottom: isAnyAppOpen ? `${dockedConfig.bottom}px` : `${floatingConfig.bottom}px`,
                    left: isAnyAppOpen ? `${dockedConfig.left}px` : `calc(50% - ${(floatingConfig.width / 2 + floatingConfig.otherWidgetWidth / 2 + 6)}px)`,
                    margin: 0,
                }}
            >
                {/* Popover anchored directly to the player */}
                {visibleQueue && (
                    <QueuePopover
                        isNight={isNight}
                        nextTrack={nextTrackDetails}
                        onClose={handleCloseQueuePopover}
                        isClosing={isQueueClosing}
                    />
                )}

                <div className={`relative w-full h-full flex flex-col justify-between flex-1 self-stretch rounded-2xl squircle-card overflow-hidden z-[20] ${isNight ? 'bg-[#212121]' : 'bg-white'}`}>
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
        </>
    );
};

export default React.memo(MusicPlayer);
