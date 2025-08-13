import React, { useEffect, useState } from 'react';
import { FiPlay, FiPause, FiSkipBack, FiSkipForward, FiLogOut } from 'react-icons/fi';
import type { SpotifyUser, PlaybackState } from './SpotifyPlayer';

interface NowPlayingProps {
    userInfo: SpotifyUser;
    playbackState: PlaybackState;
    onControl: (action: 'play' | 'pause' | 'next' | 'previous') => void;
    onLogout: () => void;
}

const NowPlaying: React.FC<NowPlayingProps> = ({ userInfo, playbackState, onControl, onLogout }) => {
    const { item, is_playing, progress_ms, device } = playbackState;
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        if (!item || progress_ms === undefined) return;

        const initialProgress = (progress_ms / item.duration_ms) * 100;
        setProgress(initialProgress);

        if (!is_playing) return;

        const startTime = Date.now();
        const startProgressMs = progress_ms;

        const interval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const newProgressMs = startProgressMs + elapsedTime;
            setProgress((newProgressMs / item.duration_ms) * 100);
        }, 1000);

        return () => clearInterval(interval);
    }, [progress_ms, item, is_playing]);


    if (!item) return null;

    const imageUrl = item.album.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb1020c22c0c9735183b397a69';
    const trackName = item.name;
    const artistName = item.artists.map(a => a.name).join(', ');
    
    const formatTime = (ms: number | undefined) => {
        if (ms === undefined) return '0:00';
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className="flex flex-col items-center justify-between h-full text-white p-6 animate-fade-in w-full max-w-md mx-auto">
            <header className="w-full flex justify-between items-center text-zinc-400">
                <div className="flex items-center gap-3">
                    <img
                        src={userInfo.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb1020c22c0c9735183b397a69'}
                        alt={userInfo.display_name}
                        className="w-8 h-8 rounded-full"
                    />
                    <span className="text-sm font-semibold">{userInfo.display_name}</span>
                </div>
                 <button onClick={onLogout} className="p-2 hover:text-white transition-colors" aria-label="Log Out">
                    <FiLogOut />
                </button>
            </header>

            <main className="flex flex-col items-center gap-6 mt-4 mb-auto">
                <img
                    src={imageUrl}
                    alt={`Album art for ${trackName}`}
                    className="w-64 h-64 md:w-80 md:h-80 rounded-lg shadow-2xl shadow-black/50 aspect-square"
                />
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
                        <span>{formatTime(progress_ms)}</span>
                        <span>{formatTime(item.duration_ms)}</span>
                    </div>
                </div>

                <div className="flex justify-center items-center gap-8">
                    <button onClick={() => onControl('previous')} aria-label="Previous track">
                        <FiSkipBack className="w-8 h-8 text-zinc-400 hover:text-white transition" />
                    </button>
                    <button
                        onClick={() => onControl(is_playing ? 'pause' : 'play')}
                        className="bg-white text-black rounded-full w-16 h-16 flex items-center justify-center shadow-lg transform hover:scale-110 transition-transform"
                        aria-label={is_playing ? 'Pause' : 'Play'}
                    >
                        {is_playing ? <FiPause className="w-8 h-8" /> : <FiPlay className="w-8 h-8 ml-1" />}
                    </button>
                    <button onClick={() => onControl('next')} aria-label="Next track">
                        <FiSkipForward className="w-8 h-8 text-zinc-400 hover:text-white transition" />
                    </button>
                </div>
                
                 {device && (
                    <div className="text-center text-xs text-green-400 mt-4 opacity-80">
                        Playing on {device.name}
                    </div>
                )}
            </footer>
        </div>
    );
};

export default NowPlaying;
