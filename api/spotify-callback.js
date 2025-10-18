// File: /api/spotify-callback.js
import axios from 'axios';
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export default async function handler(req, res) {
  const { code, state: sessionId } = req.query;
  const sid = sessionId || req.query.session; // Support both state and session query params

  if (!code || !sid) {
    return res.status(400).send('Missing code or session/state');
  }

  const redis = getRedis();
  const key = `session:${sid}`;

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.VITE_REDIRECT_URI,
    });

    const authHeader = 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');

    const tokenResp = await axios.post(TOKEN_URL, body.toString(), {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
        },
        timeout: 15000,
    });

    const { access_token, refresh_token, expires_in } = tokenResp.data;

    const payload = {
      authenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + (expires_in * 1000),
    };
    await redis.set(key, JSON.stringify(payload), 'EX', 60 * 60 * 24); // TTL 24h
    console.log(`[spotify-callback] saved session ${sid} in redis`);
    
    // Set HttpOnly cookie for secure, subsequent token refreshes
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);
    
    // Send the full, styled success page as an inline HTML string
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(`<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Accesso completato</title>
<style>
  html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif; text-align: center; }
  .container { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 3.5rem; height: 100%; padding-top: 20vh; box-sizing: border-box; }
  .spotify-logo { width: 140px; height: auto; }
  .message { color: #fff; font-size: 1.25rem; font-weight: 500; line-height: 1.5; max-width: 340px; margin: 0; }
  .success-icon { width: 48px; height: 48px; }
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
</html>`);

  } catch (err) {
    const errorData = axios.isAxiosError(err) ? err.response?.data : null;
    console.error('[spotify-callback] Error exchanging token:', errorData || (err.message || err));
    
    if (errorData?.error === 'invalid_grant') {
      try {
        await redis.set(key, JSON.stringify({
          authenticated: false,
          error: 'token_exchange_failed',
          token_error: errorData
        }), 'EX', 60 * 5);
      } catch (redisErr) {
        console.error('[spotify-callback] failed to save error state to redis', redisErr);
      }
      
      return res.status(200).send(`
          <html><body style="font-family:sans-serif;text-align:center;padding:2rem;background:#000;color:#fff">
            <h2>Autenticazione fallita</h2>
            <p>Il codice è scaduto o non è valido. Torna nel tuo infotainment e riprova il login (verrà generato un nuovo QR).</p>
            <button onclick="window.close()">Chiudi</button>
          </body></html>
        `);
    }

    try {
      await redis.set(key, JSON.stringify({ authenticated: false, error: 'exchange_exception', message: err.message }), 'EX', 60*5);
    } catch(e){ console.error('[spotify-callback] redis save on error failed', e); }

    return res.status(500).send('Internal error during Spotify callback');
  }
}