
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import YouTube from 'react-youtube';
import { useAuth } from '../context/AuthContext';
import apiClient from '../spotifyClient';
import { useUIConfig } from '../context/UIConfigContext';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiRadio, FiSmartphone, FiMonitor, FiSpeaker, FiTv, FiTablet, FiCast, FiHeadphones, FiBluetooth
} from 'react-icons/fi';
import { Sparkles } from 'lucide-react';
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
            className={`font-semibold overflow-hidden whitespace-nowrap w-full ${isAnyAppOpen ? 'text-xs sm:text-sm' : 'text-sm'}`} 
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

    // Local progress state incremented every second when playing
    const [progressMs, setProgressMs] = useState<number>(state.position || 0);

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

    // --- DYNAMIC UPDATE LOOP ---
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
            } else {
                if (optimisticSeekRef.current) {
                    if (!state.paused && !isRecentAction) {
                        currentPos = optimisticSeekRef.current.pos + (Date.now() - optimisticSeekRef.current.ts);
                    } else {
                        currentPos = optimisticSeekRef.current.pos;
                    }
                } else {
                    if (!state.paused && !isRecentAction) {
                        currentPos = state.position + (Date.now() - state.timestamp);
                    } else {
                        currentPos = state.position;
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
            : playerControlsGap) 
        : playerControlsGap;
    
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

    const [djToast, setDjToast] = useState<string | null>(null);

    const isDjActive = useMemo(() => {
        if (source !== 'spotify' || !playerState) return false;
        const contextUri = playerState.context?.uri || '';
        const currentTrack = playerState.track_window?.current_track;
        const currentUri = currentTrack?.uri || '';
        const trackName = currentTrack?.name?.toLowerCase() || '';

        return contextUri.includes('37i9dQZF1EYkqdzj48dyYq') || 
               currentUri.includes('37i9dQZF1EYkqdzj48dyYq') || 
               trackName.includes('dj spotify') || 
               trackName === 'dj';
    }, [source, playerState]);

    const { sceneTransitionSpeed = 1.10 } = useUIConfig();

    // --- ANIMATION LOGIC FOR PLAYER SIZE/POSITION ---
    const visualState = useRef(isAnyAppOpen ? 0 : 1); // 0 = Docked (App Open), 1 = Floating (App Closed)
    const wasDraggingRef = useRef(false);

    const lastIsAnyAppOpen = useRef(isAnyAppOpen);
    const startT = useRef(isAnyAppOpen ? 0 : 1);
    const animStartTime = useRef(0);

    const playingStateRef = useRef({ isPlaying: false });
    const glowAngleRef = useRef(0);
    const glowIntensityRef = useRef(0);
    const rhythmPhaseRef = useRef(0);
    const djToastRef = useRef<HTMLDivElement>(null);
    const glowWavesRef = useRef<HTMLDivElement>(null);
    const orb1Ref = useRef<HTMLDivElement>(null);
    const orb2Ref = useRef<HTMLDivElement>(null);
    const orb3Ref = useRef<HTMLDivElement>(null);

    const isDjActiveRef = useRef(isDjActive);
    useEffect(() => {
        isDjActiveRef.current = isDjActive;
    }, [isDjActive]);

    const isNightRef = useRef(isNight);
    useEffect(() => {
        isNightRef.current = isNight;
    }, [isNight]);

    const playerStateRef = useRef(playerState);
    useEffect(() => {
        playerStateRef.current = playerState;
    }, [playerState]);

    const currentTrackId = useMemo(() => {
        const track = playerState?.track_window?.current_track ?? (playerState as any)?.item;
        if (!track) return null;
        if (track.id) return track.id;
        if (track.uri) {
            const parts = track.uri.split(':');
            return parts[parts.length - 1];
        }
        return null;
    }, [playerState]);

    const spotifyAnalysisCacheRef = useRef<Record<string, any>>({});
    const spotifyAnalysisRef = useRef<any>(null);
    const spotifyFeaturesCacheRef = useRef<Record<string, any>>({});
    const spotifyFeaturesRef = useRef<any>(null);

    useEffect(() => {
        if (!currentTrackId || source !== 'spotify') {
            spotifyAnalysisRef.current = null;
            spotifyFeaturesRef.current = null;
            return;
        }

        if (spotifyAnalysisCacheRef.current[currentTrackId]) {
            spotifyAnalysisRef.current = spotifyAnalysisCacheRef.current[currentTrackId];
        } else {
            apiClient.get(`/audio-analysis/${currentTrackId}`)
                .then(res => {
                    if (res.data) {
                        spotifyAnalysisCacheRef.current[currentTrackId] = res.data;
                        spotifyAnalysisRef.current = res.data;
                        console.log("[Spotify Reactivity] Successfully loaded real audio analysis for track:", currentTrackId);
                    }
                })
                .catch(err => {
                    console.warn("[Spotify Reactivity] Failed to fetch audio analysis:", err);
                    spotifyAnalysisRef.current = null;
                });
        }

        if (spotifyFeaturesCacheRef.current[currentTrackId]) {
            spotifyFeaturesRef.current = spotifyFeaturesCacheRef.current[currentTrackId];
        } else {
            apiClient.get(`/audio-features/${currentTrackId}`)
                .then(res => {
                    if (res.data) {
                        spotifyFeaturesCacheRef.current[currentTrackId] = res.data;
                        spotifyFeaturesRef.current = res.data;
                        console.log("[Spotify Reactivity] Successfully loaded real audio features (BPM:", res.data.tempo, "Energy:", res.data.energy, ") for track:", currentTrackId);
                    }
                })
                .catch(err => {
                    console.warn("[Spotify Reactivity] Failed to fetch audio features:", err);
                    spotifyFeaturesRef.current = null;
                });
        }
    }, [currentTrackId, source]);

    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const sourceNodeRef = useRef<any>(null);

    // Web Audio Peak Detection (Metodo 2) and Beat Trigger refs
    const filterRef = useRef<BiquadFilterNode | null>(null);
    const localRmsHistoryRef = useRef<number[]>([]);
    const localRmsThresholdRef = useRef<number>(0.15);
    const lastLocalBeatTimeRef = useRef<number>(0);
    const lastBeatStartRef = useRef<number>(-1);
    const beatProgressRef = useRef<number>(0);
    const lastFrameTimeRef = useRef<number>(performance.now());

    const initAudioAnalyser = useCallback(() => {
        if (analyserRef.current || !audioRef.current) return;
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 64; // Small fft size is perfect for fast bass/beat extraction
            
            // Create low-pass filter (20Hz to 140Hz for bass/kick detection)
            const filter = ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(140, ctx.currentTime);
            
            const sourceNode = ctx.createMediaElementSource(audioRef.current);
            
            // Connect to analyser through the low-pass filter so analyser ONLY receives bass frequencies
            sourceNode.connect(filter);
            filter.connect(analyser);
            
            // Connect source directly to destination so user hears normal, unfiltered sound
            sourceNode.connect(ctx.destination);

            audioContextRef.current = ctx;
            analyserRef.current = analyser;
            filterRef.current = filter;
            sourceNodeRef.current = sourceNode;
            console.log("[Spotify Reactivity] Successfully initialized Web Audio low-pass analyser for peak detection.");
        } catch (err) {
            console.warn("Could not construct Web Audio analyser with low-pass filter:", err);
        }
    }, []);

    const isPlayingGlobal = source === 'spotify' ? !playerState?.paused : (source === 'youtube' ? isYouTubePlaying : (source === 'radio' ? isRadioPlaying : false));

    useEffect(() => {
        playingStateRef.current.isPlaying = isPlayingGlobal;
        if (isPlayingGlobal) {
            initAudioAnalyser();
            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                audioContextRef.current.resume().catch(() => {});
            }
        }
    }, [isPlayingGlobal, initAudioAnalyser]);

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

                // Posiziona il pop-up Cambia Mood (djToast) dinamicamente esattamente centrato sopra il player
                if (djToastRef.current) {
                    djToastRef.current.style.bottom = `calc(${(currentBottom + currentHeight) / 16}rem + 16px)`;
                    djToastRef.current.style.left = `calc(${pct}% + ${(offsetPx + currentWidth / 2) / 16}rem)`;
                }

                // --- PREMIUM MULTI-EFFECT AI DJ GLOW (MUSIC-REACTIVE COLOR SPECTRUM + ORBITAL SWIRL + HARMONIC PULSE) ---
                const isDjActiveVal = isDjActiveRef.current;
                const isPlaying = playingStateRef.current.isPlaying;
                
                // Intensità del glow progressiva (aumenta o diminuisce gradualmente) - ATTIVA SOLO PER AI DJ
                if (isDjActiveVal && isPlaying) {
                    glowIntensityRef.current = Math.min(1.0, glowIntensityRef.current + 0.05);
                } else {
                    glowIntensityRef.current = Math.max(0.0, glowIntensityRef.current - 0.05);
                }
                const intensity = glowIntensityRef.current;
                
                // Calculate real frame delta for smooth ease-out attenuation of beatProgress
                const nowMs = performance.now();
                const deltaSec = Math.min(0.1, (nowMs - lastFrameTimeRef.current) / 1000);
                lastFrameTimeRef.current = nowMs;

                // Decay the beat progress with a smooth ease-out curve
                beatProgressRef.current = Math.max(0, beatProgressRef.current - deltaSec * 4.5); // full decay in ~220ms
                const beatFactor = beatProgressRef.current;

                if (intensity > 0.01) {
                    // Estrazione delle frequenze musicali (bassi, medi, alti)
                    let finalBass = 0.20;
                    let finalMid = 0.20;
                    let finalTreble = 0.15;

                    if (isPlaying) {
                        if (source === 'spotify') {
                            const pState = playerStateRef.current;
                            let currentPosSec = 0;
                            if (pState) {
                                // 180ms of latency buffer compensation to align visual glow perfectly with real speaker output
                                const latencyCompensation = 180;
                                const timeSinceUpdate = pState.paused ? 0 : (Date.now() - pState.timestamp);
                                currentPosSec = Math.max(0, (pState.position + timeSinceUpdate - latencyCompensation) / 1000);
                            }

                            const analysis = spotifyAnalysisRef.current;
                            const features = spotifyFeaturesRef.current;
                            
                            // Dynamic tempo and audio metrics fetched from the active Spotify song
                            const tempo = features?.tempo || analysis?.track?.tempo || 120;
                            const energy = features?.energy || 0.6;
                            const danceability = features?.danceability || 0.5;

                            if (analysis && currentPosSec > 0) {
                                // Scansione lineare gap-free dei segmenti audio caricati dal progetto interno
                                let segment = null;
                                const segments = analysis.segments || [];
                                for (let i = 0; i < segments.length; i++) {
                                    if (currentPosSec >= segments[i].start) {
                                        segment = segments[i];
                                    } else {
                                        break;
                                    }
                                }

                                // Scansione lineare gap-free dei battiti audio caricati dal progetto interno (Metodo 1)
                                let beat = null;
                                const beats = analysis.beats || [];
                                for (let i = 0; i < beats.length; i++) {
                                    if (currentPosSec >= beats[i].start) {
                                        beat = beats[i];
                                    } else {
                                        break;
                                    }
                                }

                                if (segment) {
                                    // Loudness: typical ranges from -60dB (silent) to 0dB (max). Map -40dB..-3dB into 0.05..1.0
                                    const loudnessDb = segment.loudness_max ?? -20;
                                    const normLoudness = Math.max(0.05, Math.min(1, (loudnessDb + 40) / 37));

                                    // Pitches (chromatic scale: 12 values between 0..1 representing pitch prominence)
                                    const bassWeight = segment.pitches ? (segment.pitches[0] + segment.pitches[1] + segment.pitches[11]) / 3 : 0.5;
                                    const midWeight = segment.pitches ? (segment.pitches[2] + segment.pitches[3] + segment.pitches[4] + segment.pitches[5] + segment.pitches[6]) / 5 : 0.5;
                                    const trebleWeight = segment.pitches ? (segment.pitches[7] + segment.pitches[8] + segment.pitches[9] + segment.pitches[10]) / 4 : 0.5;

                                    if (beat) {
                                        // Trigger beat bump/kick strictly at the start of the beat!
                                        if (beat.start !== lastBeatStartRef.current) {
                                            beatProgressRef.current = 1.0;
                                            lastBeatStartRef.current = beat.start;
                                        }
                                    }

                                    // Real physical values mapped directly to final outputs
                                    finalBass = Math.max(0.12, (normLoudness * 0.35) + (beatFactor * 0.50) + (bassWeight * 0.15));
                                    finalMid = Math.max(0.10, (normLoudness * 0.30) + (midWeight * 0.50) + (beatFactor * 0.20));
                                    finalTreble = Math.max(0.05, (normLoudness * 0.30) + (trebleWeight * 0.50));
                                } else {
                                    // Stable resting fallback
                                    finalBass = 0.15 + beatFactor * 0.50;
                                    finalMid = 0.12 + beatFactor * 0.30;
                                    finalTreble = 0.08 + beatFactor * 0.20;
                                }
                            } else {
                                // Stable resting fallback
                                finalBass = 0.15 + beatFactor * 0.50;
                                finalMid = 0.12 + beatFactor * 0.30;
                                finalTreble = 0.08 + beatFactor * 0.20;
                            }
                        } else if (analyserRef.current) {
                            // Real-time audio frequency/time-domain analysis with Peak Detection on Bass (Metodo 2)
                            const bufferLength = analyserRef.current.fftSize;
                            const timeData = new Uint8Array(bufferLength);
                            analyserRef.current.getByteTimeDomainData(timeData);
                            
                            // Calculate RMS (energy) of the lowpass filtered bass signal
                            let sum = 0;
                            for (let i = 0; i < bufferLength; i++) {
                                const val = (timeData[i] - 128) / 128;
                                sum += val * val;
                            }
                            const rms = Math.sqrt(sum / bufferLength);
                            
                            // Keep a running history of RMS to compute dynamic threshold
                            if (!localRmsHistoryRef.current) {
                                localRmsHistoryRef.current = [];
                            }
                            localRmsHistoryRef.current.push(rms);
                            if (localRmsHistoryRef.current.length > 60) {
                                localRmsHistoryRef.current.shift();
                            }
                            
                            const avgRms = localRmsHistoryRef.current.reduce((a, b) => a + b, 0) / localRmsHistoryRef.current.length;
                            const dynamicThreshold = Math.max(0.06, avgRms * 1.35);
                            
                            // Peak detection trigger
                            const nowMs = performance.now();
                            if (rms > dynamicThreshold && rms > localRmsThresholdRef.current && (nowMs - lastLocalBeatTimeRef.current > 220)) {
                                beatProgressRef.current = 1.0;
                                lastLocalBeatTimeRef.current = nowMs;
                            }
                            
                            localRmsThresholdRef.current = rms;
                            
                            // Map the filtered RMS directly to finalBass to drive the visual pulse intensity
                            finalBass = Math.max(0.12, rms * 4.0);
                            finalMid = Math.max(0.10, rms * 2.0);
                            finalTreble = Math.max(0.05, rms * 1.0);
                        } else {
                            // Stable resting fallback
                            finalBass = 0.15 + beatFactor * 0.50;
                            finalMid = 0.12 + beatFactor * 0.30;
                            finalTreble = 0.08 + beatFactor * 0.20;
                        }

                        // Increment accumulated rhythm phase strictly proportional to the music intensity
                        rhythmPhaseRef.current += (0.01 + finalBass * 0.022);
                    } else {
                        // In pause, return slowly to standard resting state with ease-out
                        finalBass = 0.12;
                        finalMid = 0.10;
                        finalTreble = 0.05;
                    }

                    const reactiveBass = finalBass * intensity;
                    const reactiveMid = finalMid * intensity;
                    const reactiveTreble = finalTreble * intensity;

                    const phase = rhythmPhaseRef.current;

                    // Spostamento Orbitale (Swirl) dei centri delle ombre reattivo AL RITMO ACCUMULATO (si blocca se in pausa)
                    const xOffset1 = Math.cos(phase * 1.8) * 8 * reactiveBass;
                    const yOffset1 = Math.sin(phase * 1.4) * 6 * reactiveBass;
                    
                    const xOffset2 = Math.sin(phase * 1.5) * -10 * reactiveMid;
                    const yOffset2 = Math.cos(phase * 1.1) * 8 * reactiveMid;
                    
                    // Colori Cangianti (Color Shifting) nello spettro dell'AI DJ guidati dal ritmo accumulato
                    // Emerald spectrum for AI DJ, gorgeous Indigo/Violet/Fuchsia for standard playback
                    const hue1 = isDjActiveVal ? (140 + Math.sin(phase * 0.5) * 20) : (260 + Math.sin(phase * 0.5) * 25); 
                    const hue2 = isDjActiveVal ? (165 + Math.cos(phase * 0.3) * 25) : (320 + Math.cos(phase * 0.3) * 30); 
                    const hue3 = isDjActiveVal ? (115 + Math.sin(phase * 0.7) * 15) : (220 + Math.sin(phase * 0.7) * 20); 
                    
                    // Calcolo dinamico di blur e spread basato sul beatFactor "bump" reale e la musica
                    const b1 = 14 + (beatFactor * 26) + (reactiveBass * 10);
                    const s1 = 1.5 + (beatFactor * 8.0) + (reactiveBass * 2.0);

                    const b2 = 22 + (beatFactor * 32) + (reactiveMid * 12);
                    const s2 = 2.0 + (beatFactor * 10.0) + (reactiveMid * 2.5);
                    
                    const shadow1 = `${xOffset1}px ${yOffset1}px ${b1}px ${s1}px hsla(${hue1}, 80%, 48%, ${0.65 * intensity})`;
                    const shadow2 = `${xOffset2}px ${yOffset2}px ${b2}px ${s2}px hsla(${hue2}, 75%, 45%, ${0.55 * intensity})`;
                    const shadow3 = `0 0 ${10 + (beatFactor * 15) + (reactiveTreble * 10)}px ${0.5 + (beatFactor * 3) + (reactiveTreble * 2.0)}px hsla(${hue3}, 85%, 50%, ${0.40 * intensity})`;

                    playerContainerRef.current.style.boxShadow = `${shadow1}, ${shadow2}, ${shadow3}`;
                    playerContainerRef.current.style.borderColor = `hsla(${hue1}, 80%, 48%, ${0.4 * intensity})`;
                    playerContainerRef.current.style.background = !isNightRef.current ? widgetBgColor : 'var(--player-bg)';

                    // Dynamic scale bump (physics bounce effect) on beat trigger
                    const currentScale = 1.0 + beatFactor * 0.022;
                    playerContainerRef.current.style.transform = `scale(${currentScale})`;
                } else {
                    // Standard shadow (shadow-xl style with subtle border ring emulation)
                    playerContainerRef.current.style.boxShadow = isNightRef.current 
                        ? '0 20px 40px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)' 
                        : '0 20px 40px -15px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.04)';
                    playerContainerRef.current.style.borderColor = '';
                    playerContainerRef.current.style.background = !isNightRef.current ? widgetBgColor : 'var(--player-bg)';
                    playerContainerRef.current.style.transform = 'none';
                }
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
    const isPlayerActive = Boolean(playerState && (playerState?.track_window?.current_track || (playerState as any)?.item));
    
    const currentTrack = playerState?.track_window?.current_track ?? (playerState as any)?.item;
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

    const handleChangeDjGenre = useCallback(() => {
        setDjToast("DJ Spotify: Cambio atmosfera...");
        handleNextTrack();
        setTimeout(() => {
            setDjToast(null);
        }, 2800);
    }, [handleNextTrack]);
    
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
            const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';
            const isYouTubePlaylist = Boolean(youtubePlaylist && youtubePlaylist.length > 0);
            const currentTrackIndex = youtubePlaylist ? youtubePlaylist.findIndex(track => track.videoId === youtubeTrack.videoId) : -1;

            return (
                 <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className={`flex items-center min-w-0 ${isAnyAppOpen ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3'}`}>
                            <img src={thumbnail} alt={title} className={`${isAnyAppOpen ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12'} rounded-lg object-cover flex-shrink-0 shadow-lg`} />
                            <div className={`overflow-hidden flex-grow min-w-0 ${isAnyAppOpen ? 'shrink' : ''}`}>
                                <DynamicTrackTitle title={title} isAnyAppOpen={Boolean(isAnyAppOpen)} />
                                <div className={`truncate ${isAnyAppOpen ? 'text-[10px] sm:text-xs' : 'text-xs'}`} style={{ color: 'var(--text-secondary)' }}>{channelTitle}</div>
                            </div>
                        </div>
                        <div className={`flex items-center flex-shrink-0 pl-2 ${isAnyAppOpen ? 'gap-2 sm:gap-5' : 'gap-5'}`}>
                            <div className="flex items-center" style={{ gap: `${(spinnerShuffleGap) / 16}rem`}}>
                                <button
                                    onClick={handleToggleYouTubeShuffle}
                                    className="transition"
                                    style={{ color: isYouTubeShuffle ? buttonActiveColor : inactiveButtonColor }}
                                    aria-label={isYouTubeShuffle ? "Disable shuffle" : "Enable shuffle"}
                                >
                                    <PiShuffleBold className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
                                </button>
                            </div>
                            <button
                                onClick={handleToggleYouTubeRepeat}
                                className="transition"
                                style={{ color: youtubeRepeatMode > 0 ? buttonActiveColor : inactiveButtonColor }}
                                aria-label="Set repeat mode"
                            >
                                {youtubeRepeatMode === 2 ? (
                                    <PiRepeatOnceBold className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
                                ) : (
                                    <PiRepeatBold className={`${isAnyAppOpen ? 'w-4 h-4 sm:w-5 sm:h-5' : 'w-5 h-5'}`} />
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
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${(playerControlsVerticalPosition) / 16}rem)`}}>
                        <div className={`transition-all duration-300 ${isAnyAppOpen ? 'flex-none w-0 sm:flex-1' : 'flex-1'}`}></div>
                        <div 
                            className={isAnyAppOpen ? "flex items-center shrink" : "flex items-center"} 
                            style={{ gap: `${(effectiveControlsGap) / 16}rem` }}
                        >
                            <button 
                                onClick={handlePrevTrack} 
                                disabled={!isYouTubePlaylist || (youtubeRepeatMode === 0 && currentTrackIndex <= 0)} 
                                className="transition disabled:opacity-30 disabled:cursor-not-allowed" 
                                style={{ color: buttonActiveColor }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7 6c.55 0 1 .45 1 1v10c0 .55-.45 1-1 1s-1-.45-1-1V7c0-.55.45-1 1-1zm3.66 6.82l5.77 4.07c.66.47 1.58-.01 1.58-.82V7.93c0-.81-.91-1.28-1.58-.82l-5.77 4.07c-.57.4-.57 1.24 0 1.64z"/></svg>
                            </button>
                            <button onClick={handleTogglePlay} style={{ color: buttonActiveColor }}>
                                {isYouTubePlaying
                                    ? <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 -960 960 960" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M601.92-220q-18.51 0-31.94-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q583.41-740 601.92-740h70q18.51 0 31.95 13.44 13.44 13.44 13.44 31.95v429.22q0 18.51-13.44 31.95Q690.43-220 671.92-220h-70Zm-313.84 0q-18.51 0-31.95-13.44-13.44-13.44-13.44-31.95v-429.22q0-18.51 13.44-31.95Q269.57-740 288.08-740h70.38q18.21 0 31.8 13.44t13.59 31.95v429.22q0 18.51-13.59 31.95Q376.67-220 358.46-220h-70.38Z"/></svg>
                                    : <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 2.0) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 2.0) / 16}rem`} style={{ transform: `scale(${playButtonScale})` }} fill="currentColor"><path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z"/></svg>
                                }
                            </button>
                            <button 
                                onClick={handleNextTrack} 
                                disabled={!isYouTubePlaylist || (youtubeRepeatMode === 0 && !isYouTubeShuffle && currentTrackIndex >= (youtubePlaylist?.length ?? 1) - 1)} 
                                className="transition disabled:opacity-30 disabled:cursor-not-allowed" 
                                style={{ color: buttonActiveColor }}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" height={`${(playerControlsSize * 1.4) / 16}rem`} viewBox="0 0 24 24" width={`${(playerControlsSize * 1.4) / 16}rem`} style={{ transform: `scale(${skipButtonScale})` }} fill="currentColor"><path d="M7.58 16.89l5.77-4.07c.56-.4.56-1.24 0-1.63L7.58 7.11C6.91 6.65 6 7.12 6 7.93v8.14c0 .81.91 1.28 1.58.82zM16 7v10c0 .55.45 1 1 1s1-.45 1-1V7c0-.55-.45-1-1-1s-1 .45-1 1z"/></svg>
                            </button>
                            {/* Invisible placeholder matching Spotify Like button so Prev/Play/Next positions are identical across all sources */}
                            <div style={{ width: `${(playerControlsSize * (isAnyAppOpen ? 0.8 : 0.9)) / 16}rem`, height: `${(playerControlsSize * (isAnyAppOpen ? 0.8 : 0.9)) / 16}rem`}} aria-hidden="true" />
                        </div>
                        <div className={`flex-1 flex justify-end items-center ${isAnyAppOpen ? 'shrink-0' : ''}`}>
                            <button ref={youTubeQueueButtonRef} onClick={() => handleToggleQueue('youtube')} className={`p-1 rounded-full transition-all duration-200`} style={{ color: visibleQueue === 'youtube' ? buttonActiveColor : inactiveButtonColor }}>
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
            const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';
            const songTitleColor = isNight ? '#f7f7f7' : (playerState.paused ? '#454545' : '#000000');
                 return (
                <div className="w-full h-full flex flex-col justify-between px-4 py-2">
                    <div className="flex items-center justify-between w-full">
                        <div className={`flex items-center min-w-0 ${isAnyAppOpen ? 'gap-2 sm:gap-3 flex-1 shrink' : 'gap-3'}`}>
                            {imageUrl && (
                                <div className="flex-shrink-0 relative">
                                    <img src={imageUrl} alt={albumName} className={`${isAnyAppOpen ? 'w-10 h-10 sm:w-12 sm:h-12' : 'w-12 h-12'} rounded-lg shadow-lg object-cover`} />
                                    {(nowPlaying.isLoading || (playerState as any)?.isLoading) && (
                                        <div className="absolute inset-0 bg-black/40 rounded-lg flex items-center justify-center backdrop-blur-[1px]">
                                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className={`overflow-hidden flex-grow min-w-0 ${isAnyAppOpen ? 'shrink' : ''}`}>
                                <DynamicTrackTitle title={trackName} isAnyAppOpen={Boolean(isAnyAppOpen)} />
                                <div className={`truncate ${isAnyAppOpen ? 'text-[10px] sm:text-xs' : 'text-xs'}`} style={{ color: 'var(--text-secondary)' }}>{artists}</div>
                            </div>
                        </div>
                        <div className={`flex items-center flex-shrink-0 pl-2 ${isAnyAppOpen ? 'gap-2 sm:gap-3' : 'gap-3'}`}>
                            {isDjActive && (
                                <button
                                    onClick={handleChangeDjGenre}
                                    title="Cambia Genere (Spotify AI DJ)"
                                    className="group flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 border border-emerald-500/25 hover:border-emerald-500/50 transition-all duration-300 ease-in-out active:scale-95 cursor-pointer shadow-[0_4px_16px_rgba(16,185,129,0.35)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.55)]"
                                >
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 group-hover:text-emerald-300 transition-colors duration-300" />
                                    <span className="whitespace-nowrap">Cambia Mood</span>
                                </button>
                            )}
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
                            <button ref={spotifyQueueButtonRef} onClick={() => handleToggleQueue('spotify')} className={`p-1 rounded-full transition-all duration-200 ${(playerState?.track_window?.next_tracks ?? []).length === 0 ? 'opacity-40' : ''}`} style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}>
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

    const nextSpotifyTrack = playerState?.track_window?.next_tracks?.[0];
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
                className={`fixed z-[2000] backdrop-blur-md rounded-xl overflow-hidden max-w-[calc(100vw-32px)] transition-all duration-500 border ${themeClasses} shadow-xl ${
                    isDjActive 
                        ? 'ring-1 ring-emerald-500/40' 
                        : (isNight ? 'ring-1 ring-white/10' : 'ring-1 ring-black/5')
                }`}
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
            {djToast && (
                <>
                    <style>{`
                        @keyframes dj-toast-in {
                            0% { transform: translate(-50%, 12px) scale(0.92); opacity: 0; }
                            100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                        }
                        .dj-toast-animate {
                            animation: dj-toast-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards;
                        }
                    `}</style>
                    <div 
                        ref={djToastRef}
                        className="fixed dj-toast-animate px-4 py-2.5 rounded-full bg-zinc-900/90 backdrop-blur-lg text-zinc-100 border border-white/5 text-[11px] font-bold tracking-wide shadow-[0_10px_35px_rgba(0,0,0,0.55)] z-[9999] flex items-center gap-2 pointer-events-none"
                        style={{
                            left: '50%',
                            bottom: '8rem',
                            transform: 'translateX(-50%)',
                        }}
                    >
                        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{djToast}</span>
                    </div>
                </>
            )}
        </>
    );
};

export default React.memo(MusicPlayer);
