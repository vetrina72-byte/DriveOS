
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
  
  // Replicating the "FeedbackIcon" logic from the React component using pure SVG/CSS
  // Success Color: Light Mode #34C759, Dark Mode #32D74B
  // Error Color: Light Mode #FF3B30, Dark Mode #FF453A
  
  const iconSvg = success 
      ? `<svg class="icon-svg success" viewBox="0 0 52 52">
           <circle class="checkmark-circle" cx="26" cy="26" r="23" fill="none"/>
           <polyline class="checkmark-check" points="14 27 22 35 38 17" fill="none"/>
         </svg>`
      : `<svg class="icon-svg error" viewBox="0 0 52 52">
           <circle class="cross-circle" cx="26" cy="26" r="23" fill="none"/>
           <path class="cross-line" d="M16 16L36 36" fill="none"/>
           <path class="cross-line delay" d="M36 16L16 36" fill="none"/>
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
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg-color: #000000;
          --text-primary: #ffffff;
          --text-secondary: #8E8E93;
          --accent-success: #32D74B;
          --accent-error: #FF453A;
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
        height: 100vh; 
        margin: 0; 
        padding: 40px;
        text-align: center; 
        box-sizing: border-box;
      }

      .container {
        max-width: 320px;
        opacity: 0;
        transform: scale(0.95);
        animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      .icon-wrapper {
        width: 60px;
        height: 60px;
        margin: 0 auto 24px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .icon-svg {
        width: 100%;
        height: 100%;
        display: block;
      }

      /* Circle Background Ring */
      .checkmark-circle, .cross-circle {
        stroke-width: 3;
        stroke-miterlimit: 10;
        stroke: currentColor;
        stroke-opacity: 0.2;
      }

      /* Animated Paths */
      .checkmark-check, .cross-line {
        stroke-dasharray: 100;
        stroke-dashoffset: 100;
        stroke-width: 3;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke: currentColor;
      }

      /* Success Animation */
      .icon-svg.success { color: var(--accent-success); }
      .icon-svg.success .checkmark-check {
        animation: draw 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards 0.2s;
      }

      /* Error Animation */
      .icon-svg.error { color: var(--accent-error); }
      .icon-svg.error .cross-line {
        animation: draw 0.4s cubic-bezier(0.65, 0, 0.45, 1) forwards 0.2s;
      }
      .icon-svg.error .cross-line.delay {
        animation-delay: 0.35s;
      }

      h1 { 
        font-size: 24px; 
        font-weight: 700; 
        margin: 0 0 12px; 
        letter-spacing: -0.01em;
      }

      p { 
        color: var(--text-secondary); 
        font-size: 17px; 
        line-height: 1.4; 
        font-weight: 400; 
        margin: 0; 
      }

      @keyframes scaleIn { 
        to { opacity: 1; transform: scale(1); } 
      }
      @keyframes draw {
        to { stroke-dashoffset: 0; }
      }
    </style>
    </head>
    <body>
      <div class="container">
        <div class="icon-wrapper">
          ${iconSvg}
        </div>
        <h1>${title}</h1>
        <p>${displayMessage}</p>
      </div>
      <script>setTimeout(() => { if(window.close) window.close(); }, 4000);</script>
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
    sendCallbackPage(res, { success: false });
  }
}
