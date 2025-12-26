
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_ME_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '', message = '' }) => {
  const title = success ? 'Accesso Completato' : 'Accesso Negato';
  let displayMessage = message;
  
  if (!displayMessage) {
    if (success) {
      displayMessage = 'Hai collegato con successo il tuo account Spotify. Puoi chiudere questa finestra.';
    } else {
      displayMessage = errorType === 'premium_required' 
        ? 'Il tuo account non dispone di un abbonamento Spotify Premium. L\'integrazione richiede Premium per funzionare.'
        : 'Si è verificato un errore durante la connessione. Riprova più tardi.';
    }
  }
  
  const iconHtml = success 
      ? `<div class="icon-circle success">
           <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
             <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
             <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
           </svg>
         </div>`
      : `<div class="icon-circle error">
           <svg class="cross" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
             <circle class="cross__circle" cx="26" cy="26" r="25" fill="none"/>
             <path class="cross__path" fill="none" d="M16 16 L36 36 M36 16 L16 36" stroke="white" stroke-width="4" stroke-linecap="round"/>
           </svg>
         </div>`;

  const html = `
    <!doctype html>
    <html lang="it">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>
      :root {
        --bg-color: #000000;
        --text-color: #ffffff;
        --spotify-green: #1DB954;
        --error-red: #ef4444;
      }
      body {
        background-color: var(--bg-color);
        color: var(--text-color);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      header {
        width: 100%;
        padding: 80px 0 40px;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;
      }
      .spotify-logo {
        width: 140px;
        height: auto;
      }
      .container {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        padding-bottom: 15vh;
        text-align: center;
        animation: fadeIn 0.6s ease-out;
      }
      h1 {
        font-weight: 700;
        font-size: 1.8rem;
        margin: 1.5rem 0 1rem;
        letter-spacing: -0.02em;
      }
      p {
        font-weight: 400;
        font-size: 1.1rem;
        line-height: 1.5;
        color: #a1a1aa;
        max-width: 320px;
        margin: 0;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      .icon-circle { width: 100px; height: 100px; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
      .icon-circle.success { background-color: var(--spotify-green); }
      .icon-circle.error { background-color: var(--error-red); }

      .checkmark__check { stroke: white; stroke-width: 4; fill: none; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards; }
      .cross__path { stroke: white; stroke-width: 4; fill: none; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.5s forwards; }
      
      @keyframes stroke { 100% { stroke-dashoffset: 0; } }
    </style>
    </head>
    <body>
      <header>
        <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_White.png" alt="Spotify" class="spotify-logo" />
      </header>
      <div class="container">
        ${iconHtml}
        <h1>${title}</h1>
        <p>${displayMessage}</p>
      </div>
      <script>setTimeout(() => { if (window.close) { window.close(); } }, 6000);</script>
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(success ? 200 : 400).send(html);
};

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;

  if (error) {
    return sendCallbackPage(res, { success: false, message: `Errore Spotify: ${error}` });
  }
  if (!code || !sessionId) {
    return sendCallbackPage(res, { success: false, message: 'Parametri di sessione mancanti.' });
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;
  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', VITE_REDIRECT_URI);

  try {
    const spotifyResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
        },
        body: params,
    });
    
    const tokenData = await spotifyResponse.json();
    if (!spotifyResponse.ok) throw new Error('Token exchange failed');

    // Verifica profilo per controllo Premium
    const meResponse = await fetch(USER_ME_URL, {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });
    const userData = await meResponse.json();
    const redis = getRedis();

    if (userData.product !== 'premium') {
        console.warn(`[SPOTIFY] Login negato per utente non-premium: ${userData.id}`);
        // Salviamo lo stato di errore specifico in Redis per informare l'infotainment
        await redis.set(`spotify:${sessionId}`, JSON.stringify({ error: 'premium_required' }), 'EX', 600);
        return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
    }
    
    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      refresh_failures: 0
    };

    await redis.set(`spotify:${sessionId}`, JSON.stringify(payload), 'EX', 60*60*24*30);
    return sendCallbackPage(res, { success: true });

  } catch (err) {
    console.error('Callback error:', err.message);
    return sendCallbackPage(res, { success: false });
  }
}
