import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { getSessionId, generateUUID } from '../lib/sessionId';
import { FiAlertCircle, FiActivity } from 'react-icons/fi';

const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=ffffff&color=000000&qzone=1`;

function SpotifyLogin({ isNight = true }: { isNight?: boolean }) {
  const { login, error: authError, clearError } = useAuth();
  const [uiState, setUiState] = useState<'IDLE' | 'ATTESA' | 'PREMIUM_ERROR' | 'LOADING'>('IDLE');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [activeSid, setActiveSid] = useState<string>('');
  const pollTimer = useRef<number | null>(null);

  const startLogin = useCallback(() => {
    if (pollTimer.current) clearInterval(pollTimer.current);
    clearError();
    
    // Recupera o genera un ID che persista nel localStorage dell'auto
    const sid = getSessionId(); 
    setActiveSid(sid);

    const clientId = 'ecc9e126d442404b92e8081c7d95ecca';
    const redirectUri = window.location.origin + '/api/spotify-callback'; // Dinamico per evitare mismatch tra deploy
    const scope = 'streaming user-read-email user-read-private user-library-read user-read-playback-state user-modify-playback-state';
    
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${sid}&show_dialog=true`;

    setQrCodeUrl(generateQrUrl(authUrl));
    setUiState('ATTESA');

    // Polling aggressivo: 2 secondi
    pollTimer.current = window.setInterval(async () => {
      try {
        const res = await fetch(`/api/check-auth-status?sessionId=${sid}`);
        if (!res.ok) return;
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
          clearInterval(pollTimer.current!);
          setUiState('PREMIUM_ERROR');
        }
      } catch (e) {
          // Fail silenzioso durante il polling
      }
    }, 2000);
  }, [login, clearError]);

  useEffect(() => {
    startLogin();
    return () => { if (pollTimer.current) clearInterval(pollTimer.current); };
  }, [startLogin]);

  const theme = {
    card: isNight ? 'bg-zinc-900/90 border-white/10' : 'bg-white/95 border-black/10',
    text: isNight ? 'text-white' : 'text-zinc-900',
    sub: isNight ? 'text-zinc-400' : 'text-zinc-500'
  };

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-6 bg-black/20">
      <AnimatePresence mode="wait">
        {uiState === 'ATTESA' && (
          <motion.div 
            key="qr"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className={`flex items-center gap-16 p-14 rounded-[48px] border backdrop-blur-3xl shadow-2xl ${theme.card}`}
          >
            <div className="bg-white p-6 rounded-[32px] shadow-inner">
              <img src={qrCodeUrl} alt="QR" className="w-64 h-64" />
            </div>
            <div className="max-w-xs">
              <FaSpotify className="w-16 h-16 text-[#1DB954] mb-8" />
              <h2 className={`text-4xl font-black mb-4 tracking-tight ${theme.text}`}>Collega Account</h2>
              <p className={`text-xl leading-relaxed ${theme.sub}`}>Scansiona per sbloccare i contenuti <b>Spotify Premium</b> su questa auto.</p>
              <div className="mt-8 flex items-center gap-2 opacity-30 text-[10px] font-mono uppercase tracking-tighter text-zinc-400">
                <FiActivity /> Session: {activeSid.substring(0, 8)}...
              </div>
            </div>
          </motion.div>
        )}

        {uiState === 'PREMIUM_ERROR' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
            className={`flex flex-col items-center text-center p-16 rounded-[48px] border backdrop-blur-3xl shadow-2xl max-w-lg ${theme.card}`}
          >
            <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border border-red-500/20">
              <FiAlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className={`text-4xl font-black mb-4 ${theme.text}`}>Accesso Negato</h2>
            <p className={`text-xl mb-10 leading-relaxed ${theme.sub}`}>Spotify Premium è richiesto per l'integrazione DriveOS. L'account utilizzato non risulta idoneo.</p>
            <button 
              onClick={() => { localStorage.removeItem('spotify_session_id'); startLogin(); }}
              className="px-12 py-5 bg-[#1DB954] text-white rounded-full font-black text-xl hover:scale-105 active:scale-95 transition-all shadow-xl"
            >
              Usa un altro account
            </button>
          </motion.div>
        )}

        {uiState === 'LOADING' && (
          <motion.div key="load" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-green-500/20 border-t-green-500 rounded-full animate-spin mb-6" />
            <p className={`text-2xl font-bold ${theme.text}`}>Sincronizzazione in corso...</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SpotifyLogin;