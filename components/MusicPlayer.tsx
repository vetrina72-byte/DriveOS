import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
    FiPlay, FiPause, FiSkipBack, FiSkipForward
} from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';

interface MusicPlayerProps {
    isAnyAppOpen: boolean;
    isNight: boolean;
    dockedConfig: { width: number; bottom: number; left: number; height: number; };
    floatingConfig: { width: number; bottom: number; placeholderWidth: number; height: number; };
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ isAnyAppOpen, isNight, dockedConfig, floatingConfig }) => {
    const { accessToken, logout, setDeviceId, isAuthenticated } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const progressRef = useRef<HTMLDivElement>(null);
    const [isCommandLoading, setIsCommandLoading] = useState(false);
    const [displayProgress, setDisplayProgress] = useState(0);

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

    useEffect(() => {
        if (!isPlayerActive) return;
        let animationFrameId: number;
        const updateProgress = () => {
            if (playerState && !playerState.paused) {
                const currentPosition = playerState.position + (Date.now() - playerState.timestamp);
                setDisplayProgress(currentPosition);
            } else if (playerState) {
                setDisplayProgress(playerState.position);
            }
            animationFrameId = requestAnimationFrame(updateProgress);
        };
        animationFrameId = requestAnimationFrame(updateProgress);
        return () => cancelAnimationFrame(animationFrameId);
    }, [playerState, isPlayerActive]);

    const executePlayerCommand = useCallback(async (command: () => Promise<void> | void) => {
        if (!playerRef.current) return;
        setIsCommandLoading(true);
        try {
            await command();
        } catch (error) {
            console.error("Spotify player command failed:", error);
        } finally {
            setTimeout(() => setIsCommandLoading(false), 300);
        }
    }, []);

    const handleTogglePlay = () => executePlayerCommand(() => playerRef.current!.togglePlay());
    const handleNextTrack = () => executePlayerCommand(() => playerRef.current!.nextTrack());
    const handlePrevTrack = () => executePlayerCommand(() => playerRef.current!.previousTrack());
    
    const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!progressRef.current || !playerState) return;
        const rect = progressRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const percentage = (clickX / rect.width);
        const positionMs = Math.round(playerState.duration * percentage);
        executePlayerCommand(() => playerRef.current?.seek(positionMs));
    };

    const playerStyle = useMemo(() => {
        if (isAnyAppOpen) {
            // Docked state
            return {
                width: `${dockedConfig.width}px`,
                height: `${dockedConfig.height}px`,
                bottom: `${dockedConfig.bottom}px`,
                left: `${dockedConfig.left}px`,
                transform: 'translateX(0)',
            };
        } else {
            // Floating state
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
        ? 'bg-zinc-800/95 text-white border-zinc-700' 
        : 'bg-gray-100/95 text-black border-zinc-300';
    const iconColor = isNight ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black';
    
    const renderPlayerContent = () => {
        if (isPlayerActive) {
            const { track_window, paused, disallows } = playerState!;
            const { name: trackName, album, artists } = track_window.current_track!;
            const imageUrl = album.images[0]?.url;

            return (
                <div className="w-full h-full flex items-center gap-5">
                    {/* Left: Art and Info */}
                    <div className="flex items-center gap-3 flex-shrink-0" style={{width: '240px'}}>
                        {imageUrl && <img src={imageUrl} alt={album.name} className="w-14 h-14 rounded-md shadow-lg" />}
                        <div className="overflow-hidden">
                            <div className="font-bold truncate text-base">{trackName}</div>
                            <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                {artists.map(a => a.name).join(', ')}
                            </div>
                        </div>
                    </div>

                    {/* Center: Controls & Progress */}
                    <div className="flex-grow flex flex-col justify-center gap-2 px-4">
                        {/* Progress Bar (at the top of this column) */}
                        <div 
                            ref={progressRef}
                            onClick={handleSeek}
                            className="w-full h-3 cursor-pointer group flex items-center"
                        >
                            <div className="w-full h-1 bg-gray-500/30 rounded-full relative">
                                <div 
                                    className={`h-full rounded-full ${isNight ? 'bg-white' : 'bg-black'} relative`}
                                    style={{ width: `${(displayProgress / playerState.duration) * 100}%` }}
                                >
                                    {/* Handle shows on hover */}
                                    <div className={`absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full ${isNight ? 'bg-white' : 'bg-black'} opacity-0 group-hover:opacity-100 transition-opacity`}></div>
                                </div>
                            </div>
                        </div>
                        {/* Controls (below progress bar) */}
                        <div className="flex justify-center items-center gap-6 -mt-1">
                            <button onClick={handlePrevTrack} disabled={disallows.skipping_prev} className={`disabled:opacity-30 transition ${iconColor}`}>
                                <FiSkipBack className="w-7 h-7" />
                            </button>
                            <button onClick={handleTogglePlay} disabled={isCommandLoading} className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full transition-all transform hover:scale-105 relative ${isNight ? 'bg-white/10' : 'bg-black/5'}`}>
                                {isCommandLoading 
                                    ? <div className={`w-7 h-7 rounded-full ${isNight ? 'loading-spinner-border' : 'loading-spinner-border-dark'}`}></div>
                                    : (paused ? <FiPlay className={`w-7 h-7 ml-1 ${isNight ? 'text-white' : 'text-black'}`} /> : <FiPause className={`w-7 h-7 ${isNight ? 'text-white' : 'text-black'}`} />)
                                }
                            </button>
                            <button onClick={handleNextTrack} disabled={disallows.skipping_next} className={`disabled:opacity-30 transition ${iconColor}`}>
                                <FiSkipForward className="w-7 h-7" />
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        const placeholderText = isAuthenticated ? "Select music to play" : "Login to start listening";
        return (
             <div className="flex items-center w-full h-full gap-5">
                <div className={`w-14 h-14 rounded-md shadow-lg flex-shrink-0 flex items-center justify-center ${isNight ? 'bg-zinc-800' : 'bg-zinc-200'}`}>
                    <FaSpotify className={`w-8 h-8 ${isNight ? 'text-green-500' : 'text-green-600'}`} />
                </div>
                <div className="flex-grow overflow-hidden">
                    <div className="font-bold truncate text-base">Spotify</div>
                    <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                        {placeholderText}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div 
            className={`music-player ${themeClasses} backdrop-blur-md border rounded-xl shadow-lg p-4 flex items-center gap-5 overflow-hidden`}
            style={playerStyle}
        >
            {renderPlayerContent()}
        </div>
    );
};

export default MusicPlayer;