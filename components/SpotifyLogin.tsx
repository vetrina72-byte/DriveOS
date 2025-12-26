
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
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
    
    // Generiamo un ID sessione univoco per questo tentativo
    const sid = 'sid_' + Math.random().toString(36).substr(2, 9);
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
    
    // Iniziamo il polling immediatamente con il nuovo ID
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
            // BLOCCA TUTTO: l'utente non ha premium
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
  }, []); // Eseguito solo al montaggio

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-[var(--spotify-panel-bg)]">
        <AnimatePresence mode="wait">
            {uiState === 'ATTESA_SCANSIONE' && (
                <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-12 bg-neutral-900 p-12 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-64 h-64 p-4 bg-white rounded-lg shadow-lg">
                            <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                        </div>
                    </div>
                    <div className="text-left max-w-md">
                        <FaSpotify className="w-12 h-12 text-[#1DB954] mb-6" />
                        <h1 className="text-3xl font-bold text-white mb-2">Connetti Spotify</h1>
                        <p className="text-zinc-400 text-lg mb-6">Scansiona il codice QR con il tuo smartphone per accedere.</p>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <p className="text-zinc-300 text-sm flex items-start gap-3">
                                <FiAlertCircle className="mt-1 flex-shrink-0 text-blue-400" />
                                <span>L'integrazione Drive OS richiede un account <strong>Spotify Premium</strong> attivo per abilitare la riproduzione remota.</span>
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {uiState === 'PREMIUM_RICHIESTO' && (
                <motion.div 
                    key="denied" 
                    initial={{ opacity: 0, y: 30 }} 
                    animate={{ opacity: 1, y: 0 }} 
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center text-center max-w-xl bg-black/50 p-16 rounded-[2.5rem] border border-red-500/40 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
                >
                    <motion.div 
                        initial={{ scale: 0, rotate: -45 }} 
                        animate={{ scale: 1, rotate: 0 }} 
                        transition={{ type: "spring", stiffness: 260, damping: 20 }}
                        className="w-28 h-28 bg-red-600 rounded-full flex items-center justify-center mb-10 shadow-[0_0_50px_rgba(220,38,38,0.5)]"
                    >
                        <FiX className="text-white w-16 h-16" strokeWidth={3} />
                    </motion.div>
                    <h2 className="text-4xl font-bold text-white mb-6">Accesso Negato</h2>
                    <p className="text-zinc-300 text-xl mb-10 leading-relaxed max-w-md">
                        Abbiamo rilevato un account <strong>Free</strong>.<br/>Per utilizzare Spotify su questa vettura è necessario un abbonamento <strong>Premium</strong>.
                    </p>
                    <button 
                        onClick={startLoginProcess} 
                        className="flex items-center gap-3 bg-white text-black font-bold py-5 px-12 rounded-full hover:bg-zinc-200 transition-all active:scale-95 shadow-xl"
                    >
                        <FiRefreshCw className="w-5 h-5" /> Riprova con un altro account
                    </button>
                </motion.div>
            )}

            {uiState === 'LOGIN_COMPLETATO' && (
                <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                    <CheckmarkIcon />
                    <h2 className="text-2xl font-bold text-white mt-6">Accesso completato!</h2>
                    <p className="text-zinc-400 mt-2">Configurazione in corso...</p>
                </motion.div>
            )}

            {uiState === 'CARICAMENTO' && (
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-white/10 border-t-[#1DB954] rounded-full animate-spin" />
                    <p className="text-zinc-500 font-medium">Inizializzazione...</p>
                </div>
            )}
            
            {(uiState === 'ERRORE' || uiState === 'SCADUTO') && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center">
                    <p className="text-red-400 text-lg mb-6">Si è verificato un errore durante il login.</p>
                    <button onClick={startLoginProcess} className="px-8 py-3 bg-white/10 text-white rounded-full font-bold hover:bg-white/20 transition-colors">Riprova</button>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
