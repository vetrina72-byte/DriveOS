import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessionId } from '../lib/sessionId';
import { FiXCircle } from 'react-icons/fi';

// Funzione helper per generare l'URL del QR code
const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

const CheckmarkIcon = () => (
    <motion.svg
        className="w-24 h-24"
        viewBox="0 0 50 50"
        initial="hidden"
        animate="visible"
    >
        <motion.circle
            cx="25"
            cy="25"
            r="24"
            stroke="#1DB954"
            strokeWidth="2"
            fill="none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, transition: { duration: 0.5, ease: "easeOut" } }}
        />
        <motion.path
            d="M14 27 L 22 35 L 37 20"
            fill="transparent"
            strokeWidth="3"
            stroke="#1DB954"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1, transition: { duration: 0.4, ease: "easeInOut", delay: 0.3 } }}
        />
    </motion.svg>
);


function SpotifyLogin() {
  const { login } = useAuth();
  const [uiState, setUiState] = useState<'CARICAMENTO' | 'ATTESA_SCANSIONE' | 'LOGIN_COMPLETATO' | 'ERRORE' | 'SCADUTO' | 'PREMIUM_RICHIESTO'>('CARICAMENTO');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionId] = useState<string>(getSessionId());
  const pollIntervalRef = useRef<number | null>(null);

  const startLoginProcess = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
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
        scope: scope, show_dialog: 'true', state: sessionId
    }).toString();

    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setUiState('ATTESA_SCANSIONE');
  }, [sessionId]);
  
  const startPolling = useCallback((delay: number) => {
    if (!sessionId) return;
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);

    pollIntervalRef.current = window.setInterval(() => {
      fetch(`/api/check-auth-status?sessionId=${sessionId}`)
        .then(res => {
          if (!res.ok) throw new Error(`Server responded with status ${res.status}`);
          return res.json();
        })
        .then(data => {
          if (data && data.authenticated && data.access_token) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('LOGIN_COMPLETATO');
            const tokenData = {
                access_token: data.access_token,
                expires_in: data.expires_at ? (data.expires_at - Date.now()) / 1000 : 3600,
                expires_at: data.expires_at,
            };
            setTimeout(() => login(tokenData), 1500);
          } else if (data && data.error === 'premium_required') {
            console.warn('[POLLING] Premium required error received.');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('PREMIUM_RICHIESTO');
          } else if (data && data.expired === true) {
            console.warn('[POLLING] Session expired (invalid_grant). Regenerating QR code.');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('SCADUTO');
            setTimeout(() => {
              startLoginProcess();
            }, 2500);
          } else if (data && data.error === 'redis_unreachable') {
              console.warn('[POLLING] Redis not reachable, retrying in 5s.');
              startPolling(5000);
          }
        })
        .catch(error => {
          console.error("[POLLING] Error checking auth status:", error);
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setUiState('ERRORE');
        });
    }, delay);
  }, [sessionId, login, startLoginProcess]);

  useEffect(() => {
    startLoginProcess();
    // This effect should only run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (uiState === 'ATTESA_SCANSIONE' && sessionId) {
      startPolling(3000);
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [uiState, sessionId, startPolling]);

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-[var(--spotify-panel-bg)]">
        <AnimatePresence mode="wait">
            {uiState === 'ATTESA_SCANSIONE' && (
                <motion.div
                    key="qr-view"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center gap-12 bg-neutral-900 p-12 rounded-2xl shadow-2xl border border-white/10"
                >
                    <div className="flex-shrink-0 w-64 h-64 p-4 bg-white rounded-lg shadow-lg">
                        <img src={qrCodeUrl} alt="QR Code per login Spotify" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-left">
                        <FaSpotify className="w-12 h-12 text-white mb-6" />
                        <h1 className="text-3xl font-bold text-white mb-2">Accedi al tuo account Spotify</h1>
                        <p className="text-zinc-400 text-lg">Scansiona il codice QR con il tuo telefono per iniziare.</p>
                    </div>
                </motion.div>
            )}

            {uiState === 'PREMIUM_RICHIESTO' && (
                <motion.div
                    key="premium-error-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center text-center max-w-lg bg-neutral-900 p-12 rounded-2xl shadow-2xl border border-red-500/30"
                >
                    <div className="mb-6">
                        <FiXCircle className="w-24 h-24 text-red-500" />
                    </div>
                    <h2 className="text-3xl font-bold text-white">Accesso negato</h2>
                    <p className="text-zinc-400 text-lg mt-4">
                        Impossibile accedere perché non disponi di un account Spotify Premium.
                    </p>
                    <button
                        onClick={startLoginProcess}
                        className="mt-8 px-8 py-3 bg-[#1DB954] hover:bg-[#1AA34A] text-white font-bold rounded-full text-lg transition-all transform hover:scale-105"
                    >
                        Riprova
                    </button>
                </motion.div>
            )}

            {uiState === 'LOGIN_COMPLETATO' && (
                <motion.div
                    key="success-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center justify-center text-center"
                >
                    <CheckmarkIcon />
                    <h2 className="text-2xl font-bold text-white mt-6">Accesso completato!</h2>
                    <p className="text-zinc-400 mt-1">Stiamo caricando la tua musica...</p>
                </motion.div>
            )}

            {(uiState === 'CARICAMENTO' || uiState === 'ERRORE' || uiState === 'SCADUTO') && (
                <motion.div
                    key="loader-error-view"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center text-center"
                >
                    {uiState === 'CARICAMENTO' && (
                        <div className="w-12 h-12 spotify-spinner" />
                    )}
                     {uiState === 'SCADUTO' && (
                        <>
                            <p className="text-yellow-400 text-lg">QR Code scaduto.</p>
                            <p className="text-zinc-400 mt-1">Sto generando un nuovo codice...</p>
                        </>
                    )}
                    {uiState === 'ERRORE' && (
                        <>
                            <p className="text-red-400 text-lg">Si è verificato un errore.</p>
                            <p className="text-zinc-400 mt-1">Controlla la connessione e riprova.</p>
                            <button
                                onClick={startLoginProcess}
                                className="mt-8 px-8 py-3 bg-zinc-700 hover:bg-zinc-600 text-white font-bold rounded-full transition-all"
                            >
                                Riprova
                            </button>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;