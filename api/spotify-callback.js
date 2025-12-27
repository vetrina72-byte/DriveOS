
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '' }) => {
  const title = success ? 'Accesso Completato' : 'Accesso Negato';
  let displayMessage = '';
  
  if (success) {
    displayMessage = 'Hai collegato con successo il tuo account Spotify. Puoi tornare all\'auto.';
  } else if (errorType === 'premium_required') {
    displayMessage = 'Accesso negato. Per accedere è richiesto un account premium.';
  } else {
    displayMessage = 'Errore durante la configurazione. Riprova la scansione.';
  }
  
  const iconHtml = success 
      ? `<div class="icon success"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg></div>`
      : `<div class="icon error"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></div>`;

  const html = `
    <!doctype html>
    <html lang="it">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>
      body { background: #000; color: #fff; font-family: -apple-system, system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; text-align: center; }
      .card { background: #111; padding: 40px; border-radius: 30px; width: 85%; max-width: 400px; border: 1px solid #222; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
      .icon { width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 30px; display: flex; align-items: center; justify-content: center; }
      .success { background: rgba(29, 185, 84, 0.1); color: #1DB954; }
      .error { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
      svg { width: 50px; height: 50px; }
      h1 { font-size: 28px; margin-bottom: 15px; font-weight: 800; }
      p { color: #a1a1aa; font-size: 18px; line-height: 1.5; margin: 0; }
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

  if (error || !code || !sessionId) {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_error' }), 'EX', 120);
    sendCallbackPage(res, { success: false });
    return;
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
    if (!tokenRes.ok) return sendCallbackPage(res, { success: false });

    // RECUPERO PROFILO UTENTE PER CONTROLLO PREMIUM
    const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    const userData = await userRes.json();

    if (userData.product !== 'premium') {
      // SALVO L'ERRORE IN REDIS: l'auto ora saprà perché l'accesso è fallito
      await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'premium_required' }), 'EX', 300); 
      sendCallbackPage(res, { success: false, errorType: 'premium_required' });
      return;
    }
    
    // SALVATAGGIO TOKEN SUCCESSFUL
    await redis.set(`spotify:${sessionId}`, JSON.stringify({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    }), 'EX', 3600); 
    sendCallbackPage(res, { success: true });
  } catch (e) {
    sendCallbackPage(res, { success: false });
  }
}
