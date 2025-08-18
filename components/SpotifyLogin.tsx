
import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';

const SpotifyLogin: React.FC = () => {
    const { login, isLoading, error, clearError } = useAuth();
    const [popup, setPopup] = useState<Window | null>(null);
    const [authCode, setAuthCode] = useState<string | null>(null);

    const handleLogin = () => {
        clearError();

        const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
        const redirectUri = 'http://localhost:5173/spotify-callback';
        const scope = [
          'streaming',
          'user-read-email',
          'user-read-private',
          'user-library-read',
          'user-library-modify',
          'user-read-playback-state',
          'user-modify-playback-state',
          'user-read-recently-played',
          'playlist-read-private',
          'playlist-read-collaborative',
          'user-top-read'
        ].join(' ');

        const authUrl = new URL("https://accounts.spotify.com/authorize");
        authUrl.search = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: scope,
            show_dialog: 'true',
        }).toString();

        const popupWidth = 500;
        const popupHeight = 800;
        const left = window.screen.width / 2 - popupWidth / 2;
        const top = window.screen.height / 2 - popupHeight / 2;

        const newPopup = window.open(
            authUrl.toString(),
            'spotifyLoginPopup',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},popup=true,scrollbars=yes`
        );
        setPopup(newPopup);
    };

    // Effect for listening to messages from the popup
    useEffect(() => {
        console.log("MAIN_APP: Listener di messaggi attivato.");

        const handleMessage = (event: MessageEvent) => {
            // ORIGIN CHECK REMOVED
            if (event.data && event.data.type === 'spotifyAuth') {
                const { code, error: authError } = event.data;
                
                if (popup) {
                    popup.close();
                    setPopup(null);
                }

                if (authError) {
                    login(null, `Authentication failed: ${authError}`);
                } else if (code) {
                    console.log(`MAIN_APP: Messaggio ricevuto dal popup! Codice: ${code}`);
                    setAuthCode(code);
                }
            }
        };

        window.addEventListener('message', handleMessage);

        return () => {
            console.log("MAIN_APP: Listener di messaggi rimosso.");
            window.removeEventListener('message', handleMessage);
        };
    }, [popup, login]);

    // Effect for exchanging the token once we have an auth code
    useEffect(() => {
        if (authCode) {
            login(authCode);
        }
    }, [authCode, login]);

    return (
        <div className="flex flex-col items-center gap-4">
            <button
                onClick={handleLogin}
                disabled={isLoading}
                className="bg-[#1DB954] hover:bg-[#1AA34A] text-white font-bold py-4 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-3 disabled:bg-zinc-500 disabled:scale-100 disabled:cursor-wait"
                aria-label="Accedi con Spotify"
            >
                {isLoading ? (
                    <>
                        <FiLoader className="w-6 h-6 animate-spin" />
                        <span>Authenticating...</span>
                    </>
                ) : (
                    <>
                        <FaSpotify className="w-6 h-6" />
                        <span>Accedi con Spotify</span>
                    </>
                )}
            </button>
            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
    );
};

export default SpotifyLogin;
