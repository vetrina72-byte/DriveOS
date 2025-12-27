
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { generateUUID } from '../lib/sessionId';
import { FiX, FiRefreshCw } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

interface SpotifyLoginProps {
    isNight?: boolean;
}

function SpotifyLogin({ isNight = true }: SpotifyLoginProps) {
  const { login, error: authError, clearError } = useAuth();
  // Aggiunto lo stato PREMIUM_ERROR
  const [uiState, setUiState] = useState<'IDLE' | 'ATTESA' | 'PREMIUM_ERROR' | 'LOADING'>('IDLE');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const sidRef = useRef<string>(generateUUID());
  const pollTimer = useRef<number | null>(null);

  const startLogin = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    clearError();
    
    const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
    const redirectUri = process.env.VITE_REDIRECT_URI;
    const scope = 'streaming user-read-email user-read-private user-library-read user-read-playback-state user-modify-playback-state';
    
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
        } else if (data.error === 'premium_required') {
          // RICEZIONE ERRORE DAL BACKEND: l'utente non ha premium
          clearInterval(pollTimer.current!);
          setUiState('PREMIUM_ERROR');
        }
      } catch (e) {
        console.error("Polling error", e);
      }
    }, 2000);
  }, [login, clearError]);

  useEffect(() => {
    startLogin();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [startLogin]);

  const handleRetry = () => {
    sidRef.current = generateUUID();
    startLogin();
  };

  const theme = {
    card: isNight ? 'bg-zinc-900/95 border-white/10' : 'bg-white/95 border-black/10',
    text: isNight ? 'text-white' : 'text-zinc-900',
    sub: isNight ? 'text-zinc-400' : 'text-zinc-500'
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6">
      <AnimatePresence mode="wait">
        {uiState === 'ATTESA' && (
          <motion.div 
            key="qr"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
            className={`flex items-center gap-12 p-12 rounded-[40px] border backdrop-blur-3xl shadow-2xl ${theme.card}`}
          >
            <div className="bg-white p-4 rounded-3xl shadow-inner">
              <img src={qrCodeUrl} alt="QR" className="w-64 h-64" />
            </div>
            <div className="max-w-xs">
              <FaSpotify className="w-12 h-12 text-[#1DB954] mb-6" />
              <h2 className={`text-4xl font-bold mb-4 tracking-tight ${theme.text}`}>Accedi</h2>
              <p className={`text-lg leading-relaxed ${theme.sub}`}>Scansiona per collegare il tuo account <b>Spotify Premium</b>.</p>
            </div>
          </motion.div>
        )}

        {uiState === 'PREMIUM_ERROR' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className={`flex flex-col items-center text-center p-16 rounded-[40px] border backdrop-blur-3xl shadow-2xl max-w-xl ${theme.card}`}
          >
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
              <FiX className="w-12 h-12 text-red-500" strokeWidth={3} />
            </div>
            <h2 className={`text-4xl font-extrabold mb-4 ${theme.text}`}>Accesso Negato</h2>
            <p className={`text-xl mb-10 ${theme.sub}`}>È necessario un account <b>Premium</b> per accedere.</p>
            <button 
              onClick={handleRetry}
              className="flex items-center gap-3 px-10 py-5 bg-zinc-800 text-white rounded-full font-bold text-xl hover:bg-zinc-700 active:scale-95 transition-all shadow-lg border border-white/10"
            >
              <FiRefreshCw />
              Riprova con un altro account
            </button>
          </motion.div>
        )}

        {uiState === 'LOADING' && (
          <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-6" />
            <p className={`text-2xl font-medium ${theme.text}`}>Sincronizzazione in corso...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
