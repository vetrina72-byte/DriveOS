import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiMusic, FiAlertTriangle, FiHeart, FiLoader, FiRadio
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
    onStationChange: (direction: 'next' | 'prev') => void;
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

type PlayerStatus = 'connecting' | 'ready' | 'error';

const ProgressBar = ({ player, state }: { player: SpotifyPlayer | null, state: SpotifyPlayerState }) => {
    const [position, setPosition] = useState(state.position);
    const [isSeeking, setIsSeeking] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef(0);
    const lastUpdateTimeRef = useRef(Date.now());

    useEffect(() => {
        if (!isSeeking) {
            setPosition(state.position);
            lastUpdateTimeRef.current = Date.now();
        }
    }, [state.position, isSeeking]);

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

const IdlePlayerContent: React.FC<Pick<MusicPlayerProps, 'isNight'>> = ({ isNight }) => (
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


const MusicPlayer: React.FC<MusicPlayerProps> = (props) => {
    const { nowPlaying } = useAuth();

    const playerStyle: React.CSSProperties = useMemo(() => {
        let baseStyle: React.CSSProperties;
        if (props.isAnyAppOpen) {
            baseStyle = {
                width: `${props.dockedConfig.width}px`,
                height: `${props.dockedConfig.height}px`,
                bottom: `${props.dockedConfig.bottom}px`,
                left: `${props.dockedConfig.left}px`,
                transform: 'translateX(0)',
            };
        } else {
            const { width, bottom, height, otherWidgetWidth } = props.floatingConfig;
            const transformX = -otherWidgetWidth / 2 - 8;
            baseStyle = {
                width: `${width}px`,
                height: `${height}px`,
                bottom: `${bottom}px`,
                left: '50%',
                transform: `translateX(calc(-50% + ${transformX}px))`,
            };
        }
        baseStyle.background = !props.isNight ? props.widgetBgColor : 'var(--player-bg)';
        return baseStyle;
    }, [props.isAnyAppOpen, props.dockedConfig, props.floatingConfig, props.widgetBgColor, props.isNight]);

    const themeClasses = props.isNight 
        ? 'border-zinc-700/80' 
        : 'border-zinc-300';
    
    const renderPlayerContent = () => {
        if (nowPlaying.source === 'spotify' && nowPlaying.spotifyState) {
            return <SpotifyPlayerContent {...props} spotifyState={nowPlaying.spotifyState} />;
        }
        if (nowPlaying.source === 'radio' && nowPlaying.radioStation) {
            return <RadioPlayerContent {...props} station={nowPlaying.radioStation} />;
        }
        return <IdlePlayerContent isNight={props.isNight} />;
    };

    return (
        <div
            className={`music-player ${themeClasses} backdrop-blur-md border rounded-xl shadow-lg flex items-center gap-5 overflow-hidden`}
            style={playerStyle}
        >
            {renderPlayerContent()}
        </div>
    );
};

// --- RADIO PLAYER SUB-COMPONENT ---
const RadioPlayerContent: React.FC<MusicPlayerProps & { station: RadioStation }> = ({
    station, onStationChange, isNight, playerControlsSize, playerControlsGap, playerControlsVerticalPosition, dayPlayerButtonColor, nightPlayerButtonColor
}) => {
    const audioRef = useRef<HTMLAudioElement>(null);
    const hlsRef = useRef<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const { volume } = useAuth();
    const [isLiked, setIsLiked] = useState(false);

    useEffect(() => {
        const favorites: RadioStation[] = JSON.parse(localStorage.getItem('radio_favorites') || '[]');
        setIsLiked(favorites.some(fav => fav.stationuuid === station.stationuuid));
    }, [station]);
    
    const handleToggleLike = () => {
        const favorites: RadioStation[] = JSON.parse(localStorage.getItem('radio_favorites') || '[]');
        const newLikedState = !isLiked;
        let newFavorites;

        if (newLikedState) {
            newFavorites = [...favorites, station];
        } else {
            newFavorites = favorites.filter(fav => fav.stationuuid !== station.stationuuid);
        }
        
        localStorage.setItem('radio_favorites', JSON.stringify(newFavorites));
        setIsLiked(newLikedState);
    };

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const sourceUrl = station.url_resolved;
        
        audio.pause();
        audio.removeAttribute('src');

        if (hlsRef.current) {
            hlsRef.current.destroy();
            hlsRef.current = null;
        }
        
        if (sourceUrl.includes('.m3u8')) {
            if ((window as any).Hls && (window as any).Hls.isSupported()) {
                const hls = new (window as any).Hls();
                hlsRef.current = hls;
                hls.loadSource(sourceUrl);
                hls.attachMedia(audio);
                hls.on((window as any).Hls.Events.MANIFEST_PARSED, () => {
                    audio.play().catch(e => console.error("HLS Autoplay failed", e));
                });
                hls.on((window as any).Hls.Events.ERROR, (event: any, data: any) => {
                    if (data.fatal) console.error('Fatal HLS error:', data);
                });
            } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
                audio.src = sourceUrl;
                audio.addEventListener('loadedmetadata', () => {
                    audio.play().catch(e => console.error("Native HLS Autoplay failed", e));
                });
            } else {
                console.error("HLS is not supported in this browser.");
            }
        } else {
            audio.src = sourceUrl;
            audio.play().catch(error => console.error("Direct stream Autoplay failed:", error));
        }

        const handlePlay = () => setIsPlaying(true);
        const handlePause = () => setIsPlaying(false);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('playing', handlePlay); 
        audio.addEventListener('pause', handlePause);
        
        return () => {
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('playing', handlePlay);
            audio.removeEventListener('pause', handlePause);
            if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
            }
        };
    }, [station.url_resolved]);
    
    useEffect(() => {
        if (audioRef.current) audioRef.current.volume = volume;
    }, [volume]);

    const handleTogglePlay = () => {
        if (audioRef.current) {
            isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(e => console.error("Failed to play on toggle", e));
        }
    };

    const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
    const songTitleColor = isNight ? '#f7f7f7' : '#000000';
    const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';

    return (
        <div className="w-full h-full flex flex-col justify-between px-4 py-3">
            <audio ref={audioRef} playsInline />
            
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-3 min-w-0">
                    {station.favicon ? (
                         <img src={station.favicon} alt={station.name} className="w-12 h-12 rounded-lg object-contain" />
                    ) : (
                        <div className="w-12 h-12 rounded-lg bg-zinc-800 flex items-center justify-center">
                            <FiRadio className="w-7 h-7 text-zinc-500" />
                        </div>
                    )}
                    <div className="overflow-hidden">
                        <div className="font-semibold text-sm truncate" style={{ color: songTitleColor }}>{station.name}</div>
                        <div className="text-xs truncate" style={{ color: 'var(--text-secondary)'}}>Live Radio</div>
                    </div>
                </div>
                <button onClick={handleToggleLike} className="transition flex-shrink-0 ml-4 p-1" style={{ color: isLiked ? buttonActiveColor : inactiveButtonColor }}>
                    <FiHeart style={{ width: `${playerControlsSize * 1.1}px`, height: `${playerControlsSize * 1.1}px`}} className={`${isLiked ? 'fill-current' : ''}`} />
                </button>
            </div>

            <div className="w-full flex justify-center items-center" style={{ gap: `${playerControlsGap}px`, transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                <button onClick={() => onStationChange('prev')} className="transition" style={{ color: buttonActiveColor }}>
                    <IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} />
                </button>
                <button onClick={handleTogglePlay} className="transition" style={{ color: buttonActiveColor }}>
                    {isPlaying 
                        ? <IoPauseSharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /> 
                        : <IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /> 
                    }
                </button>
                <button onClick={() => onStationChange('next')} className="transition" style={{ color: buttonActiveColor }}>
                    <IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} />
                </button>
            </div>

            <div className="w-full h-1" />
        </div>
    );
};


