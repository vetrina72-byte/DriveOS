

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import apiClient from '../api';
import { 
    FiPlay, FiPause, FiSkipBack, FiSkipForward
} from 'react-icons/fi';
import { FaSpotify } from 'react-icons/fa';
import { 
    PiShuffleBold, PiRepeatBold, PiRepeatOnceBold
} from 'react-icons/pi';
import { IoMdAdd } from 'react-icons/io';
import { HiOutlineQueueList } from 'react-icons/hi2';
import type { SpotifyPlayer, SpotifyPlayerState, SpotifyTrack } from '@/globals';

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
    const [isLiked, setIsLiked] = useState(false);
    
    const isPlayerActive = isAuthenticated && isReady && playerState && playerState.track_window.current_track;

    // Check if the current track is liked
    useEffect(() => {
        if (!isPlayerActive) return;
        const trackId = playerState.track_window.current_track.id;
        if (!trackId) return;
        
        const checkLiked = async () => {
            try {
                const { data } = await apiClient.get('/me/tracks/contains', { params: { ids: trackId } });
                setIsLiked(data[0] || false);
            } catch (e) {
                console.error("Failed to check if track is liked", e);
            }
        };
        checkLiked();
    }, [isPlayerActive, playerState?.track_window.current_track.id]);

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
    
    const handleLikeTrack = async () => {
        if (!isPlayerActive) return;
        const trackId = playerState.track_window.current_track.id;
        if (!trackId) return;

        try {
            if (isLiked) {
                await apiClient.delete(`/me/tracks?ids=${trackId}`);
            } else {
                await apiClient.put(`/me/tracks?ids=${trackId}`);
            }
            setIsLiked(!isLiked);
        } catch(e) {
            console.error("Failed to toggle like status", e);
        }
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
        ? 'bg-[#121212]/90 text-white border-zinc-700/80' 
        : 'bg-white/90 text-black border-zinc-300';
    
    const renderPlayerContent = () => {
        if (isPlayerActive) {
            const { name: trackName, album, artists } = playerState.track_window.current_track!;
            const imageUrl = album.images[0]?.url;

            const iconColor = isNight ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-black';
            const activeIconColor = 'text-green-500';

            return (
                <div className="w-full h-full flex items-center justify-between gap-4 px-4">
                    {/* Left: Art and Info */}
                    <div className="flex items-center gap-3 w-1/3 min-w-0">
                        {imageUrl && <img src={imageUrl} alt={album.name} className="w-12 h-12 rounded-md shadow-md" />}
                        <div className="overflow-hidden">
                            <div className="font-semibold truncate">{trackName}</div>
                            <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                                {artists.map(a => a.name).join(', ')}
                            </div>
                        </div>
                    </div>

                    {/* Center: Controls */}
                    <div className="flex justify-center items-center gap-6">
                        <button onClick={handleToggleShuffle} className={`transition ${playerState.shuffle ? activeIconColor : iconColor}`}>
                            <PiShuffleBold className="w-6 h-6" />
                        </button>
                        <button onClick={handlePrevTrack} disabled={playerState.disallows.skipping_prev} className={`disabled:opacity-30 transition ${iconColor}`}>
                            <FiSkipBack className="w-6 h-6" />
                        </button>
                        <button onClick={handleTogglePlay} className={`w-10 h-10 flex items-center justify-center rounded-full transition ${isNight ? 'bg-zinc-700 hover:bg-zinc-600' : 'bg-zinc-200 hover:bg-zinc-300'}`}>
                           {playerState.paused ? <FiPlay className="w-6 h-6 ml-0.5" /> : <FiPause className="w-6 h-6" />}
                        </button>
                        <button onClick={handleNextTrack} disabled={playerState.disallows.skipping_next} className={`disabled:opacity-30 transition ${iconColor}`}>
                            <FiSkipForward className="w-6 h-6" />
                        </button>
                        <button onClick={handleToggleRepeat} className={`transition ${playerState.repeat_mode !== 0 ? activeIconColor : iconColor}`}>
                           {playerState.repeat_mode === 2 ? <PiRepeatOnceBold className="w-6 h-6"/> : <PiRepeatBold className="w-6 h-6" />}
                        </button>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex justify-end items-center gap-4 w-1/3">
                        <button onClick={handleLikeTrack} className={`transition ${isLiked ? 'text-green-500' : iconColor}`}>
                            <IoMdAdd className="w-6 h-6" />
                        </button>
                        <button className={`transition ${iconColor}`}>
                            <HiOutlineQueueList className="w-6 h-6" />
                        </button>
                    </div>
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