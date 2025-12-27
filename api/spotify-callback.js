// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const USER_URL = 'https://api.spotify.com/v1/me';

const sendCallbackPage = (res, { success = true, errorType = '', message = '' }) => {
  const title = success ? 'Accesso Completato' : 'Accesso Negato';
  let displayMessage = message;
  
  if (!displayMessage) {
    if (success) {
      displayMessage = 'Hai collegato con successo il tuo account Spotify. Puoi chiudere questa finestra e tornare all\'infotainment.';
    } else if (errorType === 'premium_required') {
      displayMessage = 'Impossibile completare l\'accesso: non disponi di un account Spotify Premium attivo.';
    } else {
      displayMessage = 'Si è verificato un errore durante la configurazione. Riprova scansionando nuovamente il codice.';
    }
  }
  
  const iconHtml = success 
      ? `<div class="icon-circle success">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
         </div>`
      : `<div class="icon-circle error">
           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
         </div>`;

  const html = `
    <!doctype html>
    <html lang="it">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no">
    <title>${title}</title>
    <style>
      :root {
        --bg-color: #0c0c0e;
        --card-bg: #1a1a1c;
        --text-color: #ffffff;
        --text-sub: #a1a1aa;
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
        padding: 20px;
        box-sizing: border-box;
      }
      .card {
        background: var(--card-bg);
        padding: 40px 30px;
        border-radius: 40px;
        width: 100%;
        max-width: 400px;
        box-shadow: 0 30px 60px rgba(0,0,0,0.5);
      }
      .spotify-logo {
        width: 140px;
        margin-bottom: 50px;
        opacity: 0.9;
      }
      .icon-circle {
        width: 100px;
        height: 100px;
        border-radius: 50%;
        margin: 0 auto 30px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .icon-circle svg { width: 50px; height: 50px; }
      .success { background: rgba(29, 185, 84, 0.15); color: var(--spotify-green); }
      .error { background: rgba(239, 68, 68, 0.15); color: var(--error-red); }
      
      h1 {
        font-weight: 800;
        font-size: 24px;
        margin-bottom: 12px;
        letter-spacing: -0.5px;
      }
      p {
        font-weight: 400;
        font-size: 17px;
        line-height: 1.5;
        color: var(--text-sub);
        margin: 0;
      }
      .btn {
        margin-top: 35px;
        display: block;
        padding: 16px;
        background: #333;
        color: white;
        text-decoration: none;
        border-radius: 20px;
        font-weight: 600;
        font-size: 16px;
      }
    </style>
    </head>
    <body>
      <img src="https://storage.googleapis.com/pr-newsroom-wp/1/2018/11/Spotify_Logo_RGB_White.png" alt="Spotify" class="spotify-logo" />
      <div class="card">
        ${iconHtml}
        <h1>${title}</h1>
        <p>${displayMessage}</p>
        ${!success ? '<a href="javascript:window.close()" class="btn">Chiudi finestra</a>' : ''}
      </div>
      <script>
        if (${success}) {
          setTimeout(() => { if (window.close) { window.close(); } }, 4000);
        }
      </script>
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(success ? 200 : 400).send(html);
};

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;
  const redis = getRedis();

  if (error) {
    if (sessionId) await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: 'callback_error' }), 'EX', 60);
    sendCallbackPage(res, { success: false, message: `Spotify ha restituito un errore: ${error}` });
    return;
  }
  
  if (!code || !sessionId) {
    sendCallbackPage(res, { success: false, message: 'Parametri di sessione mancanti.' });
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

    const userRes = await fetch(USER_URL, { headers: { 'Authorization': `Bearer ${tokenData.access_token}` } });
    const userData = await userRes.json();

    if (userData.product !== 'premium') {
      const payload = { authenticated: false, error: 'premium_required', timestamp: Date.now() };
      await redis.set(`spotify:${sessionId}`, JSON.stringify(payload), 'EX', 300); 
      sendCallbackPage(res, { success: false, errorType: 'premium_required' });
      return;
    }
    
    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
    };
    await redis.set(`spotify:${sessionId}`, JSON.stringify(payload), 'EX', 2592000); 
    sendCallbackPage(res, { success: true });
  } catch (e) {
    sendCallbackPage(res, { success: false, message: 'Errore durante la comunicazione con il server.' });
  }
}