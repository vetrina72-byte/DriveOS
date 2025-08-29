import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiMusic, FiAlertTriangle, FiHeart
} from 'react-icons/fi';
import { 
    IoPlaySharp, IoPauseSharp, IoPlaySkipBackSharp, IoPlaySkipForwardSharp
} from 'react-icons/io5';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { BsList } from 'react-icons/bs';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';

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
}

type PlayerStatus = 'disconnected' | 'connecting' | 'ready' | 'error';

const ProgressBar = ({ player, state }: { player: SpotifyPlayer | null, state: SpotifyPlayerState }) => {
    const [position, setPosition] = useState(state.position);
    const [isSeeking, setIsSeeking] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef(0);
    const lastUpdateTimeRef = useRef(Date.now());

    // Sync with Spotify state. This is our source of truth.
    useEffect(() => {
        if (!isSeeking) {
            setPosition(state.position);
            lastUpdateTimeRef.current = Date.now();
        }
    }, [state.position, isSeeking]);

    // Animate progress locally using requestAnimationFrame for smoothness when playing.
    useEffect(() => {
        const animate = () => {
            const now = Date.now();
            const elapsed = now - lastUpdateTimeRef.current;
            lastUpdateTimeRef.current = now;
            
            setPosition(prevPosition => Math.min(prevPosition + elapsed, state.duration));
            
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        if (!state.paused && !isSeeking) {
            lastUpdateTimeRef.current = Date.now();
            animationFrameRef.current = requestAnimationFrame(animate);
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
                animationFrameRef.current = 0;
            }
        };
    }, [state.paused, state.duration, isSeeking]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !player) return;
        
        setIsSeeking(true);
        
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
            player.seek(finalPosition);
            
            setTimeout(() => setIsSeeking(false), 50);
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
}) => {
    const {
        isAuthenticated,
        setDeviceId,
        playerState,
        _setPlayerState,
        volume,
        setVolume,
        getLatestAccessToken,
    } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('disconnected');
    const playerContainerRef = useRef<HTMLDivElement>(null);
    const [isAutoQueueEnabled, setIsAutoQueueEnabled] = useState(false);
    
    const [showQueue, setShowQueue] = useState(false);
    const [isQueuePopoverRendered, setIsQueuePopoverRendered] = useState(false);
    const queuePopoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isLiked, setIsLiked] = useState(false);

    const queueButtonRef = useRef<HTMLButtonElement>(null);
    const [popoverPosition, setPopoverPosition] = useState({ bottom: 0, left: 0, transform: '' });
    
    const isPlayerActive = playerStatus === 'ready' && playerState && playerState.track_window.current_track;
    const currentTrackId = playerState?.track_window.current_track?.id;
    const currentTrackUri = playerState?.track_window.current_track?.uri;
    const internalVolumeUpdate = useRef(false);
    const volumeRef = useRef(volume);
    useEffect(() => {
        volumeRef.current = volume;
    }, [volume]);

    // Effect to update SDK when context volume changes (e.g., from UI)
    useEffect(() => {
        if (playerRef.current && typeof volume === 'number') {
            if (internalVolumeUpdate.current) {
                internalVolumeUpdate.current = false;
                return;
            }
            playerRef.current.setVolume(volume).catch(e => console.error("Failed to set Spotify volume", e));
        }
    }, [volume]);

    // This effect runs only ONCE and sets up the Spotify player logic.
    // It is designed to be stable and not cause re-initialization loops.
    useEffect(() => {
        const scriptId = 'spotify-sdk';

        const initializePlayer = () => {
            // If a player instance already exists, do nothing to prevent re-initialization.
            if (playerRef.current) {
                return;
            }
            
            // Check for a token. If none exists, the user is not logged in.
            // The player won't be created. It will be created if the user logs in,
            // which causes this component to re-render with a new `isAuthenticated` state.
            const initialToken = getLatestAccessToken();
            if (!initialToken) {
                console.log("No auth token found, Spotify Player will not be initialized yet.");
                return;
            }

            setPlayerStatus('connecting');
            const player = new window.Spotify.Player({
                name: 'DrivingOS',
                // This is the simplified, stable token provider.
                getOAuthToken: cb => {
                    const token = getLatestAccessToken();
                    cb(token || '');
                },
                volume: 0.5 // Initial volume
            });

            player.on('ready', ({ device_id }) => {
                console.log('Player CONNESSO. Device ID ricevuto:', device_id);
                setDeviceId(device_id);
                setPlayerStatus('ready');

                // Automatically transfer playback to this new device.
                // This improves user experience by making the web player active immediately.
                apiClient.put('/me/player', {
                    device_ids: [device_id]
                }).catch(err => {
                    // This can fail if the user is in a private session or has no other active devices.
                    // It's not a critical error, so we just log a warning.
                    console.warn("Could not automatically transfer playback. User may need to select device manually.", err.response?.data || err.message);
                });
            });

            player.on('not_ready', ({ device_id }) => {
                console.warn('Spotify Player is not ready. Device ID:', device_id);
                setDeviceId(null);
                setPlayerStatus('disconnected');
            });

            player.on('player_state_changed', (state) => {
                _setPlayerState(state);
                player.getVolume().then(sdkVolume => {
                    if (typeof sdkVolume === 'number' && sdkVolume !== volumeRef.current) {
                        internalVolumeUpdate.current = true;
                        setVolume(sdkVolume);
                    }
                });
            });

            // This is the crucial error handler. It sets a local state instead of logging out,
            // which breaks the reported infinite loop.
            player.on('authentication_error', error => {
              console.error('Player SDK Authentication Error:', error);
              setPlayerStatus('error');
            });

            player.on('account_error', error => {
              console.error('Player SDK Account Error:', error);
              setPlayerStatus('error');
            });
            
            player.on('initialization_error', error => {
                console.error('Player SDK Initialization Error:', error);
                setPlayerStatus('error');
            });

            player.connect().then(success => {
                if (success) {
                    console.log('The Spotify Player has connected successfully!');
                } else {
                    console.error('The Spotify Player failed to connect.');
                }
            });
            
            playerRef.current = player;
        };

        if (!window.Spotify) {
            const script = document.createElement('script');
            script.id = scriptId;
            script.src = 'https://sdk.scdn.co/spotify-player.js';
            script.async = true;
            document.body.appendChild(script);
            window.onSpotifyWebPlaybackSDKReady = initializePlayer;
        } else {
            initializePlayer();
        }

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
        };
    // This effect now depends only on `isAuthenticated`. It will run once when the user
    // logs in, and the cleanup will run if they log out. This is a stable and correct
    // lifecycle that prevents re-initialization on simple re-renders or token refreshes.
    }, [isAuthenticated]);


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

    const handleTogglePlay = () => playerRef.current?.togglePlay();
    const handleNextTrack = () => playerRef.current?.nextTrack();
    const handlePrevTrack = () => playerRef.current?.previousTrack();

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
        if (!isAuthenticated) {
            return (
                <div className="flex items-center w-full h-full gap-5 px-4">
                    <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-primary)'}}>Connect to Spotify</div>
                        <div className="text-sm truncate" style={{ color: 'var(--text-secondary)'}}>
                            to start listening.
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
                        <div className="text-sm truncate">Please try refreshing the page.</div>
                    </div>
                </div>
            );
        }
        
        if (playerStatus === 'connecting') {
             return (
                <div className="flex items-center w-full h-full gap-5 px-4">
                    <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                        <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <div className="font-semibold truncate" style={{ color: 'var(--text-primary)'}}>Connecting to Spotify...</div>
                    </div>
                </div>
            );
        }
        
        if (isPlayerActive) {
            const { name: trackName, album, artists } = playerState.track_window.current_track!;
            const imageUrl = album.images[0]?.url;
            const nextTrack = playerState.track_window.next_tracks[0];
            
            const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
            const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';
            
            const songTitleColor = isNight 
              ? '#f7f7f7'
              : (playerState.paused ? '#454545' : '#000000');
            
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
                        <ProgressBar player={playerRef.current} state={playerState} />
                    </div>
                    
                    <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                        <div className="flex-1 flex justify-start">
                            {/* Empty left spacer */}
                        </div>
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
                            nextTrack={nextTrack}
                            position={popoverPosition}
                            isClosing={!showQueue}
                            onClose={() => setShowQueue(false)}
                        />
                    )}
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
        <div 
            ref={playerContainerRef}
            className={`music-player ${themeClasses} backdrop-blur-md border rounded-xl shadow-lg flex items-center gap-5 overflow-hidden`}
            style={playerStyle}
        >
            {renderPlayerContent()}
        </div>
    );
};

export default MusicPlayer;