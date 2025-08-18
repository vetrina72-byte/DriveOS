
import React, { useEffect } from 'react';

const SpotifyCallback: React.FC = () => {
  useEffect(() => {
    console.log("POPUP: Componente Callback caricato.");
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (code) {
      console.log(`POPUP: Codice trovato: ${code}`);
      if (window.opener) {
        console.log("POPUP: Invio messaggio alla finestra principale...");
        window.opener.postMessage({ type: 'spotifyAuth', code: code }, '*');
        console.log("POPUP: Tento di chiudere la finestra.");
        window.close();
      }
    } else if (error) {
      console.log(`POPUP: Spotify ha restituito un errore: ${error}`);
      if (window.opener) {
        window.opener.postMessage({ type: 'spotifyAuth', error: error }, '*');
      }
      window.close();
    }
  }, []);

  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      color: '#e5e7eb',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Autenticazione in corso...</h1>
      <p style={{ color: '#9ca3af' }}>
        Stiamo completando il processo di autenticazione con Spotify.
        Questa finestra si chiuderà automaticamente.
      </p>
    </div>
  );
};

export default SpotifyCallback;
