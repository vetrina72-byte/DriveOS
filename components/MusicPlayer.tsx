
import React from 'react';
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
 * Un componente per la barra di progresso di Spotify, progettato per essere fluido e reattivo.
 * Utilizza `requestAnimationFrame` per interpolare il progresso tra gli aggiornamenti di stato
 * ricevuti dall'SDK, garantendo un'animazione lineare e non a scatti.
 *
 * @param {SpotifyPlayer | null} player - L'istanza del player SDK per inviare comandi di seek.
 * @param {SpotifyPlayerState} state - Lo stato attuale del player da cui leggere il progresso e la durata.
 */
const SpotifyProgressBar = ({ player, state }: { player: SpotifyPlayer | null, state: SpotifyPlayerState }) => {
    // `position` è lo stato interno che guida l'UI, aggiornato fluidamente.
    const [position, setPosition] = React.useState(state.position);
    // `isSeeking` blocca l'aggiornamento automatico mentre l'utente sta trascinando la barra.
    const [isSeeking, setIsSeeking] = React.useState(false);
    const progressRef = React.useRef<HTMLDivElement>(null);
    const animationFrameRef = React.useRef(0);
    const lastSeekTime = React.useRef(0);

    // Sincronizza lo stato interno con quello ricevuto da Spotify,
    // ma solo se l'utente non sta interagendo con la barra.
    React.useEffect(() => {
        if (!isSeeking && Date.now() - lastSeekTime.current > 1000) {
            setPosition(state.position);
        }
    }, [state.position, isSeeking]);

    // Loop di animazione principale per un progresso fluido.
    React.useEffect(() => {
        // Interrompe l'animazione se la traccia è in pausa o l'utente sta cercando.
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


    // Gestisce l'interazione dell'utente per il seeking (spostamento manuale).
    const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
                lastSeekTime.current = Date.now();
                setIsSeeking(false);
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
            <div className="h-full rounded-full bg-green-500 relative" style={{ width: `${progressPercentage}%` }}>
                 <div 
                    className="absolute top-1/2 -right-1.5 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
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
    const [localPosition, setLocalPosition] = React.useState(progress.position);
    const progressRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isSeeking) {
            setLocalPosition(progress.position);
        }
    }, [progress.position, isSeeking]);

    const handleMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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
    const popoverRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
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
    const playerRef = React.useRef<SpotifyPlayer | null>(null);
    const [playerStatus, setPlayerStatus] = React.useState<PlayerStatus>('connecting');
    const [isQueuePopoverOpen, setIsQueuePopoverOpen] = React.useState(false);
    const [isQueuePopoverClosing, setIsQueuePopoverClosing] = React.useState(false);
    const queueButtonRef = React.useRef<HTMLButtonElement>(null);

    // YouTube state
    const youtubePlayerRef = React.useRef<any>(null);
    const [isYouTubePlaying, setIsYouTubePlaying] = React.useState(false);
    const [youTubeProgress, setYouTubeProgress] = React.useState<{ position: number, duration: number } | null>(null);
    const [isYouTubeSeeking, setIsYouTubeSeeking] = React.useState(false);
    const youTubeProgressInterval = React.useRef<number | null>(null);

    // This effect handles the initialization of the Spotify Web Playback SDK.
    // It runs only when `accessToken` is available and `playerRef.current` is null.
    React.useEffect(() => {
        if (!accessToken || playerRef.current) return;
        
        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'Mio Infotainment',
                getOAuthToken: cb => { cb(accessToken); },
                volume: 1
            });
            playerRef.current = player;
            setPlayerStatus('connecting');

            // All event listeners for the player instance
            // FIX: Replaced 'addListener' with 'on' to match the Spotify Player SDK's event listener method.
            player.on('ready', ({ device_id }) => {
                console.log('%c[Spotify SDK] Ready with Device ID', 'color: lime; font-weight: bold', device_id);
                setDeviceId(device_id);
                setPlayerStatus('ready');
                setPlayerAsReadyForAutoplay(); // Signal that autoplay can now work
            });

            // FIX: Replaced 'addListener' with 'on' to match the Spotify Player SDK's event listener method.
            player.on('not_ready', ({ device_id }) => {
                console.warn('[Spotify SDK] Device ID has gone offline', device_id);
                setDeviceId(null);
            });
            
            // FIX: Replaced 'addListener' with 'on' to match the Spotify Player SDK's event listener method.
            player.on('player_state_changed', (state) => {
                if (state) {
                    _setPlayerState(state);
                } else {
                    _setPlayerState(null);
                }
            });
            
            // FIX: Replaced 'addListener' with 'on' to match the Spotify Player SDK's event listener method.
            player.on('initialization_error', ({ message }) => { 
                console.error('[Spotify SDK] Initialization Error:', message);
                setPlayerStatus('error');
            });
            // FIX: Replaced 'addListener' with 'on' to match the Spotify Player SDK's event listener method.
            player.on('authentication_error', ({ message }) => {
                console.error('[Spotify SDK] Authentication Error:', message);
                setPlayerStatus('error');
                silentRefreshToken();
            });
            // FIX: Replaced 'addListener' with 'on' to match the Spotify Player SDK's event listener method.
            player.on('account_error', ({ message }) => { 
                console.error('[Spotify SDK] Account Error:', message);
                setPlayerStatus('error');
            });
            
            player.connect().then(success => {
                if (success) {
                    console.log("[Spotify SDK] The Web Playback SDK successfully connected to Spotify!");
                }
            });
        };

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
        }
    }, [accessToken, setDeviceId, logout, _setPlayerState, silentRefreshToken, setPlayerAsReadyForAutoplay]);
    
    // Effect to manage player volume for both Spotify and YouTube
    React.useEffect(() => {
        if (playerRef.current && playerStatus === 'ready') {
            playerRef.current.setVolume(volume).catch(e => console.error("Error setting Spotify volume", e));
        }
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.setVolume(volume * 100);
            if (volume === 0) youtubePlayerRef.current.mute();
            else youtubePlayerRef.current.unMute();
        }
    }, [volume, playerStatus]);

    const handlePlayerCommand = React.useCallback(async (command: 'togglePlay' | 'nextTrack' | 'previousTrack') => {
        if (playerRef.current && playerStatus === 'ready') {
            try {
                await playerRef.current[command]();
            } catch (error) {
                console.error(`Failed to execute command: ${command}`, error);
            }
        }
    }, [playerStatus]);

    const handleShuffleToggle = React.useCallback(async () => {
        const currentState = nowPlaying.spotifyState?.shuffle;
        if (playerRef.current && playerStatus === 'ready' && typeof currentState === 'boolean') {
            apiClient.put(`/me/player/shuffle?state=${!currentState}`);
        }
    }, [playerStatus, nowPlaying.spotifyState]);

    const handleRepeatToggle = React.useCallback(async () => {
        const currentMode = nowPlaying.spotifyState?.repeat_mode;
        if (playerRef.current && playerStatus === 'ready' && typeof currentMode === 'number') {
            const nextMode = (currentMode + 1) % 3;
            const stateString = nextMode === 0 ? 'off' : nextMode === 1 ? 'context' : 'track';
            apiClient.put(`/me/player/repeat?state=${stateString}`);
        }
    }, [playerStatus, nowPlaying.spotifyState]);
    
    const handleQueueClick = () => {
        if (isQueuePopoverOpen) {
            setIsQueuePopoverClosing(true);
            setTimeout(() => {
                setIsQueuePopoverOpen(false);
                setIsQueuePopoverClosing(false);
            }, 300);
        } else {
            setIsQueuePopoverOpen(true);
        }
    };
    
    const onYouTubeReady = (event: any) => {
        youtubePlayerRef.current = event.target;
        youtubePlayerRef.current.setVolume(volume * 100);
    };

    const onYouTubeStateChange = (event: any) => {
        // FIX: Added 'window.YT' type definition to globals.d.ts to resolve TypeScript error.
        if (event.data === window.YT.PlayerState.PLAYING) {
            setIsYouTubePlaying(true);
            setNowPlaying(s => ({...s, isLoading: false}));
        } else {
            setIsYouTubePlaying(false);
        }

        // FIX: Added 'window.YT' type definition to globals.d.ts to resolve TypeScript error.
        if (event.data === window.YT.PlayerState.ENDED && nowPlaying.youtubePlaylist) {
             const currentIndex = nowPlaying.youtubePlaylist.findIndex(t => t.videoId === nowPlaying.youtubeTrack?.videoId);
             if (currentIndex !== -1 && currentIndex < nowPlaying.youtubePlaylist.length - 1) {
                 playYouTube(nowPlaying.youtubePlaylist[currentIndex + 1], nowPlaying.youtubePlaylist);
             }
        }
    };
    
    // YouTube progress tracking
    React.useEffect(() => {
        if (isYouTubePlaying && !isYouTubeSeeking) {
            if (youTubeProgressInterval.current) clearInterval(youTubeProgressInterval.current);
            youTubeProgressInterval.current = window.setInterval(() => {
                if (youtubePlayerRef.current) {
                    const currentTime = youtubePlayerRef.current.getCurrentTime();
                    const duration = youtubePlayerRef.current.getDuration();
                    setYouTubeProgress({ position: currentTime, duration });
                }
            }, 250);
        } else {
            if (youTubeProgressInterval.current) clearInterval(youTubeProgressInterval.current);
        }

        return () => {
            if (youTubeProgressInterval.current) clearInterval(youTubeProgressInterval.current);
        };
    }, [isYouTubePlaying, isYouTubeSeeking]);

    const handleYouTubeSeek = (position: number) => {
        if (youtubePlayerRef.current) {
            youtubePlayerRef.current.seekTo(position, true);
        }
    };

    const handleYouTubeTogglePlay = () => {
        if (!youtubePlayerRef.current) return;
        if (isYouTubePlaying) {
            youtubePlayerRef.current.pauseVideo();
        } else {
            youtubePlayerRef.current.playVideo();
        }
    };

    const handleYouTubeSkip = (direction: 'next' | 'prev') => {
        if (!nowPlaying.youtubePlaylist || !nowPlaying.youtubeTrack) return;
        const currentIndex = nowPlaying.youtubePlaylist.findIndex(t => t.videoId === nowPlaying.youtubeTrack.videoId);
        if (currentIndex === -1) return;
        
        let newIndex;
        if (direction === 'next') {
            newIndex = Math.min(nowPlaying.youtubePlaylist.length - 1, currentIndex + 1);
        } else {
            newIndex = Math.max(0, currentIndex - 1);
        }

        if (newIndex !== currentIndex) {
            playYouTube(nowPlaying.youtubePlaylist[newIndex], nowPlaying.youtubePlaylist);
        }
    };
    
    const formatDuration = (ms: number) => {
        if (isNaN(ms) || ms < 0) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const youTubeFormatDuration = (s: number) => {
        if (isNaN(s) || s < 0) return '0:00';
        const totalSeconds = Math.floor(s);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    const nowPlayingItem = nowPlaying.spotifyState?.track_window.current_track || null;
    const nowPlayingRadio = nowPlaying.source === 'radio' ? nowPlaying.radioStation : null;
    const nowPlayingYouTube = nowPlaying.source === 'youtube' ? nowPlaying.youtubeTrack : null;

    const isDocked = activeApp === 'maps';
    const currentConfig = isDocked ? dockedConfig : floatingConfig;
    
    const playerStyle = {
      width: `${currentConfig.width}px`,
      height: `${currentConfig.height}px`,
      bottom: `${currentConfig.bottom}px`,
      // FIX: Directly accessed 'dockedConfig.left' when 'isDocked' is true to resolve type error, as 'left' does not exist on 'floatingConfig'.
      left: isDocked ? `${dockedConfig.left}px` : '50%',
      transform: isDocked ? 'none' : `translateX(calc(-50% - ${floatingConfig.otherWidgetWidth / 2}px - 8px))`,
    };

    // FIX: This function now returns a component type, not a JSX element instance,
    // to allow it to be used correctly with JSX or React.createElement.
    const getRepeatIcon = () => {
        switch (nowPlaying.spotifyState?.repeat_mode) {
            case 1: return PiRepeatBold;
            case 2: return PiRepeatOnceBold;
            default: return PiRepeatBold;
        }
    };
    
    const getNextTrackInfo = () => {
        const nextTrack = nowPlaying.spotifyState?.track_window.next_tracks[0];
        if (!nextTrack) return null;
        return {
            name: nextTrack.name,
            description: nextTrack.artists.map(a => a.name).join(', '),
            imageUrl: nextTrack.album.images[0]?.url,
        };
    };

    const queuePopoverPosition = React.useMemo(() => {
        if (!queueButtonRef.current) return { bottom: 0, left: 0, transform: 'translateX(-50%)' };
        const rect = queueButtonRef.current.getBoundingClientRect();
        return {
            bottom: window.innerHeight - rect.top + 8, // 8px margin
            left: rect.left + rect.width / 2,
            transform: 'translateX(-50%)'
        };
    }, [isQueuePopoverOpen]);
    
    const buttonColor = isNight ? nightPlayerButtonColor : dayPlayerButtonColor;
    const buttonStyle = {
        color: buttonColor,
        width: `${playerControlsSize}px`,
        height: `${playerControlsSize}px`,
    };
    
    const renderPlayerContent = () => {
        if (!isAuthenticated) {
             return (
                 <div className="flex items-center justify-center h-full">
                    <span style={{ color: 'var(--text-secondary)' }}>Please log in to Spotify</span>
                 </div>
             );
        }
        
        if (playerStatus === 'error') {
            return (
                <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--text-primary)' }}>
                    <FiAlertTriangle className="w-8 h-8 text-red-500" />
                    <span className="font-semibold">Player Error</span>
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Check Spotify Premium status.</span>
                </div>
            );
        }
        
        // Combined Loading/Nothing Playing state
        if ((!nowPlaying.source || nowPlaying.isLoading) && playerStatus !== 'connecting') {
            return (
                <div className="flex items-center gap-4 h-full">
                    <div className="w-16 h-16 rounded-md flex items-center justify-center" style={{ backgroundColor: 'var(--progress-bg)'}}>
                         <FiMusic className="w-8 h-8" style={{ color: 'var(--icon-color)'}}/>
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Niente in riproduzione</span>
                        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Seleziona un brano per iniziare</span>
                    </div>
                </div>
            )
        }
        
        if (nowPlaying.isLoading || playerStatus === 'connecting') {
            return (
                <div className="flex items-center justify-center h-full gap-3" style={{ color: 'var(--text-secondary)' }}>
                    <FiLoader className="animate-spin text-2xl"/>
                    <span className="font-semibold">Connessione in corso...</span>
                </div>
            )
        }

        // --- SPOTIFY PLAYER ---
        if (nowPlaying.source === 'spotify' && nowPlaying.spotifyState && nowPlayingItem) {
            return (
                <div className="flex flex-col justify-center h-full gap-2">
                    <div className="flex items-center gap-3">
                        <img src={nowPlayingItem.album.images[0].url} alt={nowPlayingItem.name} className="w-16 h-16 rounded-md shadow-lg" />
                        <div className="flex-grow min-w-0">
                            <p className="font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{nowPlayingItem.name}</p>
                            <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{nowPlayingItem.artists.map(a => a.name).join(', ')}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        <span>{formatDuration(nowPlaying.spotifyState.position)}</span>
                        <SpotifyProgressBar player={playerRef.current} state={nowPlaying.spotifyState} />
                        <span>{formatDuration(nowPlaying.spotifyState.duration)}</span>
                    </div>
                </div>
            )
        }

        // --- RADIO PLAYER ---
        if (nowPlaying.source === 'radio' && nowPlayingRadio) {
            const isFavorite = favoriteStationUUIDs.includes(nowPlayingRadio.stationuuid);
            return (
                <div className="flex items-center gap-4 h-full">
                    {nowPlayingRadio.favicon ? (
                        <img src={nowPlayingRadio.favicon} alt={nowPlayingRadio.name} className="w-20 h-20 rounded-md shadow-lg object-contain p-1" style={{ backgroundColor: isNight ? '#333' : '#eee'}}/>
                    ) : (
                        <div className="w-20 h-20 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--progress-bg)' }}>
                            <FiRadio className="w-10 h-10" style={{ color: 'var(--icon-color)' }} />
                        </div>
                    )}
                    <div className="flex flex-col justify-center min-w-0 flex-grow h-full">
                        <p className="font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{nowPlayingRadio.name}</p>
                        <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{nowPlayingRadio.tags.split(',')[0]}</p>
                         <div className="flex items-center mt-auto" style={{ gap: `${playerControlsGap * 0.5}px`, transform: `translateY(${playerControlsVerticalPosition}px)`}}>
                            <button onClick={() => onStationChange('prev')} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <IoPlaySkipBackSharp className="w-full h-full" />
                            </button>
                             <button onClick={() => onToggleFavorite(nowPlayingRadio)} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <FiHeart className={`w-full h-full transition-colors ${isFavorite ? 'fill-current text-red-500' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
            )
        }
        
        // --- YOUTUBE PLAYER ---
        if (nowPlaying.source === 'youtube' && nowPlayingYouTube) {
             return (
                <div className="flex flex-col justify-center h-full gap-2">
                    <div className="flex items-center gap-3">
                        <img src={nowPlayingYouTube.thumbnail} alt={nowPlayingYouTube.title} className="w-16 h-16 rounded-md shadow-lg object-cover" />
                        <div className="flex-grow min-w-0">
                            <p className="font-bold text-lg truncate" style={{ color: 'var(--text-primary)' }}>{nowPlayingYouTube.title}</p>
                            <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>{nowPlayingYouTube.channelTitle}</p>
                        </div>
                    </div>
                     {youTubeProgress && (
                        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                            <span>{youTubeFormatDuration(youTubeProgress.position)}</span>
                            <YouTubeProgressBar
                                progress={youTubeProgress}
                                isSeeking={isYouTubeSeeking}
                                onSeek={handleYouTubeSeek}
                                onSeekStart={() => setIsYouTubeSeeking(true)}
                                onSeekEnd={() => setIsYouTubeSeeking(false)}
                            />
                            <span>{youTubeFormatDuration(youTubeProgress.duration)}</span>
                        </div>
                     )}
                </div>
            )
        }
        
        return null;
    }
    
    return (
        <>
            <div 
                className={`music-player ${isNight ? 'dark' : ''}`}
                style={{
                    ...playerStyle,
                    opacity: isAnyAppOpen && activeApp !== 'maps' ? 0 : 1,
                    pointerEvents: isAnyAppOpen && activeApp !== 'maps' ? 'none' : 'auto',
                }}
            >
                <div 
                    className={`relative w-full h-full backdrop-blur-md border rounded-xl shadow-lg flex items-center px-4 transition-colors duration-300 ${isNight ? 'border-zinc-700/80' : 'border-zinc-300'}`}
                    style={{ background: !isNight ? widgetBgColor : 'var(--player-bg)'}}
                >
                    {renderPlayerContent()}
                </div>
            </div>

             {/* Player Controls (visible only for Spotify and YouTube) */}
             {isAuthenticated && (nowPlaying.source === 'spotify' || nowPlaying.source === 'youtube') && (
                 <div
                    className="fixed z-10 flex items-center transition-opacity"
                    style={{
                        bottom: `${floatingConfig.bottom + (floatingConfig.height - playerControlsSize) / 2}px`,
                        left: isDocked ? `${dockedConfig.left + dockedConfig.width + 20}px` : `calc(50% + ${floatingConfig.width / 2}px - ${floatingConfig.otherWidgetWidth / 2}px)`,
                        opacity: isAnyAppOpen && activeApp !== 'maps' ? 0 : 1,
                        pointerEvents: isAnyAppOpen && activeApp !== 'maps' ? 'none' : 'auto',
                        gap: `${playerControlsGap}px`,
                        transform: `translateY(${playerControlsVerticalPosition}px)`
                    }}
                >
                    {nowPlaying.source === 'spotify' && (
                        <>
                            <button className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <PiShuffleBold className={`w-full h-full ${nowPlaying.spotifyState?.shuffle ? 'text-green-400' : ''}`} onClick={handleShuffleToggle} />
                            </button>
                            <button onClick={() => handlePlayerCommand('previousTrack')} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <IoPlaySkipBackSharp className="w-full h-full" />
                            </button>
                            <button onClick={() => handlePlayerCommand('togglePlay')} className="p-3 rounded-full transition-transform hover:scale-110" style={{ backgroundColor: buttonColor }}>
                                {nowPlaying.spotifyState?.paused ? <IoPlaySharp className="w-8 h-8 text-black" /> : <IoPauseSharp className="w-8 h-8 text-black" />}
                            </button>
                            <button onClick={() => handlePlayerCommand('nextTrack')} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <IoPlaySkipForwardSharp className="w-full h-full" />
                            </button>
                            {/* FIX: Refactored to use standard JSX with the component type returned by getRepeatIcon,
                            // resolving the 'createElement' overload error. */}
                            <button className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                {(() => {
                                    const RepeatIcon = getRepeatIcon();
                                    return <RepeatIcon
                                        className={`w-full h-full ${nowPlaying.spotifyState?.repeat_mode !== 0 ? 'text-green-400' : ''}`}
                                        onClick={handleRepeatToggle}
                                    />;
                                })()}
                            </button>
                             <button ref={queueButtonRef} onClick={handleQueueClick} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <BsList className="w-full h-full" />
                            </button>
                        </>
                    )}
                    
                    {nowPlaying.source === 'youtube' && (
                        <>
                           <button onClick={() => handleYouTubeSkip('prev')} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <IoPlaySkipBackSharp className="w-full h-full" />
                            </button>
                            <button onClick={handleYouTubeTogglePlay} className="p-3 rounded-full transition-transform hover:scale-110" style={{ backgroundColor: buttonColor }}>
                                {isYouTubePlaying ? <IoPauseSharp className="w-8 h-8 text-black" /> : <IoPlaySharp className="w-8 h-8 text-black" />}
                            </button>
                            <button onClick={() => handleYouTubeSkip('next')} className="hover:opacity-70 transition-opacity" style={buttonStyle}>
                                <IoPlaySkipForwardSharp className="w-full h-full" />
                            </button>
                        </>
                    )}
                 </div>
             )}

            {isQueuePopoverOpen && (
                <QueuePopover 
                    isNight={isNight}
                    nextTrack={getNextTrackInfo()}
                    position={queuePopoverPosition}
                    onClose={handleQueueClick}
                    isClosing={isQueuePopoverClosing}
                />
            )}
            
            {nowPlaying.source === 'youtube' && nowPlaying.youtubeTrack && (
                <div className="fixed -bottom-96 -left-96">
                    <YouTube
                        videoId={nowPlaying.youtubeTrack.videoId}
                        opts={{
                            height: '100',
                            width: '100',
                            playerVars: {
                                autoplay: 1,
                                controls: 0,
                                fs: 0,
                                modestbranding: 1,
                            },
                        }}
                        onReady={onYouTubeReady}
                        onStateChange={onYouTubeStateChange}
                    />
                </div>
            )}
        </>
    );
};

export default React.memo(MusicPlayer);