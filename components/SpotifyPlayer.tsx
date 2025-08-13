

import React from 'react';
import { FiX } from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import SpotifyLogin from './SpotifyLogin';
import SpotifyBrowse from './SpotifyBrowse';

export default function SpotifyPlayer({ 
    isOpen, 
    onClose,
    initialView,
}: { 
    isOpen: boolean; 
    onClose: () => void;
    initialView: any | null;
}) {
    const { isAuthenticated, user, error, isLoading } = useAuth();

    const renderContent = () => {
        if (isLoading && !isAuthenticated) {
             return (
                <div className="flex flex-col items-center justify-center h-full">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/50"></div>
                </div>
            );
        }
        
        if (error) {
            return (
                <div className="text-center text-red-400 flex flex-col items-center justify-center h-full gap-4 p-4">
                    <p className="font-semibold">Errore di Autenticazione</p>
                    <p className="text-sm">{error}</p>
                    <SpotifyLogin />
                </div>
            );
        }

        if (isAuthenticated && user) {
            return <SpotifyBrowse key={initialView?.id || 'home'} initialView={initialView} />;
        }
        
        return (
             <div className="flex flex-col items-center justify-center h-full">
                <SpotifyLogin />
            </div>
        );
    };

    return (
        <div 
            className={`fixed top-0 right-0 bottom-20 w-2/3 text-white shadow-2xl z-20 flex transition-transform duration-500 ease-[cubic-bezier(0.2,0.8,0.2,1)]`}
            style={{
                transform: `translateX(${isOpen ? 0 : '100%'})`,
            }}
            aria-hidden={!isOpen}
            role="dialog"
            aria-modal="true"
            aria-labelledby="spotify-player-title"
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-full h-full flex flex-col relative bg-zinc-900/95 backdrop-blur-xl border-l border-white/10 overflow-hidden">
                <header className="absolute top-4 right-4 z-30">
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
