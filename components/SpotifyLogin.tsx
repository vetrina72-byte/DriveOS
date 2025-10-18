import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

// Funzione helper per generare l'URL del QR code
const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=0-0-0&color=fff&qzone=1`;

// Client-side UUID generation for session tracking
const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.random() * 16 | 0;
  const v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});


function SpotifyLogin() {
  const { login } = useAuth();
  const [uiState, setUiState] = useState('CARICAMENTO...');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // --- EFFETTO #1: CREAZIONE SESSIONE (GIRA UNA SOLA VOLTA) ---
  useEffect(() => {
    console.log('[INIT] Eseguo la creazione della sessione (una sola volta)...');
    
    const newSessionId = generateUUID();
    
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
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scope,
        show_dialog: 'true',
        state: newSessionId
    }).toString();

    console.log(`[INIT] Sessione creata con ID: ${newSessionId}`);
    setSessionId(newSessionId);
    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setUiState('IN ATTESA DI SCANSIONE');
  }, []); // L'array vuoto garantisce che questo venga eseguito UNA SOLA VOLTA.

  // --- EFFETTO #2: POLLING (PARTE SOLO DOPO CHE ABBIAMO UN SESSION ID) ---
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    console.log(`[POLLING] Avvio l'ascolto per la sessione ${sessionId}. Controllo ogni 3 secondi.`);
    
    const intervalId = setInterval(() => {
      console.log(`[POLLING] ...controllo lo stato...`);

      fetch(`/api/check-auth-status?sessionId=${sessionId}`)
        .then(res => {
          if (res.status === 202) {
              // Status is pending, continue polling
              return null;
          }
          if (!res.ok) {
            throw new Error(`Server responded with status ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data && data.code) {
            console.log("🎉🎉🎉 [POLLING] RICEVUTO! Lo stato è COMPLETED! Fermo l'ascolto e avvio il login.");
            clearInterval(intervalId);
            setUiState('LOGIN COMPLETATO');
            login(data.code);
          }
        })
        .catch(error => {
          console.error("[POLLING] Errore durante il controllo dello stato:", error);
          clearInterval(intervalId);
          setUiState('ERRORE DURANTE IL POLLING');
        });
    }, 3000);

    return () => clearInterval(intervalId);
  }, [sessionId, login]);

  // --- RENDER DELLA UI ---
  return (
    <div className="flex flex-col items-center justify-center p-8 text-white">
      <h1 className="text-2xl font-bold mb-4 bg-black/50 px-4 py-2 rounded-lg font-mono">Stato: {uiState}</h1>
      
      {uiState === 'IN ATTESA DI SCANSIONE' && qrCodeUrl && (
        <div className="text-center">
          <p className="mb-4">Scansiona il QR code per accedere a Spotify</p>
          <div className="w-64 h-64 p-4 bg-white rounded-lg shadow-2xl">
              <img src={qrCodeUrl} alt="QR Code per login Spotify" className="w-full h-full object-contain" />
          </div>
        </div>
      )}

      {uiState === 'LOGIN COMPLETATO' && (
         <div className="w-64 h-64 flex flex-col items-center justify-center bg-zinc-800 rounded-lg">
            <div className="w-12 h-12 rounded-full loading-spinner-border mb-4" />
            <p className="text-zinc-300">Accesso Riuscito!</p>
            <p className="text-zinc-300">Autenticazione...</p>
         </div>
      )}

       {(uiState.startsWith('ERRORE') || uiState === 'CARICAMENTO...') && (
         <div className="w-64 h-64 flex items-center justify-center bg-zinc-800 rounded-lg">
            <div className="w-10 h-10 rounded-full loading-spinner-border" />
        </div>
      )}
    </div>
  );
}

export default SpotifyLogin;
