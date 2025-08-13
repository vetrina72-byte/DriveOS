import React, { useState, useEffect, useCallback } from 'react';
import { FiX, FiLogOut } from 'react-icons/fi';
import SpotifyLogin from './SpotifyLogin';
import axios from 'axios';

interface SpotifyUser {
    display_name: string;
    images?: { url: string }[];
}

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
    const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('spotify_access_token'));
    const [userInfo, setUserInfo] = useState<SpotifyUser | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(!!accessToken);

    const handleLogout = useCallback(() => {
        setAccessToken(null);
        setUserInfo(null);
        setError(null);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
    }, []);

    const fetchUserInfo = useCallback(async (token: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const { data } = await axios.get('https://api.spotify.com/v1/me', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUserInfo(data);
        } catch (err) {
            console.error('Failed to fetch user info', err);
            handleLogout();
            setError('Your session may have expired. Please log in again.');
        } finally {
            setIsLoading(false);
        }
    }, [handleLogout]);

    useEffect(() => {
        if (accessToken && !userInfo) {
            fetchUserInfo(accessToken);
        }
    }, [accessToken, userInfo, fetchUserInfo]);

    const handleLoginSuccess = (tokenData: { access_token: string, refresh_token?: string }) => {
        const { access_token, refresh_token } = tokenData;
        localStorage.setItem('spotify_access_token', access_token);
        if (refresh_token) {
            localStorage.setItem('spotify_refresh_token', refresh_token);
        }
        setAccessToken(access_token);
    };

    const handleLoginError = (errorMessage: string) => {
        setError(errorMessage);
    };

    const renderContent = () => {
        if (isLoading) {
            return <div className="text-center">Verifying session...</div>;
        }

        if (error) {
            return (
                <div className="text-center text-red-400">
                    <p>Error: {error}</p>
                    <button onClick={() => setError(null)} className="mt-2 px-4 py-2 bg-zinc-700 rounded-lg">Try Again</button>
                </div>
            );
        }

        if (accessToken && userInfo) {
            return (
                <div className="flex flex-col items-center justify-center text-white gap-6 p-4 animate-fade-in">
                    <img 
                        src={userInfo.images?.[0]?.url || 'https://i.scdn.co/image/ab6761610000e5eb1020c22c0c9735183b397a69'}
                        alt={userInfo.display_name} 
                        className="w-24 h-24 rounded-full border-2 border-zinc-600 shadow-lg"
                    />
                    <div className="text-center">
                        <p className="text-zinc-400 text-sm">Logged in as</p>
                        <h2 className="text-2xl font-bold">{userInfo.display_name}</h2>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="bg-zinc-700 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-full transition-all duration-300 flex items-center gap-2"
                        aria-label="Log out from Spotify"
                    >
                        <FiLogOut />
                        <span>Log Out</span>
                    </button>
                </div>
            );
        }

        return <SpotifyLogin onLoginSuccess={handleLoginSuccess} onLoginError={handleLoginError} />;
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
            <div className="w-full h-full flex flex-col relative bg-black">
                <header className="absolute top-0 right-0 p-4 z-20">
                    <button className="p-2 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors" onClick={onClose} aria-label="Close Spotify">
                        <FiX className="h-5 w-5"/>
                    </button>
                </header>
                <h1 id="spotify-player-title" className="sr-only">Spotify Login</h1>
                <div className="flex-grow flex justify-center items-center overflow-hidden">
                     {renderContent()}
                </div>
            </div>
        </div>
    );
}