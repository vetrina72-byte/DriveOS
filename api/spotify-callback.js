
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '' }) => {
  let title = success ? 'Collegato' : 'Non riuscito';
  let displayMessage = '';
  let showRetry = false;
  
  if (success) {
    displayMessage = 'Il tuo account Spotify è stato collegato correttamente.';
  } else if (errorType === 'premium_required') {
    title = 'Richiesto Premium';
    displayMessage = 'Impossibile proseguire con l’accesso perché non disponi di un account Premium.';
    showRetry = false; // Explicitly no retry button for premium error
  } else if (errorType === 'access_denied') {
    title = 'Accesso Negato';
    displayMessage = 'Hai annullato la richiesta di accesso.';
    showRetry = true;
  } else {
    // Technical error
    title = 'Errore Tecnico';
    displayMessage = 'Si è verificato un problema durante la connessione. Verifica la tua rete e riprova.';
    showRetry = true;
  }
  
  // Icon styling: Filled circle
  // Success Color: Light Mode #34C759, Dark Mode #32D74B
  // Error Color: Light Mode #FF3B30, Dark Mode #FF453A
  
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
        --bg-color: #ffffff;
        --text-primary: #000000;
        --text-secondary: #86868b;
        --accent-success: #34C759;
        --accent-error: #FF3B30;
        --btn-bg: #000000;
        --btn-text: #ffffff;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg-color: #000000;
          --text-primary: #ffffff;
          --text-secondary: #8E8E93;
          --accent-success: #32D74B;
          --accent-error: #FF453A;
          --btn-bg: #ffffff;
          --btn-text: #000000;
        }
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
        max-width: 360px; /* Slightly wider */
        width: 100%;
        opacity: 0;
        transform: scale(0.95);
        animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .icon-wrapper {
        width: 80px; /* Larger icon */
        height: 80px;
        margin: 0 auto 32px;
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
        font-size: 28px; /* Larger Title */
        font-weight: 700; 
        margin: 0 0 16px; 
        letter-spacing: -0.01em;
      }

      p { 
        color: var(--text-secondary); 
        font-size: 18px; /* Larger Text */
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
    // Generic technical error
    return sendCallbackPage(res, { success: false, errorType: 'technical' });
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
        return sendCallbackPage(res, { success: false, errorType: 'technical' });
    }

    const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    if (!userRes.ok) {
        if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'user_fetch_failed' }), 'EX', 120);
        return sendCallbackPage(res, { success: false, errorType: 'technical' });
    }
    
    const userData = await userRes.json();

    if (userData.product !== 'premium') {
      console.log(`[SPOTIFY CALLBACK] Account NON premium per sessione: ${sessionId}`);
      await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'premium_required' }), 'EX', 600); 
      return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
    }
    
    await redis.set(`spotify:${sessionId}`, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    }), 'EX', 3600); 
    sendCallbackPage(res, { success: true });

  } catch (e) {
    console.error(`[SPOTIFY CALLBACK] Eccezione: ${e.message}`);
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_exception' }), 'EX', 120);
    sendCallbackPage(res, { success: false, errorType: 'technical' });
  }
}
