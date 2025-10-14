import React, { useState, useEffect, useRef } from 'react';
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
  const [uiState, setUiState] = useState('INIZIALIZZAZIONE');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const sessionIdRef = useRef<string | null>(null);

  // --- FASE 1: Creazione della sessione (UNA SOLA VOLTA) ---
  useEffect(() => {
    // This check prevents re-running if a parent component causes a re-render
    if (sessionIdRef.current) {
        console.log("[INIT] Sessione già esistente. Salto la creazione.");
        return;
    }

    console.log("[INIT] Avvio componente. Creo una nuova sessione client-side.");
    setUiState('CREAZIONE SESSIONE...');
    
    const sessionId = generateUUID();
    sessionIdRef.current = sessionId;

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
        state: sessionId
    }).toString();

    console.log(`[INIT] Sessione creata con ID: ${sessionId}`);
    setQrCodeUrl(generateQrUrl(authUrl.toString()));
    setUiState('IN ATTESA DI LOGIN');

  }, []); // L'array vuoto garantisce che questo venga eseguito UNA SOLA VOLTA.

  // --- FASE 2: Inizio del polling (parte quando abbiamo un sessionId) ---
  useEffect(() => {
    if (uiState !== 'IN ATTESA DI LOGIN' || !sessionIdRef.current) {
      return; // Non fare nulla se non siamo nello stato di attesa
    }

    const sessionId = sessionIdRef.current;
    console.log(`[POLLING] Avvio l'ascolto per la sessione ${sessionId}. Controllo ogni 3 secondi.`);
    
    const intervalId = setInterval(() => {
      console.log(`[POLLING] ...controllo lo stato...`);

      fetch(`/api/check-auth-status?sessionId=${sessionId}`)
        .then(res => {
          if (!res.ok) {
            throw new Error(`Server responded with status ${res.status}`);
          }
          return res.json();
        })
        .then(data => {
          if (data && data.status === 'completed' && data.code) {
            console.log("🎉🎉🎉 [POLLING] RICEVUTO! Lo stato è COMPLETED! Fermo l'ascolto e avvio il login.");
            clearInterval(intervalId);
            setUiState('LOGIN COMPLETATO');
            login(data.code); // This is the final step
          }
        })
        .catch(error => {
          console.error("[POLLING] Errore durante il controllo dello stato:", error);
          clearInterval(intervalId);
          setUiState('ERRORE DURANTE IL POLLING');
        });
    }, 3000);

    // Funzione di pulizia: se il componente viene smontato, ferma il polling
    return () => clearInterval(intervalId);

  }, [uiState, login]); // Questo effetto si riattiva quando uiState cambia

  // --- FASE 3: Rendering della UI ---
  return (
    <div className="flex flex-col items-center justify-center p-8 text-white">
      <h1 className="text-2xl font-bold mb-4 bg-black/50 px-4 py-2 rounded-lg font-mono">Stato: {uiState}</h1>
      
      {uiState === 'IN ATTESA DI LOGIN' && qrCodeUrl && (
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

       {(uiState.startsWith('ERRORE') || uiState === 'CREAZIONE SESSIONE...' || uiState === 'INIZIALIZZAZIONE') && (
         <div className="w-64 h-64 flex items-center justify-center bg-zinc-800 rounded-lg">
            <div className="w-10 h-10 rounded-full loading-spinner-border" />
        </div>
      )}
    </div>
  );
}

export default SpotifyLogin;