import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessionId, generateUUID } from '../lib/sessionId';
import { FiXCircle } from 'react-icons/fi';

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

function SpotifyLogin() {
  const { login, error: authError, clearError } = useAuth();
  const [uiState, setUiState] = useState<'CARICAMENTO' | 'ATTESA_SCANSIONE' | 'LOGIN_COMPLETATO' | 'ERRORE' | 'SCADUTO' | 'PREMIUM_RICHIESTO'>('CARICAMENTO');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionId, setSessionId] = useState<string>(getSessionId());
  const pollIntervalRef = useRef<number | null>(null);

  const startLoginProcess = useCallback((forceNewSession = false) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    // Pulizia errori precedenti
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
            console.warn('[POLLING] Rilevato errore Premium Required.');
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('PREMIUM_RICHIESTO');
          } else if (data && data.expired) {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setUiState('SCADUTO');
            setTimeout(() => startLoginProcess(true), 2500);
          }
        })
        .catch((err) => {
          console.error('[POLLING] Errore durante il controllo stato:', err);
        });
    }, delay);
  }, [sessionId, login, startLoginProcess]);

  // Sincronizza lo stato interno con eventuali errori globali di AuthContext
  useEffect(() => {
      if (authError === 'Premium required') {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          setUiState('PREMIUM_RICHIESTO');
      }
  }, [authError]);

  useEffect(() => {
    if (authError === 'Premium required') {
        setUiState('PREMIUM_RICHIESTO');
    } else {
        startLoginProcess();
    }
    return () => { if (pollIntervalRef.current) clearInterval(pollIntervalRef.current); };
  }, [startLoginProcess, authError]);

  useEffect(() => {
    if (uiState === 'ATTESA_SCANSIONE' && sessionId) {
      startPolling(3000);
    }
  }, [uiState, sessionId, startPolling]);

  return (
    <div className="w-full h-full flex items-center justify-center p-8 bg-[var(--spotify-panel-bg)]">
        <AnimatePresence mode="wait">
            {uiState === 'ATTESA_SCANSIONE' && (
                <motion.div key="qr-view" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-12 bg-neutral-900 p-12 rounded-2xl shadow-2xl border border-white/10"
                >
                    <div className="flex-shrink-0 w-64 h-64 p-4 bg-white rounded-lg">
                        <img src={qrCodeUrl} alt="Spotify QR" className="w-full h-full object-contain" />
                    </div>
                    <div className="text-left max-w-sm">
                        <FaSpotify className="w-12 h-12 text-[#1DB954] mb-6" />
                        <h1 className="text-3xl font-bold text-white mb-2">Accedi a Spotify</h1>
                        <p className="text-zinc-400 text-lg">Inquadra il codice con il tuo telefono per collegare il tuo account Premium.</p>
                    </div>
                </motion.div>
            )}

            {uiState === 'PREMIUM_RICHIESTO' && (
                <motion.div key="premium-error" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    className="flex flex-col items-center justify-center text-center max-w-lg bg-neutral-900 p-12 rounded-2xl shadow-2xl border border-red-500/30"
                >
                    <FiXCircle className="w-24 h-24 text-red-500 mb-6" />
                    <h2 className="text-3xl font-bold text-white">Accesso negato</h2>
                    <p className="text-zinc-400 text-lg mt-4">Impossibile accedere perché non disponi di un account Spotify Premium.</p>
                    <button onClick={() => startLoginProcess(true)} className="mt-8 px-10 py-3 bg-[#1DB954] hover:bg-[#1AA34A] text-white font-bold rounded-full text-lg transition-all transform hover:scale-105 shadow-lg">
                        Riprova
                    </button>
                </motion.div>
            )}

            {uiState === 'LOGIN_COMPLETATO' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center text-center">
                    <CheckmarkIcon />
                    <h2 className="text-2xl font-bold text-white mt-6">Accesso completato!</h2>
                    <p className="text-zinc-400 mt-1">Caricamento libreria in corso...</p>
                </motion.div>
            )}

            {(uiState === 'CARICAMENTO' || uiState === 'ERRORE' || uiState === 'SCADUTO') && (
                <motion.div key="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center">
                    {uiState === 'CARICAMENTO' && <div className="w-12 h-12 spotify-spinner" />}
                    {uiState === 'SCADUTO' && <p className="text-yellow-400 text-lg">QR Code scaduto. Rigenerazione...</p>}
                    {uiState === 'ERRORE' && (
                        <>
                            <p className="text-red-400 text-lg">Errore di connessione.</p>
                            <button onClick={() => startLoginProcess()} className="mt-4 px-6 py-2 bg-zinc-700 text-white rounded-full">Riprova</button>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;