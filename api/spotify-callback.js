
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '', detailMessage = '', tokenData = null, sessionId = '' }) => {
  let title = success ? 'Collegato!' : 'Errore';
  let displayMessage = '';
  
  if (success) {
    title = 'Collegato!';
    displayMessage = 'Il tuo account Spotify è stato collegato correttamente all\'infotainment.';
  } else if (errorType === 'access_denied') {
    title = 'Accesso Annullato';
    displayMessage = 'Hai annullato la richiesta di autorizzazione su Spotify.';
  } else if (errorType === 'session_expired') {
    title = 'Sessione Scaduta';
    displayMessage = 'Il codice di autorizzazione è scaduto o è già stato utilizzato. Inquadra nuovamente il QR code sull\'auto.';
  } else {
    title = 'Errore di Collegamento';
    displayMessage = detailMessage || 'Non è stato possibile completare il collegamento. Assicurati che l\'applicazione sia configurata correttamente e riprova.';
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

  const tokenPayloadJs = tokenData ? JSON.stringify({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in || 3600,
    expires_at: Date.now() + ((tokenData.expires_in || 3600) * 1000),
    sessionId: sessionId || ''
  }) : 'null';

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
        --accent-success: #1DB954;
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
        padding: 32px 24px; 
        text-align: center; 
        box-sizing: border-box;
      }

      .container {
        max-width: 380px;
        width: 100%;
        opacity: 0;
        transform: scale(0.95);
        animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: #111113;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 28px;
        padding: 36px 28px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
      }

      .icon-wrapper {
        width: 72px;
        height: 72px;
        margin-bottom: 24px;
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
        font-size: 22px; 
        font-weight: 700; 
        margin: 0 0 12px; 
        letter-spacing: -0.01em;
      }

      p { 
        color: var(--text-secondary); 
        font-size: 15px; 
        line-height: 1.5; 
        font-weight: 400; 
        margin: 0 0 28px; 
      }

      .btn {
        background: #1DB954;
        color: #000000;
        border: none;
        font-size: 15px;
        font-weight: 700;
        border-radius: 9999px;
        padding: 12px 28px;
        cursor: pointer;
        transition: transform 0.15s ease, opacity 0.15s ease;
        text-decoration: none;
        display: inline-block;
      }

      .btn:active {
        transform: scale(0.96);
        opacity: 0.9;
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
        <div style="display:flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <a href="/" class="btn" style="background:#1DB954; color:#000;">Vai all'Infotainment</a>
          <button class="btn" style="background:#2C2C2E; color:#fff;" onclick="window.close()">Chiudi Scheda</button>
        </div>
      </div>
      <script>
        try {
          const t = ${tokenPayloadJs};
          if (t && t.access_token) {
            localStorage.setItem('spotify_access_token', t.access_token);
            localStorage.setItem('spotify_token_expiry', String(t.expires_at));
            if (t.refresh_token) localStorage.setItem('spotify_refresh_token', t.refresh_token);
            localStorage.setItem('spotify_auth_broadcast', JSON.stringify(t));
            try {
              const ch = new BroadcastChannel('driveos_spotify_auth');
              ch.postMessage({ type: 'AUTH_SUCCESS', ...t });
            } catch(e) {}
            try {
              if (window.opener) {
                window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', ...t }, '*');
              }
            } catch(e) {}
          }
        } catch(e) {}
        ${success ? 'setTimeout(() => { try { if (window.opener) window.close(); } catch(e){} }, 3500);' : ''}
      </script>
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
};

function parseState(rawState) {
  if (!rawState) return { sessionId: '', codeVerifier: null, redirectUri: null };
  const str = String(rawState).trim();
  
  // 1. Direct JSON
  if (str.startsWith('{') && str.endsWith('}')) {
    try {
      const p = JSON.parse(str);
      return { 
        sessionId: String(p.s || p.sessionId || ''), 
        codeVerifier: p.v || p.codeVerifier || null, 
        redirectUri: p.r || p.redirectUri || null 
      };
    } catch (e) {}
  }

  // 2. URL-encoded JSON
  if (str.startsWith('%7B') || str.includes('%22')) {
    try {
      const decoded = decodeURIComponent(str);
      const p = JSON.parse(decoded);
      return { 
        sessionId: String(p.s || p.sessionId || ''), 
        codeVerifier: p.v || p.codeVerifier || null, 
        redirectUri: p.r || p.redirectUri || null 
      };
    } catch (e) {}
  }

  // 3. Base64 or URL-safe Base64
  try {
    let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
    if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
      const p = JSON.parse(jsonStr);
      return { 
        sessionId: String(p.s || p.sessionId || ''), 
        codeVerifier: p.v || p.codeVerifier || null, 
        redirectUri: p.r || p.redirectUri || null 
      };
    }
  } catch (e) {}

  return { sessionId: str, codeVerifier: null, redirectUri: null };
}

