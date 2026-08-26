
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '' }) => {
  let title = success ? 'Collegato' : 'Errore'; // Changed default title for error
  let displayMessage = '';
  // Removed showRetry logic completely as requested ("Nessun pulsante...").
  
  if (success) {
    displayMessage = 'Il tuo account Spotify è stato collegato correttamente.';
  } else if (errorType === 'premium_required') {
    // Requested specific message for non-premium (and mapped errors)
    title = 'Errore';
    displayMessage = 'Non è possibile accedere perché non dispone di un account Premium.';
  } else if (errorType === 'access_denied') {
    title = 'Annullato';
    displayMessage = 'Hai annullato la richiesta di accesso.';
  } else if (errorType === 'session_expired') {
    title = 'Sessione Scaduta';
    displayMessage = 'Il codice di accesso è scaduto o è già stato utilizzato. Scansiona nuovamente il QR code sull\'auto.';
  } else {
    // Fallback for unknown errors - adhering to strict "No Technical Error" request
    // We treat generic failures as access denied/premium required to avoid confusion
    title = 'Errore';
    displayMessage = 'Non è possibile accedere. Assicurati di disporre di un account Premium.';
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

  // Removed retry button HTML block entirely
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
      </div>
      ${success ? '<script>setTimeout(() => { if(window.close) window.close(); }, 4000);</script>' : ''}
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
};

export default async function handler(req, res) {
  try {
    const { code, state: sessionId, error } = req.query || {};
    const redis = getRedis();

    if (error === 'access_denied') {
      if (sessionId && redis) {
        try {
          await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'access_denied' }), 'EX', 120);
        } catch (e) {}
      }
      return sendCallbackPage(res, { success: false, errorType: 'access_denied' });
    }

    if (error || !code || !sessionId) {
      if (sessionId && redis) {
        try {
          await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_error' }), 'EX', 120);
        } catch (e) {}
      }
      return sendCallbackPage(res, { success: false, errorType: 'technical' });
    }

    // --- CONTROLLO STATO PRECEDENTE ---
    let cachedState = null;
    try {
      if (redis) {
        const cachedStateRaw = await redis.get(`spotify:${sessionId}`);
        if (cachedStateRaw) {
          cachedState = JSON.parse(cachedStateRaw);
          
          if (cachedState.error === 'premium_required') {
            return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
          }
          
          if (cachedState.access_token) {
            return sendCallbackPage(res, { success: true });
          }
        }
      }
    } catch (cacheErr) {
      console.warn(`[SPOTIFY CALLBACK] Cache read notice: ${cacheErr?.message || cacheErr}`);
    }

    let storedAuth = null;
    if (redis && sessionId) {
      try {
        const authRaw = await redis.get(`spotify:auth:${sessionId}`);
        if (authRaw) storedAuth = JSON.parse(authRaw);
      } catch (e) {}
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';
    
    // Dynamic redirect URI fallback if environment variable is missing
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (host.includes('localhost') ? 'http' : 'https');
    const dynamicRedirectUri = `${proto}://${host}/api/spotify-callback`;
    const redirectUri = storedAuth?.redirectUri || process.env.VITE_REDIRECT_URI || process.env.REDIRECT_URI || dynamicRedirectUri;

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: redirectUri,
      client_id: clientId
    });

    if (storedAuth?.codeVerifier) {
      bodyParams.append('code_verifier', storedAuth.codeVerifier);
    }

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    if (clientSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }
    
    try {
      let tokenRes = await fetch(TOKEN_URL, {
        method: 'POST',
        headers,
        body: bodyParams
      });

      // Retry with dynamic URI if first failed and differs
      if (!tokenRes.ok && redirectUri !== dynamicRedirectUri) {
        bodyParams.set('redirect_uri', dynamicRedirectUri);
        tokenRes = await fetch(TOKEN_URL, {
          method: 'POST',
          headers,
          body: bodyParams
        });
      }
      
      const tokenData = await tokenRes.json().catch(() => ({ error: 'invalid_json' }));
      
      if (!tokenRes.ok) {
          console.error('[SPOTIFY CALLBACK] Token Exchange Error:', tokenData);
          
          if (cachedState && cachedState.error === 'premium_required') {
               return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
          }

          if (tokenData.error === 'invalid_grant') {
               return sendCallbackPage(res, { success: false, errorType: 'session_expired' });
          }

          if (sessionId && redis) {
            try {
              await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'token_exchange_failed' }), 'EX', 120);
            } catch (e) {}
          }
          return sendCallbackPage(res, { success: false, errorType: 'technical' });
      }

      // Soft check user info if available
      try {
        const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
        if (userRes.ok) {
          const userData = await userRes.json();
          console.log(`[SPOTIFY CALLBACK] User fetched successfully for session: ${sessionId}, product: ${userData?.product}`);
        }
      } catch (err) {
        console.warn(`[SPOTIFY CALLBACK] Soft warning: User /me check failed, continuing with granted tokens.`);
      }
      
      if (redis) {
        try {
          await redis.set(`spotify:${sessionId}`, JSON.stringify({
            authenticated: true,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
          }), 'EX', 3600 * 24 * 30);
        } catch (e) {}
      }
      
      return sendCallbackPage(res, { success: true });

    } catch (e) {
      console.error(`[SPOTIFY CALLBACK] Exception: ${e.message}`);
      
      if (sessionId && redis) {
        try {
          await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_exception' }), 'EX', 120);
        } catch (err) {}
      }
      
      return sendCallbackPage(res, { success: false, errorType: 'technical' });
    }
  } catch (fatalError) {
    console.error('[SPOTIFY CALLBACK] Fatal uncaught error:', fatalError);
    return sendCallbackPage(res, { success: false, errorType: 'technical' });
  }
}
