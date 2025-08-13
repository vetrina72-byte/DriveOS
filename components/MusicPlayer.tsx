import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward } from 'react-icons/fi';
import type { SpotifyPlayer, SpotifyPlayerState } from '@/globals';

const MusicPlayer: React.FC<{ isAnyAppOpen: boolean; isNight: boolean }> = ({ isAnyAppOpen, isNight }) => {
    const { accessToken, logout, setDeviceId } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [progress, setProgress] = useState(0);

    const isPlayerVisible = isReady && playerState && playerState.track_window.current_track;

    useEffect(() => {
        if (!accessToken) {
            // If user logs out, disconnect the player
            if (playerRef.current) {
                playerRef.current.disconnect();
                playerRef.current = null;
            }
            return;
        };

        const scriptId = 'spotify-sdk';
        if (document.getElementById(scriptId)) return;

        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            if (playerRef.current) return;

            const player = new window.Spotify.Player({
                name: 'Tesla Infotainment',
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

        return () => {
            // Disconnect logic handled by accessToken change
        };
    }, [accessToken, logout, setDeviceId]);
    
    useEffect(() => {
        if (!playerState) return;
        
        const updateProgress = () => {
            if (playerState.paused) {
                setProgress(playerState.position / playerState.duration * 100);
                return;
            }
            const newProgress = (playerState.position + (Date.now() - playerState.timestamp)) / playerState.duration * 100;
            setProgress(newProgress);
        }

        updateProgress();
        const interval = setInterval(updateProgress, 500);
        return () => clearInterval(interval);
    }, [playerState]);

    if (!isPlayerVisible) {
        return null; // Don't render anything if there's no track
    }

    const { track_window, paused } = playerState;
    const { name: trackName, album, artists } = track_window.current_track!;
    const imageUrl = album.images[0].url;

    const themeClasses = isNight 
        ? 'bg-zinc-900/80 text-white border-zinc-700' 
        : 'bg-white/80 text-black border-zinc-300';
    const iconColor = isNight ? 'text-zinc-300 hover:text-white' : 'text-zinc-600 hover:text-black';

    return (
        <div className={`music-player ${isAnyAppOpen ? 'player-docked' : 'player-floating'} ${themeClasses} backdrop-blur-md border rounded-xl shadow-2xl p-3 flex items-center gap-4`}>
            <img src={imageUrl} alt={album.name} className="w-14 h-14 rounded-md shadow-lg" />
            <div className="flex-grow overflow-hidden">
                <div className="font-bold truncate">{trackName}</div>
                <div className={`text-sm truncate ${isNight ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    {artists.map(a => a.name).join(', ')}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <button onClick={() => playerRef.current?.previousTrack()} aria-label="Previous track">
                    <FiSkipBack className={`w-6 h-6 transition ${iconColor}`} />
                </button>
                <button
                    onClick={() => playerRef.current?.togglePlay()}
                    className={`w-12 h-12 flex items-center justify-center rounded-full transition-transform transform hover:scale-110 ${isNight ? 'bg-white text-black' : 'bg-black text-white'}`}
                    aria-label={paused ? 'Play' : 'Pause'}
                >
                    {paused ? <FiPlay className="w-6 h-6 ml-1" /> : <FiPause className="w-6 h-6" />}
                </button>
                <button onClick={() => playerRef.current?.nextTrack()} aria-label="Next track">
                    <FiSkipForward className={`w-6 h-6 transition ${iconColor}`} />
                </button>
            </div>
        </div>
    );
};

export default MusicPlayer;