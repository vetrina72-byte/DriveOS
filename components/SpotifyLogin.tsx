import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';

// Generate a simple v4 UUID.
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const SpotifyLogin: React.FC = () => {
    const { login, isLoading, error, clearError } = useAuth();
    const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('Scansiona per accedere a Spotify');
    const pollingIntervalRef = useRef<number | null>(null);

    // This effect runs once to generate the QR code and start polling.
    useEffect(() => {
        clearError();
        const sessionId = generateUUID();

        const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
        const redirectUri = process.env.VITE_REDIRECT_URI;
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
          'playlist-modify-public',
          'playlist-modify-private',
          'user-top-read',
          'user-follow-read',
          'user-follow-modify'
        ].join(' ');
        
        const authUrl = new URL("https://accounts.spotify.com/authorize");
        authUrl.search = new URLSearchParams({
            client_id: clientId,
            response_type: 'code',
            redirect_uri: redirectUri,
            scope: scope,
            show_dialog: 'true',
            state: sessionId // Use the 'state' parameter to pass our session ID
        }).toString();
        
        // Use an external service to generate the QR code image
        setQrCodeUrl(`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl.toString())}&bgcolor=0-0-0&color=fff&qzone=1`);
        setStatusMessage('Scansiona il QR code con il tuo telefono per accedere.');

        // Start polling the server to check for the auth code
        pollingIntervalRef.current = window.setInterval(async () => {
            try {
                const response = await fetch(`/api/check-auth-status?sessionId=${sessionId}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.code) {
                        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
                        setStatusMessage('Autenticazione riuscita!');
                        login(data.code); // The auth code has been received, proceed with login
                    }
                }
            } catch (err) {
                console.error("Polling failed:", err);
            }
        }, 3000); // Poll every 3 seconds

        // Cleanup on component unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [login, clearError]);

    return (
        <div className="flex flex-col items-center justify-center gap-6 p-8 rounded-lg bg-zinc-900/50">
            <div className="flex items-center gap-3">
                 <FaSpotify className="w-8 h-8 text-[#1DB954]" />
                 <h2 className="text-2xl font-bold text-white">Accedi a Spotify</h2>
            </div>
           
            {isLoading ? (
                 <div className="w-64 h-64 flex flex-col items-center justify-center bg-zinc-800 rounded-lg">
                    <div className="w-12 h-12 rounded-full loading-spinner-border mb-4" />
                    <p className="text-zinc-300">Autenticazione...</p>
                 </div>
            ) : qrCodeUrl ? (
                <div className="w-64 h-64 p-4 bg-white rounded-lg shadow-2xl">
                    <img src={qrCodeUrl} alt="Spotify Login QR Code" className="w-full h-full object-contain" />
                </div>
            ) : (
                <div className="w-64 h-64 flex items-center justify-center bg-zinc-800 rounded-lg">
                    <div className="w-10 h-10 rounded-full loading-spinner-border" />
                </div>
            )}
            
            <p className="text-zinc-300 text-center max-w-xs">{statusMessage}</p>

            {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>
    );
};

export default SpotifyLogin;