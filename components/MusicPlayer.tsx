import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiPlay, FiPause, FiSkipBack, FiSkipForward, FiMusic, FiAlertTriangle
} from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { IoMdAddCircleOutline, IoMdHeart } from 'react-icons/io';
import { HiOutlineQueueList } from 'react-icons/hi2';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';

interface MusicPlayerProps {
    isAnyAppOpen: boolean;
    isNight: boolean;
    dockedConfig: { width: number; bottom: number; left: number; height: number; };
    floatingConfig: { width: number; bottom: number; placeholderWidth: number; height: number; };
}

type PlayerStatus = 'connecting' | 'ready' | 'error';

const ProgressBar = ({ player, state, isNight }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, isNight: boolean }) => {
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
            
            // Set isSeeking to false after a short delay to allow the state to sync
            // from the player_state_changed event first.
            setTimeout(() => setIsSeeking(false), 50);
        };
        
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }, [player, state.duration]);
    
    const progressPercentage = state.duration > 0 ? (position / state.duration) * 100 : 0;
    const thumbColor = isNight ? '#FFF' : '#000';
    const progressBg = isNight ? 'bg-white/30' : 'bg-black/20';
    const progressFillBg = isNight ? 'bg-white' : 'bg-black';

    return (
        <div
            ref={progressRef}
            className={`w-full h-1.5 rounded-full cursor-pointer relative group ${progressBg}`}
            onMouseDown={handleMouseDown}
        >
            <div className={`h-full rounded-full ${progressFillBg}`} style={{ width: `${progressPercentage}%` }} />
            <div 
                className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full opacity-0 group-hover:opacity-100 transition-opacity`}
                style={{ left: `${progressPercentage}%`, transform: 'translate(-50%, -50%)', backgroundColor: thumbColor }} 
            />
        </div>
    );
};


const QueuePopover = ({ isNight, nextTrack, position, onClose }: { isNight: boolean, nextTrack: SpotifyTrack | null, position: { bottom: number, right: number }, onClose: () => void }) => {
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
                right: `${position.right}px`,
            }}
            className={`fixed w-72 p-3 rounded-lg shadow-2xl z-50 ${isNight ? 'bg-zinc-800' : 'bg-zinc-100'} border ${isNight ? 'border-zinc-700' : 'border-zinc-200'} animate-fade-in`}
        >
            <p className={`text-xs font-bold mb-2 ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>Prossima in coda</p>
            {nextTrack ? (
                <div className="flex items-center gap-3">
                    <img src={nextTrack.album.images[0].url} alt={nextTrack.name} className="w-10 h-10 rounded-md" />
                    <div>
                        <p className="font-semibold text-sm truncate">{nextTrack.name}</p>
                        <p className={`text-xs truncate ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>{nextTrack.artists.map(a => a.name).join(', ')}</p>
                    </div>
                </div>
            ) : (
                <p className={`text-sm ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>Nessuna canzone in coda.</p>
            )}
        </div>,
        document.getElementById('portal-root')!
    );
};

