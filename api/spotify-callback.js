// File: /api/spotify-callback.js
import axios from 'axios';
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Helper for user-friendly HTML responses
const successHtml = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accesso completato</title>
<style>
  html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; text-align: center; }
  .container { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3rem; height: 100%; box-sizing: border-box; }
  .spotify-logo { width: 132px; height: auto; }
  .message { color: #fff; font-size: 1.3rem; font-weight: 500; line-height: 1.5; max-width: 340px; margin: 0; }
  .success-icon { width: 64px; height: 64px; }
</style>
</head>
<body>
  <div class="container">
    <svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Spotify Logo">
        <path d="M25 0C11.2 0 0 11.2 0 25s11.2 25 25 25 25-11.2 25-25S38.8 0 25 0zm19.6 36.4c-1.2 2-3.4 2.5-5.4 1.3-2-1.2-2.5-3.4-1.3-5.4 1.2-2 3.4-2.5 5.4-1.3 2 1.2 2.5 3.4 1.3 5.4zm2.3-9.8c-2.3 1-4.9-1.2-5.9-3.5-1-2.3 1.2-4.9 3.5-5.9 2.3-1 4.9 1.2 5.9 3.5 1 2.3-1.2 4.9-3.5 5.9zM38 13.9c-2.7 1.1-5.9-1.4-7-4.1-1.1-2.7 1.4-5.9 4.1-7s5.9 1.4 7 4.1c1.1 2.7-1.4 5.9-4.1 7z"/>
        <path d="M96.4 31.6c-4.4 0-7.8 1.4-10.3 4.1V19.4h-6.2v23.2h6.2v-1.6c2.3 2.5 5.2 3.9 9.3 3.9 9.2 0 16.4-7.2 16.4-17.1s-7.2-17.2-15.4-17.2zm-5.5 24c-5.8 0-10.5-4.7-10.5-10.6s4.7-10.6 10.5-10.6c5.8 0 10.5 4.7 10.5 10.6-.1 5.9-4.7 10.6-10.5 10.6zM130.4 19c-9.5 0-15.5 6-15.5 14.8 0 8.2 5.2 12.3 13.3 12.3 4.2 0 7.8-1.5 10.2-4.4l-3.8-3.4c-1.6 1.8-3.6 2.7-6.2 2.7-4.1 0-6.6-2.5-7.4-6.3h24.4V34c0-9.2-6.5-15-14.8-15zm-7.1 11.7c.7-4.1 3.5-6.7 7.2-6.7 3.8 0 6.3 2.6 7 6.7h-14.2zM161.4 19.4h-9.2L145 42.6h6.4l2-6.2h8.9l2 6.2h6.4l-7.2-23.2zm-1.1 12.3l3.5-10.9 3.5 10.9h-7z"/>
    </svg>
    <svg class="success-icon" viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Success checkmark">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M24,0 C10.745,0 0,10.745 0,24 C0,37.255 10.745,48 24,48 C37.255,48 48,37.255 48,24 C48,10.745 37.255,0 24,0 Z M35.707,18.707 C36.098,18.317 36.098,17.683 35.707,17.293 C35.317,16.902 34.683,16.902 34.293,17.293 L23,28.586 L15.707,21.293 C15.317,20.902 14.683,20.902 14.293,21.293 C13.902,21.683 13.902,22.317 14.293,22.707 L22.293,30.707 C22.683,31.098 23.317,31.098 23.707,30.707 L35.707,18.707 Z"/>
    </svg>
    <p class="message">Hai collegato con successo il tuo account Spotify.</p>
  </div>
  <script>setTimeout(()=>window.close(),3500)</script>
</body>
</html>`;

const expiredHtml = `<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autenticazione Fallita</title>
<style>
  html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; text-align: center; }
  .container { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; height: 100%; box-sizing: border-box; }
  .spotify-logo { width: 132px; height: auto; }
  .message { color: #fff; font-size: 1.1rem; font-weight: 500; line-height: 1.5; max-width: 340px; margin: 0; }
  .title { font-size: 1.5rem; font-weight: 600; }
  .error-icon { width: 48px; height: 48px; color: #f87171; }
</style>
</head>
<body>
  <div class="container">
    <svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Spotify Logo"><path d="M25 0C11.2 0 0 11.2 0 25s11.2 25 25 25 25-11.2 25-25S38.8 0 25 0zm19.6 36.4c-1.2 2-3.4 2.5-5.4 1.3-2-1.2-2.5-3.4-1.3-5.4 1.2-2 3.4-2.5 5.4-1.3 2 1.2 2.5 3.4 1.3 5.4zm2.3-9.8c-2.3 1-4.9-1.2-5.9-3.5-1-2.3 1.2-4.9 3.5-5.9 2.3-1 4.9 1.2 5.9 3.5 1 2.3-1.2 4.9-3.5 5.9zM38 13.9c-2.7 1.1-5.9-1.4-7-4.1-1.1-2.7 1.4-5.9 4.1-7s5.9 1.4 7 4.1c1.1 2.7-1.4 5.9-4.1 7z"/><path d="M96.4 31.6c-4.4 0-7.8 1.4-10.3 4.1V19.4h-6.2v23.2h6.2v-1.6c2.3 2.5 5.2 3.9 9.3 3.9 9.2 0 16.4-7.2 16.4-17.1s-7.2-17.2-15.4-17.2zm-5.5 24c-5.8 0-10.5-4.7-10.5-10.6s4.7-10.6 10.5-10.6c5.8 0 10.5 4.7 10.5 10.6-.1 5.9-4.7 10.6-10.5 10.6zM130.4 19c-9.5 0-15.5 6-15.5 14.8 0 8.2 5.2 12.3 13.3 12.3 4.2 0 7.8-1.5 10.2-4.4l-3.8-3.4c-1.6 1.8-3.6 2.7-6.2 2.7-4.1 0-6.6-2.5-7.4-6.3h24.4V34c0-9.2-6.5-15-14.8-15zm-7.1 11.7c.7-4.1 3.5-6.7 7.2-6.7 3.8 0 6.3 2.6 7 6.7h-14.2zM161.4 19.4h-9.2L145 42.6h6.4l2-6.2h8.9l2 6.2h6.4l-7.2-23.2zm-1.1 12.3l3.5-10.9 3.5 10.9h-7z"/></svg>
    <svg class="error-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    <h2 class="title">Autenticazione non valida</h2>
    <p class="message">Il codice è scaduto. Torna al tuo infotainment, un nuovo QR code verrà generato automaticamente.</p>
  </div>
  <script>setTimeout(()=>window.close(),4500)</script>
</body>
</html>`;

export default async function handler(req, res) {
  const { code, state: sessionId, session } = req.query;
  const sid = sessionId || session;
  if (!code || !sid) {
    return res.status(400).send('Missing code or session');
  }

  const redis = getRedis();
  const key = `session:${sid}`;
  const lockKey = `lock:spotify-exchange:${sid}`;

  try {
    // Idempotency Check: if session is already valid, return success.
    const existing = await redis.get(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.authenticated) {
        console.log(`[spotify-callback] session ${sid} already authenticated -> idempotent return`);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(successHtml);
      }
    }

    // Acquire Lock: try to acquire a short lock to prevent race conditions.
    const gotLock = await redis.set(lockKey, '1', 'NX', 'EX', 20); // 20-second lock
    if (!gotLock) {
      console.warn(`[spotify-callback] Could not acquire lock for ${sid}, another process is likely handling it.`);
      // Another worker is probably doing the exchange.
      // We don't need a complex wait loop; the client's polling will resolve the state.
      // Return a polite page asking user to wait.
      return res.status(202).send(`<html><body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:2rem;"><h2>Stiamo finalizzando l'accesso...</h2><p>Il tuo infotainment si aggiornerà a breve.</p></body></html>`);
    }

    // Perform Token Exchange
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.VITE_REDIRECT_URI,
    }).toString();
    const authHeader = 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    
    const tokenResp = await axios.post(TOKEN_URL, body, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
        },
        timeout: 15000,
    });
    
    // --- SUCCESS ---
    const { access_token, refresh_token, expires_in } = tokenResp.data;
    const payload = {
      authenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
    };

    await redis.set(key, JSON.stringify(payload), 'EX', 60 * 60 * 24); // 24h TTL
    
    // Set HttpOnly cookie for secure, subsequent token refreshes
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);

    console.log(`[spotify-callback] OK: Saved session ${sid} in Redis.`);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(successHtml);

  } catch (err) {
    const errorData = axios.isAxiosError(err) ? err.response?.data : null;
    console.error('[spotify-callback] Error exchanging token:', errorData || (err.message || err));

    // Handle `invalid_grant` specifically
    if (errorData?.error === 'invalid_grant') {
      await redis.set(key, JSON.stringify({ authenticated: false, expired: true, token_error: errorData }), 'EX', 60 * 5);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(expiredHtml); // Use 200 to show a friendly page
    }

    // Handle other errors
    await redis.set(key, JSON.stringify({ authenticated: false, error: 'exchange_exception', message: err.message }), 'EX', 60 * 5);
    const userMessage = "Si è verificato un errore interno. Riprova.";
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorHtml(userMessage));

  } finally {
    // Always release the lock
    await redis.del(lockKey);
  }
}
