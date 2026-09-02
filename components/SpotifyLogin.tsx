
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
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [directAuthUrl, setDirectAuthUrl] = useState('');
  const sidRef = useRef<string>(getSessionId());
  const relayIdRef = useRef<string | null>(null);
  const pollTimer = useRef<number | null>(null);

  const startLogin = useCallback(async () => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    clearError();
    
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
    
    const isLocalhost = typeof window !== 'undefined' && (window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1'));
    const backendUrl = isLocalhost 
        ? 'http://localhost:3000' 
        : (import.meta.env.VITE_REDIRECT_URI ? new URL(import.meta.env.VITE_REDIRECT_URI).origin : 'https://drive-os-chi.vercel.app');
        
    const redirectUri = `${backendUrl}/api/spotify-callback`;
    const scope = 'streaming user-read-email user-read-private user-library-read user-read-playback-state user-read-recently-played user-top-read playlist-read-private playlist-read-collaborative user-library-modify user-follow-read user-follow-modify user-modify-playback-state';
    
    // Generate PKCE values
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // 1. Try to register session on backend and obtain cloud relay ID for cross-instance sync
    let relayId = relayIdRef.current;
    try {
      const regRes = await fetch(`${backendUrl}/api/register-auth-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sidRef.current,
          codeVerifier,
          redirectUri
        })
      });
      if (regRes.ok) {
        const regData = await regRes.json();
        if (regData.relayId) {
          relayId = regData.relayId;
          relayIdRef.current = relayId;
        }
      }
    } catch (err) {
      console.warn('[SpotifyLogin] Registration notice:', err);
    }

    // 2. Client-side fallback to create zero-config relay object if backend couldn't create one
    if (!relayId) {
      try {
        const directRelayRes = await fetch('https://api.restful-api.dev/objects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: `driveos_${sidRef.current}`, data: { sessionId: sidRef.current, status: 'pending' } })
        });
        if (directRelayRes.ok) {
          const directRelayData = await directRelayRes.json();
          if (directRelayData.id) {
            relayId = directRelayData.id;
            relayIdRef.current = relayId;
          }
        }
      } catch (relayErr) {}
    }

    const compositeState = encodeCompositeState(sidRef.current, codeVerifier, redirectUri, relayId);
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${encodeURIComponent(compositeState)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256&show_dialog=true`;

    setDirectAuthUrl(authUrl);
    setQrCodeUrl(generateQrUrl(authUrl));
    setUiState('ATTESA');

    // 3. Fast polling loop combining backend endpoint and direct relay fallback
    pollTimer.current = window.setInterval(async () => {
      try {
        const activeRelay = relayIdRef.current || '';
        const pollUrl = `${backendUrl}/api/check-auth-status?sessionId=${encodeURIComponent(sidRef.current)}${activeRelay ? `&relayId=${encodeURIComponent(activeRelay)}` : ''}&_t=${Date.now()}`;
        
        const res = await fetch(pollUrl, { cache: 'no-store' });
        
        if (res.ok) {
          const contentType = res.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const data = await res.json();
            const token = data.access_token || data.tokens?.access_token;
            if (token && (data.authenticated || data.status === 'completed')) {
              if (pollTimer.current) clearInterval(pollTimer.current);
              setUiState('LOADING');
              
              setTimeout(() => {
                login({
                  access_token: token,
                  expires_in: data.expires_in || data.tokens?.expires_in || 3600,
                  expires_at: data.expires_at || data.tokens?.expires_at
                });
              }, 300);
              return;
            }
          }
        }

        // Direct client-side relay check fallback
        if (activeRelay) {
          try {
            const directRelayCheck = await fetch(`https://api.restful-api.dev/objects/${activeRelay}`, { cache: 'no-store' });
            if (directRelayCheck.ok) {
              const rJson = await directRelayCheck.json();
              const rData = rJson.data;
              if (rData && rData.authenticated && rData.access_token) {
                if (pollTimer.current) clearInterval(pollTimer.current);
                setUiState('LOADING');
                
                setTimeout(() => {
                  login({
                    access_token: rData.access_token,
                    expires_in: rData.expires_in || 3600,
                    expires_at: rData.expires_at || (Date.now() + 3600 * 1000)
                  });
                }, 300);
                return;
              }
            }
          } catch (dErr) {}
        }
      } catch (e) {
        // Silently ignore network hiccup during polling
      }
    }, 1100);
  }, [login, clearError]);

  // Instant cross-tab & storage listeners
  useEffect(() => {
    const handleAuthData = (token: string, expiresIn?: number, expiresAt?: number) => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      setUiState('LOADING');
      setTimeout(() => {
        login({
          access_token: token,
          expires_in: expiresIn || 3600,
          expires_at: expiresAt || (Date.now() + 3600 * 1000)
        });
      }, 300);
    };

    // 1. Storage Event listener
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'spotify_access_token' && e.newValue) {
        handleAuthData(e.newValue);
      } else if (e.key === 'spotify_auth_broadcast' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.access_token) {
            handleAuthData(parsed.access_token, parsed.expires_in, parsed.expires_at);
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
          handleAuthData(evt.data.access_token, evt.data.expires_in, evt.data.expires_at);
        }
      };
    } catch(e) {}

    // 3. PostMessage listener
    const onMessage = (evt: MessageEvent) => {
      if (evt.data?.type === 'SPOTIFY_AUTH_SUCCESS' && evt.data?.access_token) {
        handleAuthData(evt.data.access_token, evt.data.expires_in, evt.data.expires_at);
      }
    };
    window.addEventListener('message', onMessage);

    // Check if token already arrived in localStorage
    const existingToken = localStorage.getItem('spotify_access_token');
    const existingExpiry = localStorage.getItem('spotify_token_expiry');
    if (existingToken && existingExpiry && Number(existingExpiry) > Date.now()) {
      handleAuthData(existingToken, 3600, Number(existingExpiry));
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('message', onMessage);
      if (channel) {
        try { channel.close(); } catch(e) {}
      }
    };
  }, [login]);

  useEffect(() => {
    startLogin();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [startLogin]);

  const handleRetry = () => {
    const newSid = generateUUID();
    localStorage.setItem('spotify_session_id', newSid);
    sidRef.current = newSid;
    
    setUiState('IDLE');
    setTimeout(startLogin, 100);
  };

  const theme = {
    card: isNight 
        ? 'bg-[#1C1C1E] border border-white/5 shadow-2xl' 
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
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`flex items-center gap-12 p-12 rounded-[3rem] ${theme.card}`}
          >
            <div className="p-4 bg-white rounded-[1.75rem] shadow-sm border border-zinc-100 overflow-hidden flex-shrink-0">
              {qrCodeUrl ? (
                <img src={qrCodeUrl} alt="QR" className="w-52 h-52 mix-blend-multiply block" />
              ) : (
                <div className="w-52 h-52 flex items-center justify-center">
                  <div className={`w-8 h-8 border-2 rounded-full animate-spin ${theme.spinner}`} />
                </div>
              )}
            </div>
            
            <div className="max-w-xs flex flex-col justify-center gap-4">
              <div className="flex items-center gap-3">
                <FaSpotify className="w-10 h-10 text-[#1DB954]" />
                <h2 className={`text-3xl font-bold tracking-tight ${theme.title}`}>Accedi</h2>
              </div>
              <p className={`text-base leading-snug font-medium ${theme.subtitle}`}>
                Inquadra il codice con lo smartphone per collegare il tuo account <strong>Spotify</strong>.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-2 h-2 rounded-full bg-[#1DB954] animate-ping inline-block" />
                <span className={`text-xs font-semibold ${theme.subtitle}`}>In attesa di scansione...</span>
              </div>
              
              {directAuthUrl && (
                <div className="mt-2 flex flex-col gap-2">
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
            className={`flex flex-col items-center justify-center p-10 rounded-[2.5rem] min-w-[17.5rem] aspect-square ${theme.card}`}
          >
            <FeedbackIcon type="success" isNight={isNight} />
            <div className="flex flex-col items-center gap-3 mt-2">
                <h2 className={`text-xl font-bold tracking-tight ${theme.title}`}>Collegato</h2>
                <div className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 border-[0.15625rem] rounded-full animate-spin ${theme.spinner}`} />
                    <p className={`text-base font-medium ${theme.subtitle}`}>Caricamento...</p>
                </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;
