
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { generateUUID } from '../lib/sessionId';
import { FiRefreshCw, FiAlertCircle } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

interface SpotifyLoginProps {
    isNight?: boolean;
}

// Minimalist Icon Component - Thin strokes, no heavy backgrounds
const FeedbackIcon = ({ type }: { type: 'success' | 'error' }) => {
    const isSuccess = type === 'success';
    return (
        <div className={`flex items-center justify-center mb-6`}>
            {isSuccess ? (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#30D158" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#FF453A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            )}
        </div>
    );
};

function SpotifyLogin({ isNight = true }: SpotifyLoginProps) {
  const { login, clearError } = useAuth();
  const [uiState, setUiState] = useState<'IDLE' | 'ATTESA' | 'PREMIUM_ERROR' | 'LOADING'>('IDLE');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const sidRef = useRef<string>(generateUUID());
  const pollTimer = useRef<number | null>(null);

  const startLogin = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    clearError();
    
    const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
    const redirectUri = process.env.VITE_REDIRECT_URI;
    const scope = 'streaming user-read-email user-read-private user-library-read user-read-playback-state user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative user-library-modify user-follow-read user-follow-modify user-modify-playback-state';
    
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri!)}&scope=${encodeURIComponent(scope)}&state=${sidRef.current}&show_dialog=true`;

    setQrCodeUrl(generateQrUrl(authUrl));
    setUiState('ATTESA');

    pollTimer.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/check-auth-status?sessionId=${sidRef.current}`);
        const data = await res.json();
        
        if (data.authenticated && data.access_token) {
          clearInterval(pollTimer.current!);
          setUiState('LOADING');
          login({
            access_token: data.access_token,
            expires_in: 3600,
            expires_at: data.expires_at
          });
        } else if (data.error) {
          console.log(`[SPOTIFY LOGIN] Ricevuto stato errore: ${data.error}. Stop polling.`);
          clearInterval(pollTimer.current!);
          setUiState('PREMIUM_ERROR');
        }
      } catch (e) {
        console.error("Errore polling:", e);
      }
    }, 2000);
  }, [login, clearError]);

  useEffect(() => {
    startLogin();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [startLogin]);

  const handleRetry = () => {
    sidRef.current = generateUUID();
    setUiState('IDLE');
    setTimeout(startLogin, 100);
  };

  // Refined theme for better contrast and minimal look
  const theme = {
    // Removed border, using subtle shadow and backdrop blur
    card: isNight ? 'bg-black/40 backdrop-blur-xl' : 'bg-white/60 backdrop-blur-xl', 
    title: isNight ? 'text-white' : 'text-zinc-900',
    text: isNight ? 'text-zinc-400' : 'text-zinc-600',
    button: isNight 
        ? 'bg-white/10 hover:bg-white/20 text-white' 
        : 'bg-black/5 hover:bg-black/10 text-black',
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        
        {uiState === 'ATTESA' && (
          <motion.div 
            key="qr"
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-center gap-16 p-12 rounded-3xl ${theme.card}`}
          >
            <div className="bg-white p-3 rounded-2xl shadow-sm">
              <img src={qrCodeUrl} alt="QR" className="w-56 h-56" />
            </div>
            <div className="max-w-xs flex flex-col justify-center">
              <div className="flex items-center gap-3 mb-4">
                <FaSpotify className="w-8 h-8 text-[#1DB954]" />
                <h2 className={`text-2xl font-bold tracking-tight ${theme.title}`}>Accedi</h2>
              </div>
              <p className={`text-lg leading-relaxed font-normal ${theme.text}`}>
                Scansiona il codice per collegare il tuo account <strong>Spotify Premium</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {uiState === 'PREMIUM_ERROR' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            className={`flex flex-col items-center text-center p-12 rounded-3xl max-w-lg ${theme.card}`}
          >
            <FeedbackIcon type="error" />
            <h2 className={`text-2xl font-bold mb-2 tracking-tight ${theme.title}`}>Richiesto Premium</h2>
            <p className={`text-base mb-8 leading-relaxed ${theme.text}`}>
              L'integrazione con Drive OS richiede un abbonamento Spotify Premium attivo.
            </p>
            <button 
              onClick={handleRetry}
              className={`flex items-center gap-2 px-8 py-3 rounded-full font-medium text-base transition-all active:scale-95 ${theme.button}`}
            >
              <FiRefreshCw className="w-4 h-4" />
              Riprova
            </button>
          </motion.div>
        )}

        {uiState === 'LOADING' && (
          <motion.div 
            key="load" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col items-center gap-4"
          >
            {/* Minimalist Spinner */}
            <div className={`w-8 h-8 border-2 border-t-transparent rounded-full animate-spin ${isNight ? 'border-white' : 'border-zinc-800'}`} />
            <p className={`text-sm font-medium ${theme.text}`}>Connessione in corso...</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
