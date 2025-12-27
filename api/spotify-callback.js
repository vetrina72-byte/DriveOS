// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '', message = '' }) => {
  const title = success ? 'Accesso Completato' : 'Accesso Negato';
  let displayMessage = message;
  
  if (!displayMessage) {
    if (success) {
      displayMessage = 'Hai collegato con successo il tuo account Spotify. Puoi chiudere questa finestra.';
    } else if (errorType === 'premium_required') {
      displayMessage = 'Impossibile accedere perché non disponi di un account Spotify Premium.';
    } else {
      displayMessage = 'Qualcosa è andato storto. Riprova a scansionare il codice QR.';
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
             <path class="cross__path" fill="none" d="M16 16 36 36 M36 16 16 36"/>
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
        align-items: center;
        justify-content: center;
        text-align: center;
      }
      header {
        position: absolute;
        top: 60px;
        width: 100%;
        display: flex;
        justify-content: center;
      }
      .spotify-logo {
        width: 140px;
        height: auto;
      }
      .container {
        padding: 2rem;
        animation: fadeIn 0.8s ease-out;
      }
      h1 {
        font-weight: 700;
        font-size: 1.75rem;
        margin: 1.5rem 0 0.5rem;
      }
      p {
        font-weight: 400;
        font-size: 1.1rem;
        line-height: 1.5;
        color: #a1a1aa;
        max-width: 320px;
        margin: 0 auto;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Checkmark Animation */
      .checkmark { width: 80px; height: 80px; border-radius: 50%; display: block; stroke-width: 3; stroke: #fff; stroke-miterlimit: 10; margin: 0 auto; box-shadow: inset 0px 0px 0px var(--spotify-green); animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: var(--spotify-green); fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }
      
      /* Error Animation */
      .cross { width: 80px; height: 80px; border-radius: 50%; display: block; stroke-width: 4; stroke: #fff; stroke-miterlimit: 10; margin: 0 auto; box-shadow: inset 0px 0px 0px var(--error-red); animation: fill-error .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .cross__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: var(--error-red); fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .cross__path { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }

      @keyframes stroke { 100% { stroke-dashoffset: 0; } }
      @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
      @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 50px var(--spotify-green); } }
      @keyframes fill-error { 100% { box-shadow: inset 0px 0px 0px 50px var(--error-red); } }
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
    sendCallbackPage(res, { success: false, message: `Spotify ha restituito un errore: ${error}` });
    return;
  }
  if (!code || !sessionId) {
    sendCallbackPage(res, { success: false, message: 'Parametri mancanti.' });
    return;
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;
  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: VITE_REDIRECT_URI,
  });

  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': authHeader },
      body: params,
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
      sendCallbackPage(res, { success: false });
      return;
    }

    // CONTROLLO PREMIUM
    const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    const userData = await userRes.json();
    const redis = getRedis();

    if (userData.product !== 'premium') {
      console.warn(`[CALLBACK] Utente non premium. Segnalazione errore per sessione ${sessionId}`);
      const payload = { authenticated: false, error: 'premium_required', timestamp: Date.now() };
      await redis.set(`spotify:${sessionId}`, JSON.stringify(payload), 'EX', 600); 
      sendCallbackPage(res, { success: false, errorType: 'premium_required' });
      return;
    }
    
    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    };
    await redis.set(`spotify:${sessionId}`, JSON.stringify(payload), 'EX', 2592000); // 30 giorni
    sendCallbackPage(res, { success: true });
  } catch (e) {
    console.error('[CALLBACK] Errore critico:', e);
    sendCallbackPage(res, { success: false, message: 'Errore di connessione al server.' });
  }
}