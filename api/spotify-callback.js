
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '' }) => {
  let title = success ? 'Accesso Consentito' : 'Accesso Negato';
  let displayMessage = '';
  
  if (success) {
    displayMessage = 'Hai collegato con successo il tuo account Spotify Premium. Puoi tornare all\'auto.';
  } else if (errorType === 'premium_required') {
    displayMessage = 'È necessario un account Premium per continuare l\'esperienza Drive OS.';
  } else if (errorType === 'access_denied') {
    title = 'Accesso Annullato';
    displayMessage = 'L\'autorizzazione è stata annullata. Scansiona nuovamente il codice sull\'auto per riprovare.';
  } else {
    displayMessage = 'Si è verificato un inconveniente tecnico. Riprova la scansione dall\'auto.';
  }
  
  // Icone IDENTICHE per struttura, peso e stile (V e X sono speculari)
  const iconHtml = success 
      ? `<div class="icon-container success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
         </div>`
      : `<div class="icon-container error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
         </div>`;

  const html = `
    <!doctype html>
    <html lang="it">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
    <title>${title}</title>
    <style>
      body { background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
      .card { background: #111; padding: 50px 40px; border-radius: 40px; width: 85%; max-width: 420px; border: 1px solid #222; box-shadow: 0 30px 60px rgba(0,0,0,0.6); animation: appear 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      @keyframes appear { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      
      .icon-container { width: 110px; height: 110px; border-radius: 50%; margin: 0 auto 35px; display: flex; align-items: center; justify-content: center; }
      .icon-container svg { width: 55px; height: 55px; }
      
      .success { background: rgba(29, 185, 84, 0.1); color: #1DB954; }
      .error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      
      h1 { font-size: 32px; margin-bottom: 15px; font-weight: 800; letter-spacing: -0.5px; }
      p { color: #a1a1aa; font-size: 19px; line-height: 1.5; margin: 0; font-weight: 400; }
    </style>
    </head>
    <body>
      <div class="card">
        ${iconHtml}
        <h1>${title}</h1>
        <p>${displayMessage}</p>
      </div>
      <script>setTimeout(() => { if(window.close) window.close(); }, 7000);</script>
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(html);
};

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;
  const redis = getRedis();

  // 1. Gestione Annullamento (User cancel) - Scrive in Redis per sbloccare l'auto
  if (error === 'access_denied') {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'access_denied' }), 'EX', 120);
    return sendCallbackPage(res, { success: false, errorType: 'access_denied' });
  }

  // 2. Gestione Errori Generici - Scrive in Redis per sbloccare l'auto
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

    // 3. Controllo Account Premium - Scrive in Redis lo stato specifico richiesto
    if (userData.product !== 'premium') {
      console.log(`[SPOTIFY CALLBACK] Account NON premium per sessione: ${sessionId}`);
      await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'premium_required' }), 'EX', 600); 
      return sendCallbackPage(res, { success: false, errorType: 'premium_required' });
    }
    
    // 4. Successo - Scrive i token in Redis
    await redis.set(`spotify:${sessionId}`, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    }), 'EX', 3600); 
    sendCallbackPage(res, { success: true });

  } catch (e) {
    console.error(`[SPOTIFY CALLBACK] Eccezione: ${e.message}`);
    // In caso di crash, sblocca comunque l'infotainment scrivendo l'errore
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_exception' }), 'EX', 120);
    sendCallbackPage(res, { success: false });
  }
}
