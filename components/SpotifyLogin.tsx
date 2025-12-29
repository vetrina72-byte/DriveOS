
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { generateUUID } from '../lib/sessionId';
import { FiRefreshCw } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=4`;

interface SpotifyLoginProps {
    isNight?: boolean;
}

// Icon component: High quality, fluid drawing animations
const FeedbackIcon = ({ type, isNight }: { type: 'success' | 'error', isNight: boolean }) => {
    const isSuccess = type === 'success';
    // Apple-like colors: Green #32D74B (Dark mode) / #34C759 (Light mode), Red #FF453A (Dark) / #FF3B30 (Light)
    const successColor = isNight ? '#32D74B' : '#34C759';
    const errorColor = isNight ? '#FF453A' : '#FF3B30';
    const color = isSuccess ? successColor : errorColor;
    
    return (
        <div className={`flex items-center justify-center mb-6 relative`}>
            <motion.svg 
                width="80" height="80" viewBox="0 0 52 52" fill="none" 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }} // Apple-like spring/ease
            >
                {/* Solid filled circle background */}
                <motion.circle 
                    cx="26" cy="26" r="26" 
                    fill={color}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                />

                {isSuccess ? (
                    <motion.polyline 
                        points="14 27 22 35 38 17"
                        stroke="#FFFFFF"
                        strokeWidth="4" 
                        strokeLinecap="round" 
                        strokeLinejoin="round"
                        initial={{ pathLength: 0, opacity: 0 }}
                        animate={{ pathLength: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: 0.2, ease: "easeInOut" }}
                    />
                ) : (
                    <>
                        <motion.path 
                            d="M17 17L35 35"
                            stroke="#FFFFFF"
                            strokeWidth="4"
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 0.2, delay: 0.2, ease: "easeInOut" }}
                        />
                        <motion.path 
                            d="M35 17L17 35"
                            stroke="#FFFFFF"
                            strokeWidth="4"
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                            initial={{ pathLength: 0, opacity: 0 }}
                            animate={{ pathLength: 1, opacity: 1 }}
                            transition={{ duration: 0.2, delay: 0.3, ease: "easeInOut" }}
                        />
                    </>
                )}
            </motion.svg>
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
          // Short delay to show success state before switching context
          setTimeout(() => {
              login({
                access_token: data.access_token,
                expires_in: 3600,
                expires_at: data.expires_at
              });
          }, 1500);
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
    // Night: Deep, rich dark gray (#1C1C1E) matching iOS system backgrounds
    // Day: Pure white with subtle shadow
    card: isNight 
        ? 'bg-[#1C1C1E] border border-white/5 shadow-2xl' 
        : 'bg-white border border-black/5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]', 
    
    title: isNight ? 'text-white' : 'text-black',
    subtitle: isNight ? 'text-[#AEAEB2]' : 'text-[#636366]', // Apple system gray colors
    
    // Buttons
    buttonPrimary: isNight 
        ? 'bg-white text-black hover:bg-[#F2F2F7]' 
        : 'bg-black text-white hover:bg-[#3A3A3C]',
    
    spinner: isNight ? 'border-[#AEAEB2] border-t-white' : 'border-[#C7C7CC] border-t-black',
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-6 relative z-50">
      <AnimatePresence mode="wait">
        
        {uiState === 'ATTESA' && (
          <motion.div 
            key="qr"
            initial={{ opacity: 0, scale: 0.96, y: 10 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-center gap-16 p-16 rounded-[48px] ${theme.card}`}
          >
            {/* QR Container - Even Larger size (w-64) and adjusted padding */}
            <div className="p-4 bg-white rounded-[32px] shadow-sm border border-zinc-100 overflow-hidden flex-shrink-0">
              <img src={qrCodeUrl} alt="QR" className="w-64 h-64 mix-blend-multiply block" />
            </div>
            
            {/* Text Content */}
            <div className="max-w-sm flex flex-col justify-center gap-6">
              <div className="flex items-center gap-4">
                <FaSpotify className="w-12 h-12 text-[#1DB954]" />
                <h2 className={`text-4xl font-bold tracking-tight ${theme.title}`}>Accedi</h2>
              </div>
              <p className={`text-2xl leading-snug font-medium ${theme.subtitle}`}>
                Inquadra il codice per collegare il tuo account <strong>Spotify Premium</strong>.
              </p>
            </div>
          </motion.div>
        )}

        {/* Enlarged Error Card */}
        {uiState === 'PREMIUM_ERROR' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-col items-center text-center p-12 rounded-[40px] max-w-[400px] w-full ${theme.card}`}
          >
            <FeedbackIcon type="error" isNight={isNight} />
            <h2 className={`text-2xl font-bold mb-3 tracking-tight ${theme.title}`}>Richiesto Premium</h2>
            <p className={`text-lg mb-8 leading-relaxed font-medium px-2 ${theme.subtitle}`}>
              È necessario un abbonamento Spotify Premium attivo per utilizzare l'integrazione.
            </p>
            <button 
              onClick={handleRetry}
              className={`flex items-center justify-center gap-2.5 px-8 py-4 rounded-full font-bold text-lg transition-transform active:scale-95 w-full ${theme.buttonPrimary}`}
            >
              <FiRefreshCw className="w-6 h-6" />
              Riprova
            </button>
          </motion.div>
        )}

        {/* Enlarged Success/Loading Card */}
        {uiState === 'LOADING' && (
          <motion.div 
            key="load" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className={`flex flex-col items-center justify-center p-14 rounded-[48px] min-w-[320px] aspect-square ${theme.card}`}
          >
            <FeedbackIcon type="success" isNight={isNight} />
            <div className="flex flex-col items-center gap-4 mt-4">
                <h2 className={`text-2xl font-bold tracking-tight ${theme.title}`}>Collegato</h2>
                <div className="flex items-center gap-3">
                    <div className={`w-6 h-6 border-[3px] rounded-full animate-spin ${theme.spinner}`} />
                    <p className={`text-lg font-medium ${theme.subtitle}`}>Caricamento...</p>
                </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
