
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { generateUUID } from '../lib/sessionId';
import { FiRefreshCw } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

interface SpotifyLoginProps {
    isNight?: boolean;
}

// Icon component: Clean, thin strokes, distinct colors
const FeedbackIcon = ({ type, isNight }: { type: 'success' | 'error', isNight: boolean }) => {
    const isSuccess = type === 'success';
    // Use system-like colors: Green for success, Red for error
    const color = isSuccess ? '#22c55e' : '#ef4444';
    
    return (
        <div className={`flex items-center justify-center mb-6`}>
            {isSuccess ? (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
            ) : (
                <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
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

  // --- REFINED THEME CONFIGURATION ---
  const theme = {
    // Night: Rich Dark Gray (#1c1c1e) - Apple style dark mode card
    // Day: Pure White (#ffffff) - Clean, opaque, with soft shadow
    card: isNight 
        ? 'bg-[#1c1c1e] border border-white/5 shadow-2xl' 
        : 'bg-white border border-gray-100 shadow-[0_8px_40px_rgba(0,0,0,0.08)]', 
    
    title: isNight ? 'text-white' : 'text-gray-900',
    subtitle: isNight ? 'text-gray-400' : 'text-gray-500',
    
    // QR Code Container Background
    // Fix: Use bg-white for Day mode as well to avoid color mismatch with the card.
    qrBg: isNight ? 'bg-white' : 'bg-white', 
    // Fix: Very subtle border or no border for Day mode to blend in
    qrBorder: isNight ? 'border-transparent' : 'border-gray-100',

    button: isNight 
        ? 'bg-white text-black hover:bg-gray-200' 
        : 'bg-black text-white hover:bg-gray-800',
        
    spinner: isNight ? 'border-white' : 'border-black',
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 relative z-50">
      <AnimatePresence mode="wait">
        
        {uiState === 'ATTESA' && (
          <motion.div 
            key="qr"
            initial={{ opacity: 0, scale: 0.95, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-center gap-10 p-10 rounded-[32px] ${theme.card}`}
          >
            {/* QR Container */}
            <div className={`p-3 rounded-2xl ${theme.qrBg} border ${theme.qrBorder} flex-shrink-0 shadow-sm`}>
              <img src={qrCodeUrl} alt="QR" className="w-48 h-48 rounded-lg mix-blend-multiply" />
            </div>
            
            {/* Text Content */}
            <div className="max-w-xs flex flex-col justify-center gap-2">
              <div className="flex items-center gap-3 mb-2">
                <FaSpotify className="w-8 h-8 text-[#1DB954]" />
                <h2 className={`text-3xl font-bold tracking-tight ${theme.title}`}>Accedi</h2>
              </div>
              <p className={`text-lg leading-snug font-medium ${theme.subtitle}`}>
                Scansiona il codice per collegare il tuo account <strong>Spotify Premium</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {uiState === 'PREMIUM_ERROR' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.9, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className={`flex flex-col items-center text-center p-12 rounded-[32px] max-w-md ${theme.card}`}
          >
            <FeedbackIcon type="error" isNight={isNight} />
            <h2 className={`text-2xl font-bold mb-3 tracking-tight ${theme.title}`}>Richiesto Premium</h2>
            <p className={`text-base mb-8 leading-relaxed font-medium ${theme.subtitle}`}>
              L'integrazione richiede un abbonamento Spotify Premium attivo per funzionare.
            </p>
            <button 
              onClick={handleRetry}
              className={`flex items-center justify-center gap-2 px-8 py-3.5 rounded-full font-bold text-base transition-all active:scale-95 shadow-md ${theme.button}`}
            >
              <FiRefreshCw className="w-5 h-5" />
              Riprova
            </button>
          </motion.div>
        )}

        {uiState === 'LOADING' && (
          <motion.div 
            key="load" 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            className="flex flex-col items-center gap-5"
          >
            <div className={`w-10 h-10 border-4 border-t-transparent rounded-full animate-spin ${theme.spinner}`} />
            <p className={`text-base font-semibold ${theme.title}`}>Connessione in corso...</p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
