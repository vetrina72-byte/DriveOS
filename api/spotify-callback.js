
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '' }) => {
  let title = success ? 'Collegato' : 'Non riuscito';
  let displayMessage = '';
  
  if (success) {
    displayMessage = 'Il tuo account Spotify è stato collegato correttamente.';
  } else if (errorType === 'premium_required') {
    title = 'Richiesto Premium';
    displayMessage = 'L’integrazione richiede un account Spotify Premium attivo.';
  } else if (errorType === 'access_denied') {
    title = 'Annullato';
    displayMessage = 'La configurazione è stata interrotta.';
  } else {
    displayMessage = 'Si è verificato un problema tecnico. Riprova.';
  }
  
  // Stile "Apple-like": Tratto sottile (1.5px), dimensioni contenute, nessun cerchio di sfondo pesante
  const colorClass = success ? 'success-color' : 'error-color';
  const iconSvg = success 
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;

  const html = `
    <!doctype html>
    <html lang="it">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no,viewport-fit=cover">
    <title>${title}</title>
    <style>
      :root {
        --bg-color: #000000;
        --text-primary: #FFFFFF;
        --text-secondary: #8E8E93; /* Apple Gray */
        --accent-success: #30D158; /* Apple Green */
        --accent-error: #FF453A; /* Apple Red */
        --font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      
      body { 
        background: var(--bg-color); 
        color: var(--text-primary); 
        font-family: var(--font-family); 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
        height: 100vh; 
        margin: 0; 
        padding: 20px;
        text-align: center; 
        box-sizing: border-box;
      }

      .container {
        max-width: 320px;
        animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
      }

      .icon-wrapper {
        width: 64px;
        height: 64px;
        margin: 0 auto 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .icon-wrapper svg {
        width: 100%;
        height: 100%;
      }

      .success-color { color: var(--accent-success); }
      .error-color { color: var(--accent-error); }

      h1 { 
        font-size: 28px; 
        font-weight: 700; 
        margin: 0 0 12px; 
        letter-spacing: 0.3px;
      }

      p { 
        color: var(--text-secondary); 
        font-size: 17px; 
        line-height: 1.4; 
        font-weight: 400; 
        margin: 0; 
      }

      @keyframes fadeIn { 
        from { opacity: 0; transform: scale(0.98); } 
        to { opacity: 1; transform: scale(1); } 
      }
    </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-wrapper ${colorClass}">
          ${iconSvg}
        </div>
        <h1>${title}</h1>
        <p>${displayMessage}</p>
      </div>
      <script>setTimeout(() => { if(window.close) window.close(); }, 5000);</script>
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
};

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;
  const redis = getRedis();

  // 1. Gestione Annullamento (User cancel)
  if (error === 'access_denied') {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'access_denied' }), 'EX', 120);
    return sendCallbackPage(res, { success: false, errorType: 'access_denied' });
  }

  // 2. Gestione Errori Generici
  if (error || !code || !sessionId) {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_error' }), 'EX', 120);
    return sendCallbackPage(res, { success: false });
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;
  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  
  try {
    const tokenRes = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': authHeader },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: VITE_REDIRECT_URI })
    });
    
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok) {
        if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'token_exchange_failed' }), 'EX', 120);
        return sendCallbackPage(res, { success: false });
    }

    const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    if (!userRes.ok) {
        if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'user_fetch_failed' }), 'EX', 120);
        return sendCallbackPage(res, { success: false });
    }
    
    const userData = await userRes.json();

    // 3. Controllo Account Premium
    if (userData.product !== 'premium') {
      console.log(`[SPOTIFY CALLBACK] Account NON premium per sessione: ${sessionId}`);
      await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'premium_required' }), 'EX', 600); 
      return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
    }
    
    // 4. Successo
    await redis.set(`spotify:${sessionId}`, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    }), 'EX', 3600); 
    sendCallbackPage(res, { success: true });

  } catch (e) {
    console.error(`[SPOTIFY CALLBACK] Eccezione: ${e.message}`);
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_exception' }), 'EX', 120);
    sendCallbackPage(res, { success: false });
  }
}