// --- SPOTIFY PLAYER SUB-COMPONENT ---
const SpotifyPlayerContent: React.FC<MusicPlayerProps & { spotifyState: SpotifyPlayerState | null }> = ({ 
    isNight, 
    playerControlsSize,
    playerControlsGap,
    playerControlsVerticalPosition,
    dayPlayerButtonColor,
    nightPlayerButtonColor,
    spotifyState,
}) => {
    const { accessToken, logout, setDeviceId, isAuthenticated, setNowPlaying, volume, setVolume, setSpotifyPlayerInstance, silentRefreshToken } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('connecting');
    const [isAutoQueueEnabled, setIsAutoQueueEnabled] = useState(false);
    
    const [showQueue, setShowQueue] = useState(false);
    const [isQueuePopoverRendered, setIsQueuePopoverRendered] = useState(false);
    const queuePopoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [isLiked, setIsLiked] = useState(false);

    const [popoverPosition, setPopoverPosition] = useState({ bottom: 0, left: 0, transform: '' });
    
    const isPlayerActive = playerStatus === 'ready' && spotifyState && spotifyState.track_window.current_track;
    const currentTrackId = spotifyState?.track_window.current_track?.id;
    const currentTrackUri = spotifyState?.track_window.current_track?.uri;
    const internalVolumeUpdate = useRef(false);
    const tokenRef = useRef<string | null>(accessToken);
    useEffect(() => { tokenRef.current = accessToken; }, [accessToken]);

    useEffect(() => {
        if (playerStatus === 'ready' && !spotifyState) {
            setNowPlaying(s => s.source === 'spotify' ? { source: null, spotifyState: null } : {});
        }
    }, [spotifyState, playerStatus, setNowPlaying]);

    useEffect(() => {
        if (playerRef.current && typeof volume === 'number') {
            if (internalVolumeUpdate.current) {
                internalVolumeUpdate.current = false;
                return;
            }
            playerRef.current.setVolume(volume).catch(e => console.error("Failed to set Spotify volume", e));
        }
    }, [volume]);

    const startAndSyncPlayer = useCallback(async (playerInstance: SpotifyPlayer, deviceId: string) => {
        try {
            await playerInstance.activateElement();
            await apiClient.put('/me/player', {
                device_ids: [deviceId],
                play: true 
            });

            setTimeout(async () => {
                try {
                    const { data: playerState } = await apiClient.get('/me/player');
                    if (playerState && playerState.item) {
                        await apiClient.put(`/me/player/play?device_id=${deviceId}`, {
                            position_ms: playerState.progress_ms
                        });
                    }
                } catch(e) {
                    console.error("Error during resync play command", e);
                }
            }, 500);

        } catch (error: any) {
            if (error.response && (error.response.status === 404 || error.response.status === 403)) {
                console.log("No active session to transfer. Player is ready for new playback.");
            } else {
                console.error("Error during startup and synchronization:", error.response?.data || error.message);
            }
        }
    }, []);

    useEffect(() => {
        if (!accessToken) {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
            setPlayerStatus('connecting');
            setNowPlaying({ spotifyState: null });
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
             volume: volume
         });
         
         playerRef.current = player;
         setSpotifyPlayerInstance(player);
 
         player.on('ready', async ({ device_id }) => {
             setDeviceId(device_id);
             setPlayerStatus('ready');
             await startAndSyncPlayer(player, device_id);
         });
 
         player.on('not_ready', () => {
             setDeviceId(null);
             setPlayerStatus('connecting');
         });
         
         player.on('player_state_changed', (state) => {
             if (state) {
                setNowPlaying({ source: 'spotify', spotifyState: state, radioStation: null, radioContext: [] });
                player.getVolume().then(sdkVolume => {
                    if (typeof sdkVolume === 'number' && sdkVolume !== volume) {
                        internalVolumeUpdate.current = true;
                        setVolume(sdkVolume);
                    }
                });
             } else {
                setNowPlaying(s => (s.source === 'spotify' ? { source: null, spotifyState: null } : {}));
             }
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
              playerRef.current?.disconnect();
              playerRef.current = null;
              setSpotifyPlayerInstance(null);
              setPlayerStatus('connecting');
              if (window.onSpotifyWebPlaybackSDKReady) {
                window.onSpotifyWebPlaybackSDKReady();
              }
            }
          } catch (e) {
            console.error("Refresh fallito dopo authentication_error. Logout.", e);
            logout();
          }
        });
 
         player.connect();
     };
        
        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                setSpotifyPlayerInstance(null);
                playerRef.current = null;
            }
        }
    }, [accessToken, logout, setDeviceId, startAndSyncPlayer, setNowPlaying, setVolume, volume, silentRefreshToken, setSpotifyPlayerInstance]);

    useEffect(() => {
        if (!isAutoQueueEnabled || !spotifyState || spotifyState.paused) {
            return;
        }
        const { duration, position } = spotifyState;
        const timeLeft = duration - position;
        if (duration > 0 && timeLeft < 15000 && timeLeft > 0 && !showQueue) {
            setShowQueue(true);
        }
    }, [spotifyState, isAutoQueueEnabled, showQueue]);

    const prevTrackUri = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (isAutoQueueEnabled && prevTrackUri.current && prevTrackUri.current !== currentTrackUri) {
            setShowQueue(false);
        }
        prevTrackUri.current = currentTrackUri;
    }, [currentTrackUri, isAutoQueueEnabled]);

    useEffect(() => {
        const playerEl = document.querySelector('.music-player');
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

    const handleSpotifyTogglePlay = () => playerRef.current?.togglePlay();
    
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
        if (!spotifyState) return;
        apiClient.put(`/me/player/shuffle?state=${!spotifyState.shuffle}`);
    };

    const handleToggleRepeat = () => {
        if (!spotifyState) return;
        const nextState = (spotifyState.repeat_mode + 1) % 3;
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
    
    const buttonActiveColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
    const inactiveButtonColor = isNight ? '#464646' : '#b0b0b0';
    
    if (playerStatus === 'error') {
        return (
            <div className="flex items-center w-full h-full gap-5 px-4 text-red-500">
                <FiAlertTriangle className="w-8 h-8 flex-shrink-0"/>
                <div className="overflow-hidden">
                    <div className="font-semibold truncate">Errore di connessione</div>
                    <div className="text-sm truncate">Impossibile connettersi a Spotify.</div>
                </div>
            </div>
        );
    }

    if (playerStatus === 'connecting' || !isAuthenticated) {
        return (
             <div className="flex items-center w-full h-full gap-5 px-4">
                <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="font-semibold truncate" style={{ color: 'var(--text-primary)'}}>Spotify</div>
                    <div className="text-sm truncate" style={{ color: 'var(--text-secondary)'}}>
                       Connettiti per ascoltare
                    </div>
                </div>
            </div>
        );
    }
    
    if (isPlayerActive && spotifyState) {
        const { name: trackName, album, artists } = spotifyState.track_window.current_track!;
        const imageUrl = album.images[0]?.url;
        const nextTrack = spotifyState.track_window.next_tracks[0];
        const songTitleColor = isNight 
          ? '#f7f7f7'
          : (spotifyState.paused ? '#454545' : '#000000');
        
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
                        <button onClick={handleToggleShuffle} className={`transition`} style={{ color: spotifyState.shuffle ? buttonActiveColor : inactiveButtonColor }}>
                            <PiShuffleBold className="w-5 h-5" />
                        </button>
                        <button onClick={handleToggleRepeat} className={`transition`} style={{ color: spotifyState.repeat_mode !== 0 ? buttonActiveColor : inactiveButtonColor }}>
                           {spotifyState.repeat_mode === 2 ? <PiRepeatOnceBold className="w-5 h-5"/> : <PiRepeatBold className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                <div className="w-full">
                    <ProgressBar player={playerRef.current} state={spotifyState} />
                </div>
                
                <div className="w-full flex justify-between items-center" style={{ transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                    <div className="flex-1 flex justify-start">
                         <button onClick={handleToggleLike} className={`transition`} style={{ color: isLiked ? buttonActiveColor : inactiveButtonColor }}>
                            <FiHeart style={{ width: `${playerControlsSize * 0.9}px`, height: `${playerControlsSize * 0.9}px`}} className={`${isLiked ? 'fill-current' : ''}`} />
                         </button>
                    </div>
                    <div className="flex items-center" style={{ gap: `${playerControlsGap}px`}}>
                        <button onClick={() => playerRef.current?.previousTrack()} disabled={spotifyState.disallows.skipping_prev} className={`disabled:opacity-30 transition`} style={{ color: buttonActiveColor }}>
                            <IoPlaySkipBackSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} />
                        </button>
                        <button onClick={handleSpotifyTogglePlay} className={`transition`} style={{ color: buttonActiveColor }}>
                            {spotifyState.paused 
                                ? <IoPlaySharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} /> 
                                : <IoPauseSharp style={{ width: `${playerControlsSize * 1.5}px`, height: `${playerControlsSize * 1.5}px`}} />}
                        </button>
                        <button onClick={() => playerRef.current?.nextTrack()} disabled={spotifyState.disallows.skipping_next} className={`disabled:opacity-30 transition`} style={{ color: buttonActiveColor }}>
                            <IoPlaySkipForwardSharp style={{ width: `${playerControlsSize}px`, height: `${playerControlsSize}px`}} />
                        </button>
                    </div>
                    <div className="flex-1 flex justify-end items-center">
                        <button onClick={handleToggleAutoQueue} className={`p-1 rounded-full transition-all duration-200`} style={{ color: isAutoQueueEnabled ? buttonActiveColor : inactiveButtonColor }}>
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
                <FiLoader className={`w-7 h-7 animate-spin ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
            </div>
            <div className="flex-grow overflow-hidden">
                <div className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Connessione a Spotify...</div>
            </div>
        </div>
    );
};

export default MusicPlayer;
