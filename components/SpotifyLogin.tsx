import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessionId, generateUUID } from '../lib/sessionId';
import { FiXCircle, FiAlertCircle } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

const CheckmarkIcon = () => (
    <motion.svg className="w-24 h-24" viewBox="0 0 50 50" initial="hidden" animate="visible">
        <motion.circle cx="25" cy="25" r="24" stroke="#1DB954" strokeWidth="2" fill="none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }} />
        <motion.path d="M14 27 L 22 35 L 37 20" fill="transparent" strokeWidth="3" stroke="#1DB954" strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1, transition: { duration: 0.4, ease: "easeInOut", delay: 0.3 } }} />
    </motion.svg>
);

interface SpotifyLoginProps {
    isNight?: boolean;
}

function SpotifyLogin({ isNight = true }: SpotifyLoginProps) {
  const { login, error: authError, clearError } = useAuth();
  const [uiState, setUiState] = useState<'CARICAMENTO' | 'ATTESA_SCANSIONE' | 'LOGIN_COMPLETATO' | 'ERRORE' | 'PREMIUM_RICHIESTO'>('CARICAMENTO');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionId, setSessionId] = useState<string>(getSessionId());
  const pollIntervalRef = useRef<number | null>(null);

  const startLoginProcess = useCallback((forceNewSession = false) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    clearError();
    let currentSid = sessionId;
    if (forceNewSession) {
        currentSid = generateUUID();
        setSessionId(currentSid);
        localStorage.setItem('spotify_session_id', currentSid);
    }

    setUiState('CARICAMENTO');
    const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
    const redirectUri = process.env.VITE_REDIRECT_URI;
    const scope = [
        'streaming', 'user-read-email', 'user-read-private', 'user-library-read',
        'user-library-modify', 'user-read-playback-state', 'user-modify-playback-state',
        'user-read-recently-played', 'playlist-read-private', 'playlist-read-collaborative',
        'playlist-modify-public', 'playlist-modify-private', 'user-top-read',
        'user-follow-read', 'user-follow-modify'
    ].join(' ');
    
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.search = new URLSearchParams({
        client_id: clientId, response_type: 'code', redirect_uri: redirectUri!,
        scope: scope, show_dialog: 'true', state: currentSid
    }).toString();

    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setUiState('ATTESA_SCANSIONE');
  }, [sessionId, clearError]);
  
  const startPolling = useCallback((delay: number) => {
    if (!sessionId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = window.setInterval(() => {
      fetch(`/api/check-auth-status?sessionId=${sessionId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.authenticated && data.access_token) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('LOGIN_COMPLETATO');
            setTimeout(() => login({
                access_token: data.access_token,
                expires_in: data.expires_at ? (data.expires_at - Date.now()) / 1000 : 3600,
                expires_at: data.expires_at,
            }), 1500);
          } else if (data && data.error === 'premium_required') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('PREMIUM_RICHIESTO');
          } else if (data && data.error) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('ERRORE');
          }
        })
        .catch(() => console.warn('[POLLING] Network error'));
    }, delay);
  }, [sessionId, login]);

  useEffect(() => {
    if (authError === 'Premium required') {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        setUiState('PREMIUM_RICHIESTO');
    }
  }, [authError]);

  useEffect(() => {
    if (authError !== 'Premium required') {
        startLoginProcess();
    } else {
        setUiState('PREMIUM_RICHIESTO');
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [startLoginProcess, authError]);

  useEffect(() => {
    if (uiState === 'ATTESA_SCANSIONE' && sessionId) {
      startPolling(3000);
    }
  }, [uiState, sessionId, startPolling]);

  // Temi Day/Night
  const theme = {
    panel: isNight ? 'bg-black/60 border-white/10' : 'bg-white/70 border-black/5',
    textMain: isNight ? 'text-white' : 'text-zinc-900',
    textSub: isNight ? 'text-zinc-400' : 'text-zinc-600',
    qrBg: 'bg-white shadow-xl',
    button: 'bg-[#1DB954] hover:bg-[#1AA34A] text-white'
  };

  return (
    <div className="w-full h-full flex items-center justify-center p-12">
        <AnimatePresence mode="wait">
            {uiState === 'ATTESA_SCANSIONE' && (
                <motion.div 
                    key="qr-view" 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`flex items-center gap-16 p-14 rounded-[40px] border backdrop-blur-2xl shadow-2xl ${theme.panel}`}
                >
                    <div className={`flex-shrink-0 w-72 h-72 p-6 rounded-[32px] ${theme.qrBg}`}>
                        <img src={qrCodeUrl} alt="Spotify QR" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-left max-w-sm">
                        <FaSpotify className="w-16 h-16 text-[#1DB954] mb-8" />
                        <h1 className={`text-4xl font-extrabold mb-4 tracking-tight ${theme.textMain}`}>Collega Spotify</h1>
                        <p className={`text-xl leading-relaxed ${theme.textSub}`}>Usa il tuo telefono per scansionare il codice e accedere al tuo account Premium.</p>
                    </div>
                </motion.div>
            )}

            {uiState === 'PREMIUM_RICHIESTO' && (
                <motion.div 
                    key="premium-error" 
                    initial={{ opacity: 0, scale: 0.9 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`flex flex-col items-center justify-center text-center max-w-xl p-16 rounded-[40px] border backdrop-blur-2xl shadow-2xl ${theme.panel}`}
                >
                    <div className="relative mb-8">
                        <motion.div 
                            initial={{ scale: 0 }} 
                            animate={{ scale: 1.2, opacity: [0, 0.4, 0] }} 
                            transition={{ duration: 2, repeat: Infinity }}
                            className="absolute inset-0 bg-red-500 rounded-full blur-2xl"
                        />
                        <FiXCircle className="w-28 h-28 text-red-500 relative z-10" />
                    </div>
                    <h2 className={`text-4xl font-extrabold tracking-tight ${theme.textMain}`}>Accesso negato</h2>
                    <p className={`text-xl mt-6 font-medium ${theme.textSub}`}>Questa app richiede un account <b>Spotify Premium</b> per funzionare correttamente.</p>
                    <button 
                        onClick={() => startLoginProcess(true)} 
                        className={`mt-10 px-12 py-4 font-bold rounded-full text-xl transition-all transform hover:scale-105 active:scale-95 shadow-xl ${theme.button}`}
                    >
                        Riprova con un altro account
                    </button>
                </motion.div>
            )}

            {uiState === 'LOGIN_COMPLETATO' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                    <CheckmarkIcon />
                    <h2 className={`text-3xl font-bold mt-8 ${theme.textMain}`}>Accesso completato!</h2>
                    <p className={`text-lg mt-2 ${theme.textSub}`}>Configurazione libreria musicale...</p>
                </motion.div>
            )}

            {(uiState === 'CARICAMENTO' || uiState === 'ERRORE') && (
                <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                    {uiState === 'CARICAMENTO' && (
                        <div className="flex flex-col items-center gap-6">
                            <div className="w-16 h-16 border-4 border-[#1DB954]/20 border-t-[#1DB954] rounded-full animate-spin" />
                            <span className={`text-lg font-semibold ${theme.textSub}`}>Inizializzazione...</span>
                        </div>
                    )}
                    {uiState === 'ERRORE' && (
                        <div className={`flex flex-col items-center p-12 rounded-[40px] border backdrop-blur-2xl ${theme.panel}`}>
                            <FiAlertCircle className="w-20 h-20 text-yellow-500 mb-6" />
                            <p className={`text-2xl font-bold mb-8 ${theme.textMain}`}>Errore di connessione</p>
                            <button onClick={() => startLoginProcess()} className={`px-10 py-3 font-bold rounded-full text-lg ${theme.button}`}>Riprova</button>
                        </div>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;