
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiVolume2, FiLogOut, FiMusic } from 'react-icons/fi';

interface MusicPlayerProps {
    selectedPlaylistUri: string | null;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ selectedPlaylistUri }) => {
    const { accessToken, logout, user } = useAuth();
    const playerRef = useRef<SpotifyPlayer | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [deviceId, setDeviceId] = useState<string | null>(null);
    const [playerState, setPlayerState] = useState<SpotifyPlayerState | null>(null);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!accessToken) return;

        const script = document.createElement('script');
        script.src = 'https://sdk.scdn.co/spotify-player.js';
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            const player = new window.Spotify.Player({
                name: 'Tesla Infotainment',
                getOAuthToken: cb => { cb(accessToken); },
                volume: 0.5
            });

            player.on('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
                setIsReady(true);
            });

            player.on('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setIsReady(false);
            });

            player.on('player_state_changed', state => {
                setPlayerState(state);
            });
            
            player.on('initialization_error', ({ message }) => { console.error(message); });
            player.on('authentication_error', ({ message }) => { console.error(message); logout(); });
            player.on('account_error', ({ message }) => { console.error(message); });
            player.on('playback_error', ({ message }) => { console.error(message); });

            player.connect();
            playerRef.current = player;
        };

        return () => {
            if (playerRef.current) {
                playerRef.current.disconnect();
            }
        };
    }, [accessToken, logout]);

    useEffect(() => {
        if (!selectedPlaylistUri || !deviceId || !accessToken) return;

        const playPlaylist = async () => {
            try {
                await axios.put(
                    `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
                    { context_uri: selectedPlaylistUri },
                    { headers: { Authorization: `Bearer ${accessToken}` } }
                );
            } catch (err) {
                console.error('Failed to start playback', err);
            }
        };

        playPlaylist();
    }, [selectedPlaylistUri, deviceId, accessToken]);
    
    useEffect(() => {
        if (!playerState || !playerState.track_window.current_track) return;

        const initialProgress = (playerState.position / playerState.duration) * 100;
        setProgress(initialProgress);

        if (playerState.paused) return;

        const startTime = Date.now();
        const startProgressMs = playerState.position;
        const totalDuration = playerState.duration;

        const interval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const newProgressMs = startProgressMs + elapsedTime;
            setProgress((newProgressMs / totalDuration) * 100);
        }, 1000);

        return () => clearInterval(interval);
    }, [playerState]);


    if (!isReady) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-zinc-400">
                <FiVolume2 className="w-16 h-16 mb-4"/>
                <h3 className="text-xl font-bold">Lettore Spotify</h3>
                <p>In attesa che l'SDK si connetta...</p>
                 <p className="text-sm mt-2">Apri Spotify su un altro dispositivo per attivare la sessione.</p>
            </div>
        );
    }
    
    if (!playerState || !playerState.track_window.current_track) {
        return (
            <div className="flex-grow flex flex-col items-center justify-center p-6 text-zinc-400">
                <FiMusic className="w-16 h-16 mb-4"/>
                <h3 className="text-xl font-bold">Niente in riproduzione</h3>
                <p>Seleziona una playlist per iniziare.</p>
            </div>
        )
    }
    
    const { track_window, paused, position, duration } = playerState;
    const { name: trackName, album, artists } = track_window.current_track;
    const imageUrl = album.images[0].url;
    const artistName = artists.map(a => a.name).join(', ');
    
     const formatTime = (ms: number) => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex-grow flex flex-col items-center justify-between h-full p-6 w-full max-w-md mx-auto">
             <header className="w-full flex justify-between items-center text-zinc-400">
                <div className="flex items-center gap-3">
                    <img
                        src={user?.images?.[0]?.url || ''}
                        alt={user?.display_name}
                        className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm font-semibold">{user?.display_name}</span>
                </div>
                 <button onClick={logout} className="p-2 hover:text-white transition-colors" aria-label="Log Out">
                    <FiLogOut />
                </button>
            </header>
            <main className="flex flex-col items-center gap-6 mt-4 mb-auto">
                <img src={imageUrl} alt={album.name} className="w-64 h-64 md:w-80 md:h-80 rounded-lg shadow-2xl shadow-black/50 aspect-square"/>
                <div className="text-center">
                    <h2 className="text-3xl font-bold truncate max-w-md">{trackName}</h2>
                    <p className="text-lg text-zinc-400 truncate max-w-md">{artistName}</p>
                </div>
            </main>

            <footer className="w-full">
                 <div className="w-full mb-2">
                    <div className="w-full bg-zinc-700 rounded-full h-1">
                        <div
                            className="bg-white rounded-full h-1"
                            style={{ width: `${progress}%`, transition: 'width 0.2s linear' }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400 mt-1">
                        <span>{formatTime(position)}</span>
                        <span>{formatTime(duration)}</span>
                    </div>
                </div>
                <div className="flex justify-center items-center gap-8">
                    <button onClick={() => playerRef.current?.previousTrack()} aria-label="Previous track">
                        <FiSkipBack className="w-8 h-8 text-zinc-400 hover:text-white transition" />
                    </button>
                    <button
                        onClick={() => playerRef.current?.togglePlay()}
                        className="bg-white text-black rounded-full w-16 h-16 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform"
                        aria-label={paused ? 'Play' : 'Pause'}
                    >
                        {paused ? <FiPlay className="w-8 h-8 ml-1" /> : <FiPause className="w-8 h-8" />}
                    </button>
                    <button onClick={() => playerRef.current?.nextTrack()} aria-label="Next track">
                        <FiSkipForward className="w-8 h-8 text-zinc-400 hover:text-white transition" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

export default MusicPlayer;
