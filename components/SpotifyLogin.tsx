
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
  const [sessionId, setSessionId] = useState<string>(getSessionId());
  const pollIntervalRef = useRef<number | null>(null);

  const startLoginProcess = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    setUiState('CARICAMENTO');
    
    // Rigenera sessione per pulire errori precedenti
    const newSid = 'sid_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('spotify_session_id', newSid);
    setSessionId(newSid);
    
    const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
    const redirectUri = process.env.VITE_REDIRECT_URI;
    const scope = ['streaming', 'user-read-email', 'user-read-private', 'user-library-read', 'user-read-playback-state', 'user-modify-playback-state'].join(' ');
    
    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.search = new URLSearchParams({
        client_id: clientId, response_type: 'code', redirect_uri: redirectUri,
        scope: scope, show_dialog: 'true', state: newSid
    }).toString();

    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setUiState('ATTESA_SCANSIONE');
  }, []);
  
  const startPolling = useCallback((sid: string) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = window.setInterval(() => {
      fetch(`/api/check-auth-status?sessionId=${sid}`)
        .then(res => res.json())
        .then(data => {
          if (data?.authenticated && data?.access_token) {
            clearInterval(pollIntervalRef.current!);
            setUiState('LOGIN_COMPLETATO');
            setTimeout(() => login({
                access_token: data.access_token,
                expires_in: (data.expires_at - Date.now()) / 1000,
                expires_at: data.expires_at,
            }), 1500);
          } else if (data?.error === 'premium_required') {
            clearInterval(pollIntervalRef.current!);
            setUiState('PREMIUM_RICHIESTO');
          } else if (data?.expired) {
            clearInterval(pollIntervalRef.current!);
            setUiState('SCADUTO');
            setTimeout(startLoginProcess, 2000);
          }
        })
        .catch(() => {});
    }, 3000);
  }, [login, startLoginProcess]);

  useEffect(() => {
    startLoginProcess();
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [startLoginProcess]);

  useEffect(() => {
    if (uiState === 'ATTESA_SCANSIONE' && sessionId) {
      startPolling(sessionId);
    }
  }, [uiState, sessionId, startPolling]);

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-[var(--spotify-panel-bg)]">
        <AnimatePresence mode="wait">
            {uiState === 'ATTESA_SCANSIONE' && (
                <motion.div key="qr" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="flex items-center gap-12 bg-neutral-900 p-12 rounded-2xl border border-white/10 shadow-2xl">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-64 h-64 p-4 bg-white rounded-lg shadow-lg">
                            <img src={qrCodeUrl} alt="QR Code" className="w-full h-full object-contain" />
                        </div>
                        <p className="text-red-500 text-[10px] font-black uppercase tracking-[0.2em] animate-pulse">Premium Mandatory</p>
                    </div>
                    <div className="text-left max-w-md">
                        <FaSpotify className="w-12 h-12 text-[#1DB954] mb-6" />
                        <h1 className="text-3xl font-bold text-white mb-2">Connetti Spotify</h1>
                        <p className="text-zinc-400 text-lg mb-6">Scansiona il codice QR con il tuo smartphone.</p>
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl">
                            <p className="text-zinc-300 text-sm flex items-start gap-3">
                                <FiAlertCircle className="mt-1 flex-shrink-0 text-blue-400" />
                                <span>L'integrazione richiede un account <strong>Spotify Premium</strong>. Gli account Free non sono supportati per la riproduzione remota.</span>
                            </p>
                        </div>
                    </div>
                </motion.div>
            )}

            {uiState === 'PREMIUM_RICHIESTO' && (
                <motion.div key="denied" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center justify-center text-center max-w-lg bg-black/40 p-12 rounded-3xl border border-red-500/30 backdrop-blur-xl">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center mb-8 shadow-[0_0_40px_rgba(220,38,38,0.4)]">
                        <FiX className="text-white w-14 h-14" strokeWidth={3} />
                    </motion.div>
                    <h2 className="text-3xl font-bold text-white mb-4">Accesso Negato</h2>
                    <p className="text-zinc-400 text-lg mb-8 leading-relaxed">
                        L'account utilizzato non dispone di un abbonamento <strong>Premium</strong>.<br/>Per utilizzare Spotify su Drive OS è necessario un piano a pagamento.
                    </p>
                    <button onClick={startLoginProcess} className="flex items-center gap-3 bg-white text-black font-bold py-4 px-10 rounded-full hover:bg-zinc-200 transition-all active:scale-95">
                        <FiRefreshCw /> Riprova con un altro account
                    </button>
                </motion.div>
            )}

            {uiState === 'LOGIN_COMPLETATO' && (
                <motion.div key="success" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
                    <CheckmarkIcon />
                    <h2 className="text-2xl font-bold text-white mt-6">Benvenuto!</h2>
                    <p className="text-zinc-400 mt-2">Configurazione in corso...</p>
                </motion.div>
            )}

            {uiState === 'CARICAMENTO' && (
                <div className="w-12 h-12 border-4 border-white/10 border-t-[#1DB954] rounded-full animate-spin" />
            )}
        </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
