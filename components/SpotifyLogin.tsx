import React, { useState, useEffect } from 'react';
import { FaSpotify } from 'react-icons/fa';
import { FiX, FiCheckCircle, FiAlertTriangle, FiLoader } from 'react-icons/fi';

export default function SpotifyLogin() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<'idle' | 'authorizing' | 'exchanging' | 'success' | 'error'>('idle');
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem('spotify_access_token'));
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // First useEffect: listens for the message from the auth iframe/popup
  useEffect(() => {
    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return; // Security: ignore messages from other origins
      }

      const { type, code, error } = event.data;
      if (type === 'spotifyAuth') {
        if (code) {
          setAuthStatus('exchanging');
          setAuthCode(code); // Trigger the second useEffect
        } else if (error) {
          console.error('Spotify auth error received:', error);
          setError(`Autorizzazione negata da Spotify: ${error}`);
          setAuthStatus('error');
        }
      }
    };

    window.addEventListener('message', handleAuthMessage);

    // Cleanup function to remove the listener
    return () => {
      window.removeEventListener('message', handleAuthMessage);
    };
  }, []); // Empty dependency array ensures this runs only once

  // Second useEffect: triggers when authCode is set, and exchanges it for a token
  useEffect(() => {
    const exchangeCodeForToken = async () => {
      if (!authCode) return;

      setError(null);
      try {
        const response = await fetch('http://localhost:8888/api/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: authCode }),
        });
        
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.details?.error_description || data.error || 'Failed to exchange token');
        }

        setAccessToken(data.access_token);
        localStorage.setItem('spotify_access_token', data.access_token);
        localStorage.setItem('spotify_refresh_token', data.refresh_token);
        localStorage.setItem('spotify_token_expires_at', String(Date.now() + data.expires_in * 1000));
        
        setAuthStatus('success');
        setTimeout(() => {
            setIsModalOpen(false);
            setAuthCode(null); // Reset code after use
        }, 1500);
        
      } catch (err: any) {
        console.error('Error exchanging code for token:', err);
        setError(err.message);
        setAuthStatus('error');
        setAuthCode(null); // Reset code after use
      }
    };

    exchangeCodeForToken();
  }, [authCode]); // Dependency array ensures this runs when authCode changes

  // On initial load, check if there's an existing, non-expired token.
  useEffect(() => {
    const token = localStorage.getItem('spotify_access_token');
    const expiresAt = localStorage.getItem('spotify_token_expires_at');
    if (token && expiresAt && Date.now() < Number(expiresAt)) {
      setAccessToken(token);
    } else {
      localStorage.removeItem('spotify_access_token');
      localStorage.removeItem('spotify_refresh_token');
      localStorage.removeItem('spotify_token_expires_at');
    }
  }, []);

  const handleLoginClick = () => {
    setError(null);
    setAuthCode(null);
    setAuthStatus('authorizing');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    if (authStatus !== 'success') {
      setAuthStatus('idle');
    }
  };

  // This URI must match what's in server.js and the Spotify Developer Dashboard
  const redirectUri = 'http://localhost:3000/spotify-callback';
  const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
  const scope = 'user-read-private user-read-email streaming user-modify-playback-state user-read-playback-state';
  
  const authUrl = new URL("https://accounts.spotify.com/authorize");
  authUrl.search = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: scope,
    show_dialog: 'true',
  }).toString();

  if (accessToken) {
    return (
      <div className="bg-green-500/20 text-green-300 font-bold py-4 px-8 rounded-full text-lg flex items-center gap-3 animate-fade-in">
        <FiCheckCircle className="w-6 h-6" />
        <span>Accesso Eseguito</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={handleLoginClick}
        className="bg-[#1DB954] hover:bg-[#1AA34A] text-white font-bold py-4 px-8 rounded-full text-lg transition-all duration-300 transform hover:scale-105 flex items-center gap-3"
        aria-label="Accedi con Spotify"
      >
        <FaSpotify className="w-6 h-6" />
        <span>Accedi con Spotify</span>
      </button>

      {isModalOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in"
          onClick={handleCloseModal}
          role="dialog"
          aria-modal="true"
        >
          <div 
            className="bg-zinc-800 p-4 rounded-xl shadow-2xl relative w-full max-w-2xl h-4/5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4 flex-shrink-0">
              <h2 className="text-xl font-bold text-white">Spotify Login</h2>
              <button 
                onClick={handleCloseModal} 
                className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-zinc-700"
                aria-label="Chiudi"
              >
                <FiX size={24} />
              </button>
            </div>
            
            <div className="w-full h-full flex-grow relative bg-zinc-900 rounded-lg">
                {(authStatus === 'authorizing') && (
                    <iframe
                      src={authUrl.toString()}
                      className="w-full h-full border-0 rounded-lg"
                      title="Spotify Authorization"
                    ></iframe>
                )}
                {authStatus === 'exchanging' && (
                    <div className="w-full h-full flex flex-col justify-center items-center text-center">
                        <FiLoader className="w-16 h-16 text-blue-400 mb-4 animate-spin" />
                        <p className="text-2xl font-semibold text-blue-300">Verifica in corso...</p>
                    </div>
                )}
                {authStatus === 'success' && (
                    <div className="w-full h-full flex flex-col justify-center items-center text-center">
                        <FiCheckCircle className="w-16 h-16 text-green-400 mb-4" />
                        <p className="text-2xl font-semibold text-green-300">Autenticazione Riuscita!</p>
                        <p className="text-zinc-400 mt-2">Questa finestra si chiuderà a breve.</p>
                    </div>
                )}
                {authStatus === 'error' && (
                    <div className="w-full h-full flex flex-col justify-center items-center text-center p-4">
                        <FiAlertTriangle className="w-16 h-16 text-red-400 mb-4" />
                        <p className="text-2xl font-semibold text-red-300">Errore di Autenticazione</p>
                        <p className="text-zinc-400 mt-2">{error || "Si è verificato un errore sconosciuto."}</p>
                    </div>
                )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}