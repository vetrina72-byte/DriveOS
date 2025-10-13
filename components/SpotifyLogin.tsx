import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { FaSpotify } from 'react-icons/fa';

// Client-side UUID generation
const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
  return v.toString(16);
});

// Generate QR URL
const generateQrUrl = (authUrl: string) => `https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(authUrl)}&bgcolor=0-0-0&color=fff&qzone=1`;

function SpotifyLogin() {
  const { login, isLoading, error } = useAuth();
  // Using user's state for visual feedback
  const [loginStatus, setLoginStatus] = useState('INIZIALIZZAZIONE');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  
  // Use useRef to keep sessionId stable across re-renders, as requested
  const sessionIdRef = useRef<string | null>(null);

  // This useEffect runs only once to set up the session
  useEffect(() => {
    console.log("✅ [SENSORE 1] Eseguo l'effetto di inizializzazione (Questo deve apparire UNA SOLA VOLTA!)");

    if (sessionIdRef.current) {
      console.warn("⚠️ Rilevata esecuzione multipla dell'effetto. Blocco per evitare loop.");
      return;
    }

    setLoginStatus('CREAZIONE SESSIONE...');
    
    // Generate session ID and auth URL client-side (no /session/new call)
    const sessionId = generateUUID();
    sessionIdRef.current = sessionId; // Store stable ID

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
        state: sessionId // Pass session ID in state
    }).toString();

    console.log(`✅ [SENSORE 2] Sessione creata con ID STABILE: ${sessionId}`);
    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setLoginStatus('IN ATTESA DI SCANSIONE QR...');

  }, []); // Empty array ensures this runs once

  // This useEffect handles polling, adapted to the existing backend
  useEffect(() => {
    if (!sessionIdRef.current || loginStatus !== 'IN ATTESA DI SCANSIONE QR...') {
      return;
    }

    console.log(`➡️ [SENSORE 3] Avvio del polling per la sessione: ${sessionIdRef.current}`);

    const intervalId = setInterval(() => {
      console.log(`[POLLING CHECK] Controllo lo stato della sessione ${sessionIdRef.current}...`);
      
      // Use the existing endpoint
      fetch(`/api/check-auth-status?sessionId=${sessionIdRef.current}`)
        .then(res => {
          if (res.status === 200) {
            return res.json(); // Code found
          }
          if (res.status === 202) {
            return null; // Pending, continue polling
          }
          throw new Error(`Il polling è fallito con stato ${res.status}`); // Other error
        })
        .then(data => {
          if (data && data.code) {
            console.log("🎉🎉🎉 SUCCESSO! Il server ha confermato il login! 🎉🎉🎉");
            setLoginStatus('LOGIN COMPLETATO CON SUCCESSO!');
            clearInterval(intervalId); // Stop polling
            login(data.code); // Perform the final login step
          }
          // if data is null (status 202), do nothing and continue polling
        })
        .catch(error => {
          console.error("❌ [ERRORE 3D] Errore durante il polling:", error);
          setLoginStatus(`ERRORE DI POLLING: ${error.message}`);
          clearInterval(intervalId);
        });
    }, 3000);

    return () => clearInterval(intervalId);

  }, [loginStatus, login]);

  // Merge the UI for visual feedback
  const displayStatus = error || loginStatus;

  return (
    <div className="flex flex-col items-center justify-center gap-6 p-8 rounded-lg bg-zinc-900/50 text-white">
        <div className="flex items-center gap-3">
             <FaSpotify className="w-8 h-8 text-[#1DB954]" />
             <h2 className="text-2xl font-bold">Accedi a Spotify</h2>
        </div>
       
        {isLoading || loginStatus === 'LOGIN COMPLETATO CON SUCCESSO!' ? (
             <div className="w-64 h-64 flex flex-col items-center justify-center bg-zinc-800 rounded-lg">
                <div className="w-12 h-12 rounded-full loading-spinner-border mb-4" />
                <p className="text-zinc-300">Autenticazione...</p>
             </div>
        ) : qrCodeUrl ? (
            <div className="w-64 h-64 p-4 bg-white rounded-lg shadow-2xl">
                <img src={qrCodeUrl} alt="QR Code per login Spotify" className="w-full h-full object-contain" />
            </div>
        ) : (
            <div className="w-64 h-64 flex items-center justify-center bg-zinc-800 rounded-lg">
                <div className="w-10 h-10 rounded-full loading-spinner-border" />
            </div>
        )}
        
        {/* The visual feedback the user wanted */}
        <p className="font-mono text-center max-w-xs text-yellow-300 bg-black/30 px-2 py-1 rounded">
          {displayStatus}
        </p>
    </div>
  );
}

export default SpotifyLogin;
