import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { FaSpotify } from 'react-icons/fa';
import { FiLoader } from 'react-icons/fi';

interface SpotifyLoginProps {
    onLoginSuccess: (tokenData: { access_token: string, refresh_token?: string }) => void;
    onLoginError: (error: string) => void;
}

const SpotifyLogin: React.FC<SpotifyLoginProps> = ({ onLoginSuccess, onLoginError }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [popup, setPopup] = useState<Window | null>(null);
    const [authCode, setAuthCode] = useState<string | null>(null);

    const handleLogin = () => {
        setIsLoading(true);
        onLoginError(''); // Clear previous errors

        const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
        const redirectUri = 'http://localhost:5173/spotify-callback';
        const scope = 'user-read-private user-read-email streaming user-modify-playback-state user-read-playback-state';

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

    const exchangeCodeForToken = useCallback(async (code: string) => {
        try {
            const response = await axios.post('http://localhost:8888/api/exchange-token', { code });
            onLoginSuccess(response.data);
        } catch (exchangeError: any) {
            console.error('Token exchange error:', exchangeError);
            const errorMessage = exchangeError.response?.data?.details?.error_description || 'Failed to exchange authorization code for a token.';
            onLoginError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    }, [onLoginSuccess, onLoginError]);

    // Effect for listening to messages from the popup
    useEffect(() => {
        console.log("MAIN_APP: Listener di messaggi attivato.");

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) {
                return;
            }

            if (event.data && event.data.type === 'spotifyAuth') {
                const { code, error: authError } = event.data;
                
                if (popup) {
                    popup.close();
                    setPopup(null);
                }

                if (authError) {
                    onLoginError(`Authentication failed: ${authError}`);
                    setIsLoading(false);
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
    }, [popup, onLoginError]);

    // Effect for exchanging the token once we have an auth code
    useEffect(() => {
        if (authCode) {
            exchangeCodeForToken(authCode);
        }
    }, [authCode, exchangeCodeForToken]);

    return (
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
    );
};

export default SpotifyLogin;