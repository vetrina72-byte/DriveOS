import React, { useEffect } from 'react';

const SpotifyCallback: React.FC = () => {
  useEffect(() => {
    // This effect runs once when the component mounts after the redirect.
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    // This component is expected to run within a different window context (iframe/popup),
    // so it communicates back to the main application window that opened it.
    const targetWindow = window.opener || (window.parent !== window ? window.parent : null);
    
    if (targetWindow) {
      if (code) {
        // Send the authorization code to the target window.
        targetWindow.postMessage({ type: 'spotifyAuth', code: code }, window.location.origin);
      } else if (error) {
        // Send any error received from Spotify to the target window.
        targetWindow.postMessage({ type: 'spotifyAuth', error: error }, window.location.origin);
      }
    }
  }, []); // The empty dependency array ensures this effect runs only once on mount.

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
