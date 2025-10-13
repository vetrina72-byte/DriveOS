import React, { useEffect, useState } from 'react';
import { FaSpotify, FaCheckCircle } from 'react-icons/fa';
import { FiXCircle } from 'react-icons/fi';

const SpotifyCallback: React.FC = () => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  console.log("✅ [CALLBACK] Pagina di callback caricata.");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');
    const sessionId = params.get('state'); // The session ID is in the 'state' parameter

    if (error) {
      console.error("❌ [CALLBACK] Errore ricevuto da Spotify:", error);
      setErrorMessage(error);
      setStatus('error');
      return;
    }

    if (code && sessionId) {
      console.log("➡️ [CALLBACK] Codice e SessionId ricevuti. Sto per registrarli sul server...");
      // Send the code and session ID to our backend to be stored.
      fetch('/api/register-auth-code', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId, code }),
      })
      .then(res => {
        if (!res.ok) {
          throw new Error('Failed to register authentication code with the server.');
        }
        console.log("✅ [CALLBACK] Codice registrato con successo sul server.");
        setStatus('success');
      })
      .catch(e => {
        console.error("❌ [CALLBACK] Fallimento nella comunicazione con il server:", e);
        setErrorMessage('Could not communicate with the vehicle. Please try again.');
        setStatus('error');
      });
    } else {
        console.error("❌ [CALLBACK] Risposta non valida da Spotify (manca codice o sessionId).");
        setErrorMessage('Invalid authentication response from Spotify.');
        setStatus('error');
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
      <FaSpotify style={{ fontSize: '4rem', color: '#1DB954', marginBottom: '1.5rem' }} />
      
      {status === 'loading' && (
        <>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Finalizzazione...</h1>
            <p style={{ color: '#9ca3af' }}>
                Trasferimento dell'autenticazione al veicolo in corso.
            </p>
        </>
      )}

      {status === 'success' && (
        <>
            <FaCheckCircle style={{ fontSize: '3rem', color: '#1DB954', marginBottom: '1.5rem' }} />
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Successo!</h1>
            <p style={{ color: '#9ca3af' }}>
                Sei stato autenticato. Puoi chiudere questa finestra.
            </p>
        </>
      )}

      {status === 'error' && (
        <>
            <FiXCircle style={{ fontSize: '3rem', color: '#EF4444', marginBottom: '1.5rem' }} />
            <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Errore</h1>
            <p style={{ color: '#9ca3af' }}>
                {errorMessage || 'Si è verificato un errore durante l\'autenticazione.'}
            </p>
        </>
      )}
    </div>
  );
};

export default SpotifyCallback;
