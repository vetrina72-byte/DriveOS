
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '' }) => {
  let title = success ? 'Collegato' : 'Non riuscito';
  let displayMessage = '';
  let showRetry = false;
  let iconClass = success ? 'success' : 'error';
  
  if (success) {
    displayMessage = 'Il tuo account Spotify è stato collegato correttamente.';
  } else if (errorType === 'premium_required') {
    // Requested specific message for non-premium accounts
    title = 'Errore';
    displayMessage = 'Non è possibile accedere perché non dispone di un account Premium.';
    showRetry = false; // Explicitly no buttons
  } else if (errorType === 'access_denied') {
    title = 'Annullato';
    displayMessage = 'Hai annullato la richiesta di accesso.';
    showRetry = true;
  } else if (errorType === 'session_expired') {
    // Specific message for page refreshes / used codes
    title = 'Sessione Scaduta';
    displayMessage = 'Il codice di accesso è scaduto o è già stato utilizzato. Scansiona nuovamente il QR code sull\'auto.';
    showRetry = false;
  } else {
    // Generic technical error
    title = 'Errore Tecnico';
    displayMessage = 'Si è verificato un problema durante la connessione. Verifica la tua rete e riprova.';
    showRetry = true;
  }
  
  const iconSvg = success 
      ? `<svg class="icon-svg success" viewBox="0 0 52 52">
           <circle class="icon-bg" cx="26" cy="26" r="26"/>
           <polyline class="icon-mark" points="14 27 22 35 38 17"/>
         </svg>`
      : `<svg class="icon-svg error" viewBox="0 0 52 52">
           <circle class="icon-bg" cx="26" cy="26" r="26"/>
           <path class="icon-mark" d="M17 17L35 35"/>
           <path class="icon-mark" d="M35 17L17 35"/>
         </svg>`;

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
        --text-primary: #ffffff;
        --text-secondary: #a1a1aa;
        --accent-success: #32D74B;
        --accent-error: #FF453A;
        --btn-bg: #ffffff;
        --btn-text: #000000;
      }
      
      body { 
        background: var(--bg-color); 
        color: var(--text-primary); 
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
        display: flex; 
        flex-direction: column; 
        align-items: center; 
        justify-content: center; 
        min-height: 100vh; 
        margin: 0; 
        padding: 40px; 
        text-align: center; 
        box-sizing: border-box;
      }

      .container {
        max-width: 360px;
        width: 100%;
        opacity: 0;
        transform: scale(0.95);
        animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        display: flex;
        flex-direction: column;
        align-items: center;
      }

      .icon-wrapper {
        width: 80px;
        height: 80px;
        margin-bottom: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .icon-svg {
        width: 100%;
        height: 100%;
        display: block;
        overflow: visible;
      }

      .icon-bg {
        fill: currentColor;
        transform-origin: center;
        animation: scaleInElastic 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .icon-mark {
        fill: none;
        stroke: #FFFFFF;
        stroke-width: 4;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        animation: draw 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards 0.2s;
      }

      .icon-svg.success { color: var(--accent-success); }
      .icon-svg.error { color: var(--accent-error); }

      h1 { 
        font-size: 24px;
        font-weight: 700; 
        margin: 0 0 16px; 
        letter-spacing: -0.01em;
      }

      p { 
        color: var(--text-secondary); 
        font-size: 17px;
        line-height: 1.5; 
        font-weight: 400; 
        margin: 0 0 40px; 
      }

      .retry-btn {
        display: inline-block;
        background: var(--btn-bg);
        color: var(--btn-text);
        text-decoration: none;
        font-size: 17px;
        font-weight: 600;
        padding: 14px 32px;
        border-radius: 99px;
        transition: opacity 0.2s;
      }
      .retry-btn:active { opacity: 0.7; }

      @keyframes scaleIn { to { opacity: 1; transform: scale(1); } }
      @keyframes scaleInElastic { 0% { transform: scale(0); } 100% { transform: scale(1); } }
      @keyframes draw { to { stroke-dashoffset: 0; } }
    </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-wrapper">
          ${iconSvg}
        </div>
        <h1>${title}</h1>
        <p>${displayMessage}</p>
        ${showRetry ? '<a href="#" onclick="window.close()" class="retry-btn">Chiudi e Riprova</a>' : ''}
      </div>
      ${success ? '<script>setTimeout(() => { if(window.close) window.close(); }, 4000);</script>' : ''}
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
};

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;
  const redis = getRedis();

  if (error === 'access_denied') {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'access_denied' }), 'EX', 120);
    return sendCallbackPage(res, { success: false, errorType: 'access_denied' });
  }

  if (error || !code || !sessionId) {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_error' }), 'EX', 120);
    return sendCallbackPage(res, { success: false, errorType: 'technical' });
  }

  // --- CHECK PREVIOUS STATE ---
  // If the user refreshes the page, check Redis first.
  try {
    const cachedStateRaw = await redis.get(`spotify:${sessionId}`);
    if (cachedStateRaw) {
      const cachedState = JSON.parse(cachedStateRaw);
      
      // If previously rejected for non-premium, show that specific error again.
      if (cachedState.error === 'premium_required') {
        return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
      }
      
      // If previously successful, show success.
      if (cachedState.access_token) {
        return sendCallbackPage(res, { success: true });
      }
    }
  } catch (cacheErr) {
    console.error(`[SPOTIFY CALLBACK] Cache read error: ${cacheErr}`);
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
        console.error('[SPOTIFY CALLBACK] Token Exchange Error:', tokenData);
        // Handle "invalid_grant" (usually means code already used/refresh) differently
        if (tokenData.error === 'invalid_grant') {
             // We tried cache above and failed, so we don't know the state.
             // Assume expired instead of generic technical error.
             return sendCallbackPage(res, { success: false, errorType: 'session_expired' });
        }

        if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'token_exchange_failed' }), 'EX', 120);
        return sendCallbackPage(res, { success: false, errorType: 'technical' });
    }

    const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    if (!userRes.ok) {
        if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'user_fetch_failed' }), 'EX', 120);
        return sendCallbackPage(res, { success: false, errorType: 'technical' });
    }
    
    const userData = await userRes.json();

    // Check for premium product
    if (!userData.product || userData.product !== 'premium') {
      console.log(`[SPOTIFY CALLBACK] Account NON premium per session: ${sessionId} (Product: ${userData.product})`);
      // Cache this specific error state for 1 HOUR so refreshes show the correct message
      await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'premium_required' }), 'EX', 3600); 
      return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
    }
    
    await redis.set(`spotify:${sessionId}`, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    }), 'EX', 3600); 
    sendCallbackPage(res, { success: true });

  } catch (e) {
    console.error(`[SPOTIFY CALLBACK] Exception: ${e.message}`);
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_exception' }), 'EX', 120);
    sendCallbackPage(res, { success: false, errorType: 'technical' });
  }
}
