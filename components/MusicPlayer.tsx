

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiPlay, FiPause, FiSkipBack, FiSkipForward, FiSearch
} from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { IoMdAddCircleOutline } from 'react-icons/io';
import { HiOutlineQueueList } from 'react-icons/hi2';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';

interface MusicPlayerProps {
    isAnyAppOpen: boolean;
    isNight: boolean;
    dockedConfig: { width: number; bottom: number; left: number; height: number; };
    floatingConfig: { width: number; bottom: number; placeholderWidth: number; height: number; };
}

const ProgressBar = ({ player, state, isNight }: { player: SpotifyPlayer | null, state: SpotifyPlayerState, isNight: boolean }) => {
    const [position, setPosition] = useState(state.position);
    const [isSeeking, setIsSeeking] = useState(false);
    const progressRef = useRef<HTMLDivElement>(null);
    const frameRef = useRef<number | null>(null);

    useEffect(() => {
        if (!state.paused) {
            const animate = () => {
                setPosition(p => p + 100);
                frameRef.current = requestAnimationFrame(animate);
            };
            frameRef.current = requestAnimationFrame(animate);
            return () => {
                if (frameRef.current) cancelAnimationFrame(frameRef.current);
            };
        }
    }, [state.paused]);

    useEffect(() => {
        if (!isSeeking) {
            setPosition(state.position);
        }
    }, [state.position, isSeeking]);

    const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
        if (!progressRef.current || !player) return;
        
        const rect = progressRef.current.getBoundingClientRect();
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const newPosition = Math.max(0, Math.min(clientX - rect.left, rect.width));
        const percentage = newPosition / rect.width;
        const seekTo = Math.round(state.duration * percentage);
        
        setPosition(seekTo);
        player.seek(seekTo);

    }, [player, state.duration]);

    const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        setIsSeeking(true);
        handleSeek(e);
    }, [handleSeek]);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isSeeking) {
            handleSeek(e as any);
        }
    }, [isSeeking, handleSeek]);

    const handleMouseUp = useCallback(() => {
        setIsSeeking(false);
    }, []);

    useEffect(() => {
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);
    
    const progressPercentage = (position / state.duration) * 100;
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


const MusicPlayer: React.FC<MusicPlayerProps> = ({ isAnyAppOpen, isNight, dockedConfig, floatingConfig }) => {
    const { accessToken, logout, setDeviceId, isAuthenticated } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [showQueue, setShowQueue] = useState(false);
    
    const isPlayerActive = isAuthenticated && isReady && playerState && playerState.track_window.current_track;

    useEffect(() => {
        if (!accessToken) {
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
                setIsReady(false);
                setPlayerState(null);
            }
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

            const player = new window.Spotify.Player({
                name: 'Tesla Infotainment UI',
                getOAuthToken: cb => { cb(accessToken); },
                volume: 0.5
            });

            player.on('ready', ({ device_id }) => {
                setDeviceId(device_id);
                setIsReady(true);
            });
            player.on('not_ready', () => {
                setDeviceId(null);
                setIsReady(false);
            });
            player.on('player_state_changed', setPlayerState);
            player.on('authentication_error', () => logout());
            player.on('account_error', () => logout());

            player.connect();
            playerRef.current = player;
        };

    }, [accessToken, logout, setDeviceId]);

    const handleTogglePlay = () => playerRef.current?.togglePlay();
    const handleNextTrack = () => playerRef.current?.nextTrack();
    const handlePrevTrack = () => playerRef.current?.previousTrack();

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
        if (isPlayerActive) {
            const { name: trackName, album, artists } = playerState.track_window.current_track!;
            const imageUrl = album.images[0]?.url;
            const nextTrack = playerState.track_window.next_tracks[0];

            const iconColor = isNight ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black';
            const activeIconColor = isNight ? 'text-white' : 'text-black';

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
                             <button className={`transition ${iconColor}`}><IoMdAddCircleOutline className="w-6 h-6" /></button>
                             <button onClick={() => setShowQueue(s => !s)} className={`transition ${iconColor}`}><HiOutlineQueueList className="w-6 h-6" /></button>
                             <button className={`transition ${iconColor}`}><FiSearch className="w-5 h-5" /></button>
                        </div>
                    </div>

                    {/* Queue Popover */}
                    {showQueue && (
                        <div className={`absolute bottom-full mb-3 right-0 w-64 p-3 rounded-lg shadow-2xl ${isNight ? 'bg-zinc-800' : 'bg-zinc-100'} border ${isNight ? 'border-zinc-700' : 'border-zinc-200'}`}>
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
                        </div>
                    )}
                </div>
            );
        }

        const placeholderText = isAuthenticated ? "Select music to play" : "Login to start listening";
        return (
             <div className="flex items-center w-full h-full gap-5 px-4">
                <div className={`w-12 h-12 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <FaSpotify className={`w-7 h-7 ${isNight ? 'text-green-500' : 'text-green-600'}`} />
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="font-semibold truncate">Spotify</div>
                    <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                        {placeholderText}
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
