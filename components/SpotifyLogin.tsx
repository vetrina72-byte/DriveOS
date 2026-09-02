
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { generateUUID, getSessionId } from '../lib/sessionId';
import { FiRefreshCw } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=4`;

function generateCodeVerifier(length = 64): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    const bytes = new Uint8Array(digest);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  } catch (e) {
    // Fallback in environments where subtle crypto might be restricted
    return verifier;
  }
}

interface SpotifyLoginProps {
    isNight?: boolean;
}

// Icon component: High quality, fluid drawing animations
const FeedbackIcon = ({ type, isNight }: { type: 'success' | 'error', isNight: boolean }) => {
    const isSuccess = type === 'success';
    const successColor = isNight ? '#32D74B' : '#34C759';
    const errorColor = isNight ? '#FF453A' : '#FF3B30';
    const color = isSuccess ? successColor : errorColor;
    
    return (
        <div className={`flex items-center justify-center mb-6 relative`}>
            <motion.svg 
                width="64" height="64" viewBox="0 0 52 52" fill="none" 
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
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

function encodeCompositeState(sessionId: string, codeVerifier: string, redirectUri: string, relayId?: string | null): string {
  try {
    const payload = JSON.stringify({ s: sessionId, v: codeVerifier, r: redirectUri, k: relayId || undefined });
    return encodeURIComponent(payload);
  } catch (e) {
    return sessionId;
  }
}

function SpotifyLogin({ isNight = true }: SpotifyLoginProps) {
  const { login, clearError } = useAuth();
  const [uiState, setUiState] = useState<'IDLE' | 'ATTESA' | 'PREMIUM_ERROR' | 'LOADING' | 'ERRORE_RETE'>('IDLE');
  const [scanDetected, setScanDetected] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [directAuthUrl, setDirectAuthUrl] = useState('');
  const sidRef = useRef<string>(getSessionId());
  const relayIdRef = useRef<string | null>(null);
  const pollTimer = useRef<number | null>(null);
  const isResolvedRef = useRef<boolean>(false);

  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  const handleSuccessfulAuth = useCallback((token: string, expiresIn?: number, expiresAt?: number, refreshToken?: string) => {
    if (isResolvedRef.current) return;
    isResolvedRef.current = true;
    stopPolling();

    setUiState('LOADING');

    const expAt = expiresAt || (Date.now() + (expiresIn || 3600) * 1000);
    try {
      localStorage.setItem('spotify_access_token', token);
      localStorage.setItem('spotify_token_expiry', String(expAt));
      if (refreshToken) localStorage.setItem('spotify_refresh_token', refreshToken);
      localStorage.setItem('spotify_auth_broadcast', JSON.stringify({ access_token: token, expires_in: expiresIn || 3600, expires_at: expAt }));
    } catch (e) {}

    // Instantly transition to authenticated dashboard
    login({
      access_token: token,
      expires_in: expiresIn || 3600,
      expires_at: expAt,
      refresh_token: refreshToken
    });
  }, [login, stopPolling]);

  const startLogin = useCallback(async () => {
    stopPolling();
    isResolvedRef.current = false;
    setScanDetected(false);
    clearError();
    
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
    
    const currentOrigin = typeof window !== 'undefined' ? window.location.origin : '';
    const isLocalhost = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');
    const configuredBackend = import.meta.env.VITE_REDIRECT_URI ? new URL(import.meta.env.VITE_REDIRECT_URI).origin : '';
    const backendUrl = isLocalhost ? 'http://localhost:3000' : (configuredBackend || currentOrigin || 'https://drive-os-chi.vercel.app');
        
    const redirectUri = import.meta.env.VITE_REDIRECT_URI || `${backendUrl}/api/spotify-callback`;
    const scope = 'streaming user-read-email user-read-private user-library-read user-read-playback-state user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative user-library-modify user-follow-read user-follow-modify user-modify-playback-state';
    
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // 1. Try to register session on backend and obtain cloud relay ID for cross-instance sync
    let relayId = relayIdRef.current;
    try {
      // Register on local endpoint first
      const regRes = await fetch('/api/register-auth-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sidRef.current,
          codeVerifier,
          redirectUri
        })
      }).catch(() => null);

      if (regRes && regRes.ok) {
        const regData = await regRes.json();
        if (regData.relayId) {
          relayId = regData.relayId;
          relayIdRef.current = relayId;
        }
      }

      // If backendUrl differs and we still don't have relayId, try backendUrl
      if (!relayId && backendUrl && backendUrl !== currentOrigin) {
        const remoteRegRes = await fetch(`${backendUrl}/api/register-auth-session`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: sidRef.current,
            codeVerifier,
            redirectUri
          })
        }).catch(() => null);

        if (remoteRegRes && remoteRegRes.ok) {
          const remoteData = await remoteRegRes.json();
          if (remoteData.relayId) {
            relayId = remoteData.relayId;
            relayIdRef.current = relayId;
          }
        }
      }
    } catch (err) {
      console.warn('[SpotifyLogin] Registration notice:', err);
    }

    // 2. Client-side fallback to create zero-config relay object if backend couldn't create one (using internal relay if needed)
    if (!relayId) {
      relayId = sidRef.current;
    }

    const compositeState = encodeCompositeState(sidRef.current, codeVerifier, redirectUri, relayId);
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(compositeState)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&show_dialog=true`;

    setDirectAuthUrl(authUrl);
    setQrCodeUrl(generateQrUrl(authUrl));
    setUiState('ATTESA');

    // 3. Ultra-responsive polling loop combining local relative endpoint and backend endpoint
    pollTimer.current = window.setInterval(async () => {
      if (isResolvedRef.current) {
        stopPolling();
        return;
      }

      const activeRelay = relayIdRef.current || '';
      const sid = sidRef.current;
      const queryStr = `sessionId=${encodeURIComponent(sid)}${activeRelay ? `&relayId=${encodeURIComponent(activeRelay)}` : ''}&_t=${Date.now()}`;

      // A. Check local/relative API endpoint
      try {
        const res = await fetch(`/api/check-auth-status?${queryStr}`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data?.status === 'scanned' || data?.authorizing) {
            setScanDetected(true);
          }
          const token = data?.access_token || data?.tokens?.access_token;
          if (token && (data.authenticated || data.status === 'completed')) {
            handleSuccessfulAuth(
              token, 
              data.expires_in || data.tokens?.expires_in, 
              data.expires_at || data.tokens?.expires_at,
              data.refresh_token || data.tokens?.refresh_token
            );
            return;
          }
        }
      } catch (e) {}

      // B. If remote backend is configured and different from local, check remote backend
      if (backendUrl && backendUrl !== currentOrigin) {
        try {
          const remoteRes = await fetch(`${backendUrl}/api/check-auth-status?${queryStr}`, { cache: 'no-store' });
          if (remoteRes.ok) {
            const data = await remoteRes.json().catch(() => null);
            if (data?.status === 'scanned' || data?.authorizing) {
              setScanDetected(true);
            }
            const token = data?.access_token || data?.tokens?.access_token;
            if (token && (data.authenticated || data.status === 'completed')) {
              handleSuccessfulAuth(
                token, 
                data.expires_in || data.tokens?.expires_in, 
                data.expires_at || data.tokens?.expires_at,
                data.refresh_token || data.tokens?.refresh_token
              );
              return;
            }
          }
        } catch (e) {}
      }
    }, 1000);
  }, [clearError, handleSuccessfulAuth, stopPolling]);

  // Instant cross-tab & storage listeners
  useEffect(() => {
    // 1. Storage Event listener
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'spotify_access_token' && e.newValue) {
        handleSuccessfulAuth(e.newValue);
      } else if (e.key === 'spotify_auth_broadcast' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.access_token) {
            handleSuccessfulAuth(parsed.access_token, parsed.expires_in, parsed.expires_at, parsed.refresh_token);
          }
        } catch (err) {}
      }
    };
    window.addEventListener('storage', onStorage);

    // 2. BroadcastChannel listener
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('driveos_spotify_auth');
      channel.onmessage = (evt) => {
        if (evt.data?.type === 'AUTH_SUCCESS' && evt.data?.access_token) {
          handleSuccessfulAuth(evt.data.access_token, evt.data.expires_in, evt.data.expires_at, evt.data.refresh_token);
        }
      };
    } catch(e) {}

    // 3. PostMessage listener
    const onMessage = (evt: MessageEvent) => {
      if (evt.data?.type === 'SPOTIFY_AUTH_SUCCESS' && evt.data?.access_token) {
        handleSuccessfulAuth(evt.data.access_token, evt.data.expires_in, evt.data.expires_at, evt.data.refresh_token);
      }
    };
    window.addEventListener('message', onMessage);

    // Check if token already arrived in localStorage
    const existingToken = localStorage.getItem('spotify_access_token');
    const existingExpiry = localStorage.getItem('spotify_token_expiry');
    if (existingToken && existingExpiry && Number(existingExpiry) > Date.now()) {
      handleSuccessfulAuth(existingToken, 3600, Number(existingExpiry));
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
      if (channel) {
        try { channel.close(); } catch(e) {}
      }
    };
  }, [handleSuccessfulAuth]);

  useEffect(() => {
    startLogin();
    return () => { stopPolling(); };
  }, [startLogin, stopPolling]);

  const handleRetry = () => {
    const newSid = generateUUID();
    localStorage.setItem('spotify_session_id', newSid);
    sidRef.current = newSid;
    relayIdRef.current = null;
    isResolvedRef.current = false;
    
    setUiState('IDLE');
    setTimeout(startLogin, 100);
  };

  const theme = {
    card: isNight 
        ? 'bg-[#1C1C1E] border border-white/10 shadow-2xl' 
        : 'bg-white border border-black/5 shadow-[0_12px_40px_rgba(0,0,0,0.12)]', 
    
    title: isNight ? 'text-white' : 'text-black',
    subtitle: isNight ? 'text-[#AEAEB2]' : 'text-[#636366]',
    
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
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-center gap-10 p-10 md:p-12 rounded-[2.5rem] ${theme.card} max-w-2xl w-full`}
          >
            <div className="p-4 bg-white rounded-[1.75rem] shadow-sm border border-zinc-100 overflow-hidden flex-shrink-0">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR Spotify" className="w-48 h-48 md:w-52 md:h-52 mix-blend-multiply block" />
              ) : (
                <div className="w-48 h-48 md:w-52 md:h-52 flex items-center justify-center">
                  <div className={`w-8 h-8 border-2 rounded-full animate-spin ${theme.spinner}`} />
                </div>
              )}
            </div>
            
            <div className="flex-grow flex flex-col justify-center gap-4">
              <div className="flex items-center gap-3">
                <FaSpotify className="w-10 h-10 text-[#1DB954]" />
                <h2 className={`text-2xl md:text-3xl font-bold tracking-tight ${theme.title}`}>Connetti Spotify</h2>
              </div>
              
              <p className={`text-sm md:text-base leading-snug font-medium ${theme.subtitle}`}>
                Inquadra il codice con la fotocamera del tuo smartphone per collegare il tuo account.
              </p>

              {/* Enhanced status indicator */}
              {scanDetected ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#1DB954]/15 border border-[#1DB954]/30 w-fit"
                >
                  <div className="w-3.5 h-3.5 border-2 border-[#1DB954] border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  <span className="text-xs font-bold text-[#1DB954]">Codice scansionato! Accesso in corso...</span>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-white/5 border border-white/10 w-fit">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#1DB954] shadow-[0_0_8px_#1DB954] animate-pulse" />
                  <span className={`text-xs font-semibold ${theme.subtitle}`}>In attesa di scansione...</span>
                </div>
              )}
              
              {directAuthUrl && (
                <div className="mt-1 flex flex-col gap-2">
                  <a
                    href={directAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-[#1DB954]/10 hover:bg-[#1DB954]/20 text-[#1DB954] text-xs font-bold transition-all border border-[#1DB954]/30"
                  >
                    <FaSpotify className="w-3.5 h-3.5" />
                    Accedi su questo schermo
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {uiState === 'PREMIUM_ERROR' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-col items-center text-center px-12 py-10 rounded-[2rem] max-w-[35rem] w-full ${theme.card}`}
          >
            <FeedbackIcon type="error" isNight={isNight} />
            <h2 className={`text-2xl font-bold mb-2 tracking-tight ${theme.title}`}>Richiesto Premium</h2>
            <p className={`text-lg mb-6 leading-relaxed font-medium px-4 ${theme.subtitle}`}>
              È necessario un abbonamento Spotify attivo per utilizzare questa integrazione.
            </p>
            <button 
              onClick={handleRetry}
              className={`flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold text-base transition-transform active:scale-95 w-2/3 ${theme.buttonPrimary}`}
            >
              <FiRefreshCw className="w-5 h-5" />
              Riprova
            </button>
          </motion.div>
        )}

        {uiState === 'ERRORE_RETE' && (
          <motion.div 
            key="network_error"
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-col items-center text-center px-12 py-10 rounded-[2rem] max-w-[35rem] w-full ${theme.card}`}
          >
            <FeedbackIcon type="error" isNight={isNight} />
            <h2 className={`text-2xl font-bold mb-2 tracking-tight ${theme.title}`}>Errore di Connessione</h2>
            <p className={`text-lg mb-6 leading-relaxed font-medium px-4 ${theme.subtitle}`}>
              Impossibile verificare lo stato dell'accesso (timeout o errore server).
            </p>
            <button 
              onClick={handleRetry}
              className={`flex items-center justify-center gap-2 px-8 py-3 rounded-full font-bold text-base transition-transform active:scale-95 w-2/3 ${theme.buttonPrimary}`}
            >
              <FiRefreshCw className="w-5 h-5" />
              Riprova
            </button>
          </motion.div>
        )}

        {uiState === 'LOADING' && (
          <motion.div 
            key="load" 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={`flex flex-col items-center justify-center p-12 rounded-[2.5rem] max-w-md w-full text-center ${theme.card}`}
          >
            <div className="relative mb-6">
              <div className="w-16 h-16 rounded-full bg-[#1DB954]/20 flex items-center justify-center animate-pulse">
                <FaSpotify className="w-10 h-10 text-[#1DB954]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#1DB954] flex items-center justify-center shadow-md">
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            </div>

            <h2 className={`text-xl md:text-2xl font-bold tracking-tight mb-2 ${theme.title}`}>
              Sincronizzazione account in corso...
            </h2>
            <p className={`text-sm md:text-base font-medium ${theme.subtitle} max-w-xs`}>
              Accesso completato dallo smartphone. Caricamento del tuo profilo Spotify...
            </p>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
