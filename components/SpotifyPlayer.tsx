
import React, { useState } from 'react';
import { FiX, FiMusic } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import SpotifyLogin from './SpotifyLogin';
import PlaylistList from './PlaylistList';
import MusicPlayer from './MusicPlayer';

export default function SpotifyPlayer({ 
    isOpen, 
    onClose, 
    spotifyPlayerTop,
    spotifyPlayerBottom,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    spotifyPlayerTop: number;
    spotifyPlayerBottom: number;
}) {
    const { isAuthenticated, user, error } = useAuth();
    const [selectedPlaylistUri, setSelectedPlaylistUri] = useState<string | null>(null);

    const renderContent = () => {
        if (error) {
            return (
                <div className="text-center text-red-400 flex flex-col items-center gap-4">
                    <p>Error: {error}</p>
                    <SpotifyLogin />
                </div>
            );
        }

        if (isAuthenticated && user) {
            return (
                <div className="flex w-full h-full">
                    <PlaylistList onSelectPlaylist={setSelectedPlaylistUri} />
                    <MusicPlayer selectedPlaylistUri={selectedPlaylistUri} />
                </div>
            );
        }
        
        return <SpotifyLogin />;
    };

    return (
        <div 
            className={`fixed right-0 w-2/3 text-white shadow-2xl z-20 flex transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]`}
            style={{
                transform: `translateX(${isOpen ? 0 : 100}%)`,
                top: `${spotifyPlayerTop}px`,
                bottom: `${spotifyPlayerBottom}px`,
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-player-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-full h-full flex flex-col relative bg-black/90 backdrop-blur-lg border-l border-white/10">
                <header className="absolute top-0 right-0 p-4 z-20">
                    <button className="p-2 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors" onClick={onClose} aria-label="Close Spotify">
                        <FiX className="h-5 w-5"/>
                    </button>
                </header>
                <h1 id="spotify-player-title" className="sr-only">Spotify Player</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
}