const MusicPlayer: React.FC<MusicPlayerProps> = ({ isAnyAppOpen, isNight, dockedConfig, floatingConfig }) => {
    const { accessToken, logout, setDeviceId, isAuthenticated } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [playerStatus, setPlayerStatus] = useState<PlayerStatus>('connecting');
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [showQueue, setShowQueue] = useState(false);
    const [isLiked, setIsLiked] = useState(false);

    const queueButtonRef = useRef<HTMLButtonElement>(null);
    const [popoverPosition, setPopoverPosition] = useState({ bottom: 0, right: 0 });
    
    const isPlayerActive = playerStatus === 'ready' && playerState && playerState.track_window.current_track;
    const currentTrackId = playerState?.track_window.current_track?.id;

    const forceResumeSession = useCallback(async (deviceId: string) => {
      try {
        console.log("Tentativo di ripresa sessione con comando unificato...");
        // This is the most direct command: it transfers and starts playback in one go.
        // It's our best chance to initiate autoplay successfully.
        await apiClient.put('/me/player', {
          device_ids: [deviceId],
          play: true,
        });
        console.log("Comando di trasferimento e riproduzione inviato con successo.");
      } catch (error: any) {
        // This is an EXPECTED case if there was no active session on Spotify.
        // The Spotify API may return 403 or 404 in this case, which we handle silently.
        if (error.response && (error.response.status === 403 || error.response.status === 404)) {
          console.log("Nessuna sessione attiva da riprendere. Il player rimane in attesa.");
        } else {
          // Other errors (e.g., network issues) are still logged.
          console.error("Errore durante il tentativo di ripresa della sessione:", error.response?.data || error.message);
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
            setPlayerState(null);
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
                name: 'Tesla Infotainment UI',
                getOAuthToken: cb => { cb(accessToken); },
                volume: 0.5
            });

            player.on('ready', async ({ device_id }) => {
                console.log('Player pronto con device ID:', device_id);
                setDeviceId(device_id);
                setPlayerStatus('ready');
                await forceResumeSession(device_id);
            });
            player.on('not_ready', () => {
                setDeviceId(null);
                setPlayerStatus('connecting');
            });
            player.on('player_state_changed', setPlayerState);

            const handleError = (error: { message: string }) => {
                console.error("Spotify Player Error:", error.message);
                setPlayerStatus('error');
            };
            player.on('initialization_error', handleError);
            player.on('authentication_error', handleError);
            player.on('account_error', handleError);

            player.connect();
            playerRef.current = player;
        };
        
        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
        }
    }, [accessToken, logout, setDeviceId, forceResumeSession]);

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
                await apiClient.delete(`/me/tracks?ids=${currentTrackId}`);
                setIsLiked(false);
            } else {
                await apiClient.put(`/me/tracks?ids=${currentTrackId}`);
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

    const handleToggleQueue = () => {
        if (queueButtonRef.current) {
            const rect = queueButtonRef.current.getBoundingClientRect();
            setPopoverPosition({
                bottom: window.innerHeight - rect.top + 12, // 12px margin
                right: window.innerWidth - rect.right,
            });
        }
        setShowQueue(prev => !prev);
    };
    
    const playerStyle = useMemo(() => {
        if (isAnyAppOpen) {
            return {
                width: `${dockedConfig.width}px`,
                height: `${dockedConfig.height}px`,
                bottom: `${dockedConfig.bottom}px`,
                left: `${dockedConfig.left}px`,
                transform: 'translateX(0)',
            };
        } else {
            const width = isPlayerActive ? floatingConfig.width : floatingConfig.placeholderWidth;
            return {
                width: `${width}px`,
                height: `${floatingConfig.height}px`,
                bottom: `${floatingConfig.bottom}px`,
                left: '50%',
                transform: 'translateX(-50%)',
            };
        }
    }, [isAnyAppOpen, isPlayerActive, dockedConfig, floatingConfig]);

    const themeClasses = isNight 
        ? 'bg-[#121212]/90 text-white border-zinc-700/80' 
        : 'bg-white/90 text-black border-zinc-300';
    
    const renderPlayerContent = () => {
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
            const placeholderText = isAuthenticated ? "In attesa della musica..." : "Login to start listening";
            return (
                 <div className="flex items-center w-full h-full gap-5 px-4">
                    <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                       {isAuthenticated ? <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} /> : <FaSpotify className={`w-7 h-7 ${isNight ? 'text-green-500' : 'text-green-600'}`} />}
                    </div>
                    <div className="flex-grow overflow-hidden">
                        <div className="font-semibold truncate">Spotify</div>
                        <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                            {placeholderText}
                        </div>
                    </div>
                </div>
            );
        }
        
        if (isPlayerActive) {
            const { name: trackName, album, artists } = playerState.track_window.current_track!;
            const imageUrl = album.images[0]?.url;
            const nextTrack = playerState.track_window.next_tracks[0];

            const iconColor = isNight ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black';
            const activeIconColor = isNight ? 'text-green-400' : 'text-green-600';

            return (
                <div className="w-full h-full flex flex-col justify-center gap-2 px-4 py-2 relative">
                    {/* ROW 1: Info & Secondary Controls */}
                    <div className="flex items-center justify-between gap-4 w-full">
                        <div className="flex items-center gap-3 min-w-0">
                            {imageUrl && <img src={imageUrl} alt={album.name} className="w-10 h-10 rounded-md" />}
                            <div className="overflow-hidden">
                                <div className="font-semibold text-sm truncate">{trackName}</div>
                                <div className={`text-xs truncate ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                    {artists.map(a => a.name).join(', ')}
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-5">
                             <button onClick={handleToggleShuffle} className={`transition ${playerState.shuffle ? activeIconColor : iconColor}`}>
                                <PiShuffleBold className="w-5 h-5" />
                            </button>
                            <button onClick={handleToggleRepeat} className={`transition ${playerState.repeat_mode !== 0 ? activeIconColor : iconColor}`}>
                               {playerState.repeat_mode === 2 ? <PiRepeatOnceBold className="w-5 h-5"/> : <PiRepeatBold className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>

                    {/* ROW 2: Progress & Main Controls */}
                    <div className="w-full">
                        <ProgressBar player={playerRef.current} state={playerState} isNight={isNight} />
                        <div className="flex justify-between items-center mt-2">
                             <button onClick={handlePrevTrack} disabled={playerState.disallows.skipping_prev} className={`disabled:opacity-30 transition ${iconColor}`}>
                                <FiSkipBack className="w-6 h-6" />
                            </button>
                             <button onClick={handleTogglePlay} className={`w-9 h-9 flex items-center justify-center rounded-full transition ${isNight ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'}`}>
                               {playerState.paused ? <FiPlay className="w-5 h-5 ml-0.5" /> : <FiPause className="w-5 h-5" />}
                            </button>
                             <button onClick={handleNextTrack} disabled={playerState.disallows.skipping_next} className={`disabled:opacity-30 transition ${iconColor}`}>
                                <FiSkipForward className="w-6 h-6" />
                            </button>
                             <button onClick={handleToggleLike} className={`transition ${isLiked ? 'text-[#1DB954]' : iconColor}`}>
                                {isLiked ? <IoMdHeart className="w-6 h-6" /> : <IoMdAddCircleOutline className="w-6 h-6" />}
                            </button>
                             <button ref={queueButtonRef} onClick={handleToggleQueue} className={`transition ${iconColor}`}><HiOutlineQueueList className="w-6 h-6" /></button>
                        </div>
                    </div>

                    {showQueue && (
                        <QueuePopover
                            isNight={isNight}
                            nextTrack={nextTrack}
                            position={popoverPosition}
                            onClose={() => setShowQueue(false)}
                        />
                    )}
                </div>
            );
        }

        // If authenticated and ready, but no track is loaded, show a "waiting" state.
        return (
             <div className="flex items-center w-full h-full gap-5 px-4">
                <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <FiMusic className={`w-7 h-7 ${isNight ? 'text-zinc-500' : 'text-zinc-400'}`} />
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="font-semibold truncate">Niente in riproduzione</div>
                    <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        Scegli qualcosa da ascoltare.
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div 
            className={`music-player ${themeClasses} backdrop-blur-md border rounded-xl shadow-lg flex items-center gap-5 overflow-hidden`}
            style={{...playerStyle, background: `var(--player-bg)`}}
        >
            {renderPlayerContent()}
        </div>
    );
};

export default MusicPlayer;