
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessionId } from '../lib/sessionId';
import { FiAlertCircle, FiRefreshCw, FiX } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

const CheckmarkIcon = () => (
    <motion.svg className="w-24 h-24" viewBox="0 0 50 50" initial="hidden" animate="visible">
        <motion.circle cx="25" cy="25" r="24" stroke="#1DB954" strokeWidth="2" fill="none" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }} />
        <motion.path d="M14 27 L 22 35 L 37 20" fill="transparent" strokeWidth="3" stroke="#1DB954" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1, transition: { duration: 0.4, ease: "easeInOut", delay: 0.3 } }} />
    </motion.svg>
);

function SpotifyLogin() {
  const { login } = useAuth();
  const [uiState, setUiState] = useState<'CARICAMENTO' | 'ATTESA_SCANSIONE' | 'LOGIN_COMPLETATO' | 'ERRORE' | 'SCADUTO' | 'PREMIUM_RICHIESTO'>('CARICAMENTO');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const pollIntervalRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
    }
  };

  const startLoginProcess = useCallback(() => {
    stopPolling();
    setUiState('CARICAMENTO');
    
    const sid = 'sid_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    setActiveSessionId(sid);
    
    const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
    const redirectUri = process.env.VITE_REDIRECT_URI;
    const scope = ['streaming', 'user-read-email', 'user-read-private', 'user-library-read', 'user-read-playback-state', 'user-modify-playback-state'].join(' ');
    
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.search = new URLSearchParams({
        client_id: clientId, response_type: 'code', redirect_uri: redirectUri || '',
        scope: scope, show_dialog: 'true', state: sid
    }).toString();

    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setUiState('ATTESA_SCANSIONE');
    
    pollForAuth(sid);
  }, [login]);

  const pollForAuth = (sid: string) => {
    stopPolling();
    pollIntervalRef.current = window.setInterval(() => {
      fetch(`/api/check-auth-status?sessionId=${sid}`)
        .then(res => res.json())
        .then(data => {
          if (data?.authenticated && data?.access_token) {
            stopPolling();
            setUiState('LOGIN_COMPLETATO');
            setTimeout(() => login({
                access_token: data.access_token,
                expires_in: (data.expires_at - Date.now()) / 1000,
                expires_at: data.expires_at,
            }), 1500);
          } else if (data?.error === 'premium_required') {
            stopPolling();
            setUiState('PREMIUM_RICHIESTO');
          } else if (data?.expired) {
            stopPolling();
            setUiState('SCADUTO');
            setTimeout(startLoginProcess, 2000);
          }
        })
        .catch(err => console.error("Poll error:", err));
    }, 3000);
  };

  useEffect(() => {
    startLoginProcess();
    return () => stopPolling();
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-[var(--spotify-panel-bg)]">
        <AnimatePresence mode="wait">
            {uiState === 'ATTESA_SCANSIONE' && (
                <motion.div 
                    key="qr" 
                    initial={{ opacity: 0, scale: 0.98 }} 
                    animate={{ opacity: 1, scale: 1 }} 
                    exit={{ opacity: 0, scale: 0.95 }} 
                    className="flex flex-col md:flex-row items-center gap-8 md:gap-12 bg-zinc-50 dark:bg-zinc-900 p-8 md:p-12 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-2xl max-w-3xl"
                >
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-56 h-56 p-4 bg-white rounded-2xl shadow-inner border border-zinc-100 flex items-center justify-center">
                            <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <div className="text-center md:text-left max-w-sm">
                        <FaSpotify className="w-12 h-12 text-[#1DB954] mb-6 mx-auto md:mx-0" />
                        <h1 className="text-3xl font-bold text-zinc-900 dark:text-white mb-3">Connetti Spotify</h1>
                        <p className="text-zinc-600 dark:text-zinc-400 text-lg mb-6 leading-relaxed">Scansiona il codice QR con il tuo smartphone per accedere alla tua musica.</p>
                        <div className="p-4 bg-blue-50 dark:bg-white/5 border border-blue-100 dark:border-white/10 rounded-xl">
                            <p className="text-blue-700 dark:text-blue-400 text-sm flex items-start gap-3">
                                <FiAlertCircle className="mt-0.5 flex-shrink-0" size={18} />
                                <span>L'integrazione richiede un account <strong>Spotify Premium</strong> attivo. Gli account Free non sono supportati.</span>
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {uiState === 'PREMIUM_RICHIESTO' && (
                <motion.div 
                    key="denied" 
                    initial={{ opacity: 0, y: 20 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center text-center max-w-md bg-white dark:bg-black/50 p-10 md:p-14 rounded-[2.5rem] border border-red-500/20 dark:border-red-500/40 backdrop-blur-2xl shadow-2xl"
                >
                    <motion.div 
                        initial={{ scale: 0, rotate: -45 }} 
                        animate={{ scale: 1, rotate: 0 }} 
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="w-24 h-24 bg-red-500 dark:bg-red-600 rounded-full flex items-center justify-center mb-8 shadow-xl"
                    >
                        <FiX className="text-white w-14 h-14" strokeWidth={3} />
                    </motion.div>
                    <h2 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-4">Accesso Negato</h2>
                    <p className="text-zinc-600 dark:text-zinc-300 text-lg mb-10 leading-relaxed">
                        L'account utilizzato è un account <strong>Free</strong>.<br/>Per abilitare Spotify su Drive OS è necessario un piano <strong>Premium</strong>.
                    </p>
                    <button 
                        onClick={startLoginProcess} 
                        className="flex items-center gap-3 bg-zinc-900 dark:bg-white text-white dark:text-black font-bold py-4 px-10 rounded-full hover:opacity-90 transition-all active:scale-95 shadow-lg"
                    >
                        <FiRefreshCw size={18} /> Riprova con altro account
                    </button>
                </motion.div>
            )}

            {uiState === 'LOGIN_COMPLETATO' && (
                <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center p-12">
                    <CheckmarkIcon />
                    <h2 className="text-3xl font-bold text-zinc-900 dark:text-white mt-8">Benvenuto!</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 mt-2 text-lg">Configurazione della libreria musicale...</p>
                </motion.div>
            )}

            {uiState === 'CARICAMENTO' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-zinc-200 dark:border-white/10 border-t-[#1DB954] rounded-full animate-spin" />
                    <p className="text-zinc-500 font-medium">Inizializzazione sessione...</p>
                </div>
            )}
            
            {(uiState === 'ERRORE' || uiState === 'SCADUTO') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-10 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-white/10 shadow-xl">
                    <div className="w-16 h-16 bg-zinc-100 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                        <FiAlertCircle className="text-zinc-400" size={32} />
                    </div>
                    <p className="text-zinc-900 dark:text-white text-xl font-bold mb-2">Sessione scaduta o errore</p>
                    <p className="text-zinc-500 dark:text-zinc-400 mb-8">Il codice QR non è più valido.</p>
                    <button onClick={startLoginProcess} className="px-10 py-4 bg-[#1DB954] text-black font-bold rounded-full hover:scale-105 transition-transform">Genera nuovo codice</button>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