export default async function handler(req, res) {
  try {
    const { code, state: rawState, error } = req.query || {};
    const redis = getRedis();

    const { sessionId, codeVerifier, redirectUri: redirectUriFromState } = parseState(rawState);

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
      return sendCallbackPage(res, { success: false, errorType: 'technical', detailMessage: 'Parametri di autorizzazione mancanti o non validi.' });
    }

    // Check if session was pre-registered in storage
    let storedAuth = null;
    if (redis && sessionId) {
      try {
        const authRaw = await redis.get(`spotify:auth:${sessionId}`);
        if (authRaw) storedAuth = JSON.parse(authRaw);
      } catch (e) {}
    }

    const effectiveCodeVerifier = codeVerifier || storedAuth?.codeVerifier || null;

    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';
    
    // Dynamic redirect URI fallback
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
    const dynamicRedirectUri = `${proto}://${host}/api/spotify-callback`;
    const redirectUri = redirectUriFromState || storedAuth?.redirectUri || process.env.VITE_REDIRECT_URI || process.env.REDIRECT_URI || dynamicRedirectUri;

    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: String(code),
      redirect_uri: redirectUri,
      client_id: clientId
    });

    if (effectiveCodeVerifier) {
      bodyParams.append('code_verifier', effectiveCodeVerifier);
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

      let tokenData = await tokenRes.json().catch(() => ({ error: 'invalid_json' }));

      // If initial attempt failed and clientSecret was used in basic auth, retry with PKCE body params
      if (!tokenRes.ok && clientSecret) {
        const retryBody = new URLSearchParams({
          grant_type: 'authorization_code',
          code: String(code),
          redirect_uri: redirectUri,
          client_id: clientId
        });
        if (effectiveCodeVerifier) {
          retryBody.append('code_verifier', effectiveCodeVerifier);
        }
        const retryRes = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: retryBody
        });
        if (retryRes.ok) {
          tokenRes = retryRes;
          tokenData = await retryRes.json();
        }
      }

      // Retry with dynamic URI if first attempts failed and URIs differ
      if (!tokenRes.ok && redirectUri !== dynamicRedirectUri) {
        bodyParams.set('redirect_uri', dynamicRedirectUri);
        const retryDyn = await fetch(TOKEN_URL, {
          method: 'POST',
          headers,
          body: bodyParams
        });
        if (retryDyn.ok) {
          tokenRes = retryDyn;
          tokenData = await retryDyn.json();
        }
      }
      
      if (!tokenRes.ok) {
          console.error('[SPOTIFY CALLBACK] Token Exchange Error:', tokenData);
          
          if (sessionId && redis) {
            try {
              await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: tokenData.error || 'token_exchange_failed' }), 'EX', 120);
            } catch (e) {}
          }

          if (tokenData.error === 'invalid_grant') {
               return sendCallbackPage(res, { success: false, errorType: 'session_expired', detailMessage: tokenData.error_description || 'Il codice di autorizzazione è scaduto o è già stato utilizzato.' });
          }

          return sendCallbackPage(res, { success: false, errorType: 'technical', detailMessage: tokenData.error_description || 'Impossibile completare lo scambio del token con Spotify.' });
      }

      // Soft verify user info
      try {
        const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
        if (userRes.ok) {
          const userData = await userRes.json();
          console.log(`[SPOTIFY CALLBACK] User connected: ${userData?.display_name || userData?.id}, product: ${userData?.product}`);
        }
      } catch (err) {
        console.warn(`[SPOTIFY CALLBACK] Soft warning: User /me check notice.`);
      }
      
      if (redis) {
        try {
          const payload = JSON.stringify({
            authenticated: true,
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: Date.now() + (tokenData.expires_in || 3600) * 1000,
          });
          const setResult = await redis.set(`spotify:${sessionId}`, payload, 'EX', 3600 * 24 * 30);
          console.log(`[SPOTIFY CALLBACK] Token saved in redis for session '${sessionId}' => result:`, setResult);
        } catch (e) {
          console.error(`[SPOTIFY CALLBACK] Error saving token to redis for session '${sessionId}':`, e);
        }
      } else {
        console.warn(`[SPOTIFY CALLBACK] Warning: No redis instance available to store session '${sessionId}'`);
      }
      
      return sendCallbackPage(res, { success: true, tokenData, sessionId });

    } catch (e) {
      console.error(`[SPOTIFY CALLBACK] Exception: ${e.message}`);
      
      if (sessionId && redis) {
        try {
          await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_exception' }), 'EX', 120);
        } catch (err) {}
      }
      
      return sendCallbackPage(res, { success: false, errorType: 'technical', detailMessage: 'Si è verificato un errore di rete durante la connessione.' });
    }
  } catch (fatalError) {
    console.error('[SPOTIFY CALLBACK] Fatal uncaught error:', fatalError);
    return sendCallbackPage(res, { success: false, errorType: 'technical', detailMessage: 'Errore interno del server.' });
  }
}
