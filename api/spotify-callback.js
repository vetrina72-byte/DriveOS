// File: /api/spotify-callback.js
import axios from 'axios';
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// --- STYLED HTML RESPONSES ---

const successHtml = `
<!doctype html>
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
        <path d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.743 83.743 83.743 46.25 0 83.744-37.493 83.744-83.743C167.74 37.77 130.246.277 83.996.277zm-1.12 121.841c-29.838 0-54.123-24.285-54.123-54.122s24.285-54.123 54.123-54.123 54.122 24.285 54.122 54.123-24.284 54.122-54.122 54.122zm-1.001-86.012c-2.394 0-4.285.957-5.833 2.87-1.428 1.914-1.785 4.143-1.07 6.143 4.286 11.786 10.358 20.358 17.643 26.643-1.072 1.072-2.143 1.607-3.572 1.607-2.392 0-4.285-.958-5.833-2.871-1.429-1.914-1.786-4.143-1.072-6.143-4.285-11.785-10.357-20.357-17.643-26.643 1.072-1.07 2.143-1.607 3.572-1.607 2.393 0 4.285.957 5.833 2.87 1.428 1.915 1.785 4.143 1.07 6.143 4.286 11.786 10.358 20.358 17.643 26.643-1.071 1.071-2.143 1.607-3.572 1.607zm14.287-19.645c-2.857 0-5.143 1.072-6.857 3.215-1.715 2.143-2.143 4.821-1.286 7.321 4.286 11.786 10.357 20.358 17.643 26.643-1.286 1.071-2.571 1.607-4.285 1.607-2.857 0-5.143-1.072-6.857-3.214-1.715-2.143-2.143-4.822-1.286-7.322-4.286-11.786-10.357-20.357-17.643-26.643 1.286-1.071 2.571-1.607 4.286-1.607 2.857 0 5.143 1.071 6.857 3.214 1.714 2.143 2.143 4.822 1.286 7.322 4.285 11.786 10.357 20.357 17.643 26.643-1.286 1.071-2.571 1.607-4.286 1.607zm11.787-17.68c-3.786 0-6.858 1.393-9.001 4.178-2.142 2.786-2.785 6.322-1.607 9.536 4.286 11.786 10.358 20.357 17.643 26.643-1.607 1.071-3.214 1.607-5.357 1.607-3.786 0-6.858-1.393-9.001-4.178-2.142-2.786-2.785-6.322-1.607-9.536-4.285-11.786-10.357-20.357-17.643-26.643 1.607-1.071 3.214-1.607 5.357-1.607 3.785 0 6.857 1.392 9 4.178 2.143 2.786 2.786 6.322 1.607 9.536 4.286 11.786 10.358 20.357 17.643 26.643-1.607 1.071-3.215 1.607-5.357 1.607z"/>
    </svg>
    <svg class="success-icon" viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Success checkmark">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M24,0 C10.745,0 0,10.745 0,24 C0,37.255 10.745,48 24,48 C37.255,48 48,37.255 48,24 C48,10.745 37.255,0 24,0 Z M35.707,18.707 C36.098,18.317 36.098,17.683 35.707,17.293 C35.317,16.902 34.683,16.902 34.293,17.293 L23,28.586 L15.707,21.293 C15.317,20.902 14.683,20.902 14.293,21.293 C13.902,21.683 13.902,22.317 14.293,22.707 L22.293,30.707 C22.683,31.098 23.317,31.098 23.707,30.707 L35.707,18.707 Z"/>
    </svg>
    <p class="message">Hai collegato con successo il tuo account Spotify.</p>
  </div>
  <script>setTimeout(() => { if (window.close) { window.close(); } }, 3500);</script>
</body>
</html>`;

const expiredHtml = `
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Autenticazione Fallita</title>
<style>
  html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }
  body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; text-align: center; }
  .container { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; height: 100%; box-sizing: border-box; }
  .spotify-logo { width: 132px; height: auto; }
  .message { color: #d1d5db; font-size: 1.1rem; font-weight: 500; line-height: 1.5; max-width: 340px; margin: 0; }
  .title { font-size: 1.5rem; font-weight: 600; color: white; }
  .error-icon { width: 48px; height: 48px; color: #f87171; }
</style>
</head>
<body>
  <div class="container">
    <svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Spotify Logo"><path d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.743 83.743 83.743 46.25 0 83.744-37.493 83.744-83.743C167.74 37.77 130.246.277 83.996.277zm-1.12 121.841c-29.838 0-54.123-24.285-54.123-54.122s24.285-54.123 54.123-54.123 54.122 24.285 54.122 54.123-24.284 54.122-54.122 54.122zm-1.001-86.012c-2.394 0-4.285.957-5.833 2.87-1.428 1.914-1.785 4.143-1.07 6.143 4.286 11.786 10.358 20.358 17.643 26.643-1.072 1.072-2.143 1.607-3.572 1.607-2.392 0-4.285-.958-5.833-2.871-1.429-1.914-1.786-4.143-1.072-6.143-4.285-11.785-10.357-20.357-17.643-26.643 1.072-1.07 2.143-1.607 3.572-1.607 2.393 0 4.285.957 5.833 2.87 1.428 1.915 1.785 4.143 1.07 6.143 4.286 11.786 10.358 20.358 17.643 26.643-1.071 1.071-2.143 1.607-3.572 1.607zm14.287-19.645c-2.857 0-5.143 1.072-6.857 3.215-1.715 2.143-2.143 4.821-1.286 7.321 4.286 11.786 10.357 20.358 17.643 26.643-1.286 1.071-2.571 1.607-4.285 1.607-2.857 0-5.143-1.072-6.857-3.214-1.715-2.143-2.143-4.822-1.286-7.322-4.286-11.786-10.357-20.357-17.643-26.643 1.286-1.071 2.571-1.607 4.286-1.607 2.857 0 5.143 1.071 6.857 3.214 1.714 2.143 2.143 4.822 1.286 7.322 4.285 11.786 10.357 20.357 17.643 26.643-1.286 1.071-2.571 1.607-4.286 1.607zm11.787-17.68c-3.786 0-6.858 1.393-9.001 4.178-2.142 2.786-2.785 6.322-1.607 9.536 4.286 11.786 10.358 20.357 17.643 26.643-1.607 1.071-3.214 1.607-5.357 1.607-3.786 0-6.858-1.393-9.001-4.178-2.142-2.786-2.785-6.322-1.607-9.536-4.285-11.786-10.357-20.357-17.643-26.643 1.607-1.071 3.214-1.607 5.357-1.607 3.785 0 6.857 1.392 9 4.178 2.143 2.786 2.786 6.322 1.607 9.536 4.286 11.786 10.358 20.357 17.643 26.643-1.607 1.071-3.215 1.607-5.357 1.607z"/></svg>
    <svg class="error-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    <h2 class="title">Autenticazione non valida</h2>
    <p class="message">Il codice è scaduto. Torna al tuo infotainment, un nuovo QR code verrà generato automaticamente.</p>
  </div>
  <script>setTimeout(() => { if (window.close) { window.close(); } }, 4500);</script>
</body>
</html>`;

const errorHtml = (message) => `
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Errore</title>
<style>
  body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; text-align: center; }
  .container { padding: 2rem; }
  .title { font-size: 1.5rem; font-weight: 600; color: white; }
</style>
</head>
<body><div class="container"><h2 class="title">Errore di Autenticazione</h2><p>${message}</p></div></body>
</html>`;


export default async function handler(req, res) {
  const { code, state: sessionId, session } = req.query;
  const sid = sessionId || session;
  if (!code || !sid) {
    return res.status(400).send('Missing code or session');
  }

  const redis = getRedis();
  const key = \`session:\${sid}\`;
  const lockKey = \`lock:spotify-exchange:\${sid}\`;

  try {
    // 1. Idempotency Check
    const existing = await redis.get(key);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.authenticated) {
        console.log(\`[spotify-callback] Session \${sid} already authenticated -> idempotent return\`);
        res.setHeader('Content-Type', 'text/html');
        return res.status(200).send(successHtml);
      }
    }

    // 2. Acquire Lock
    const gotLock = await redis.set(lockKey, '1', 'NX', 'EX', 20); // 20-second lock
    if (!gotLock) {
      console.warn(\`[spotify-callback] Could not acquire lock for \${sid}, another process is likely handling it.\`);
      await new Promise(r => setTimeout(r, 700)); // Wait briefly
      const recheck = await redis.get(key);
      if(recheck && JSON.parse(recheck).authenticated) {
        return res.status(200).send(successHtml);
      }
      return res.status(202).send(\`<html><body style="background:#000;color:#fff;font-family:sans-serif;text-align:center;padding:2rem;"><h2>Stiamo finalizzando l'accesso...</h2><p>Il tuo infotainment si aggiornerà a breve.</p></body></html>\`);
    }

    // 3. Perform Token Exchange
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: process.env.VITE_REDIRECT_URI,
    }).toString();
    const authHeader = 'Basic ' + Buffer.from(\`\${process.env.SPOTIFY_CLIENT_ID}:\${process.env.SPOTIFY_CLIENT_SECRET}\`).toString('base64');
    
    const tokenResp = await axios.post(TOKEN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': authHeader },
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
    
    res.setHeader('Set-Cookie', \`spotify_refresh_token=\${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000\`);

    console.log(\`[spotify-callback] OK: Saved session \${sid} in Redis.\`);
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(successHtml);

  } catch (err) {
    const errorData = axios.isAxiosError(err) ? err.response?.data : null;
    console.error('[spotify-callback] Error exchanging token:', errorData || (err.message || err));

    if (errorData?.error === 'invalid_grant') {
      await redis.set(key, JSON.stringify({ authenticated: false, expired: true, token_error: errorData }), 'EX', 60 * 5);
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(expiredHtml);
    }

    await redis.set(key, JSON.stringify({ authenticated: false, error: 'exchange_exception', message: err.message }), 'EX', 60 * 5);
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(errorHtml("Si è verificato un errore interno. Riprova."));

  } finally {
    // 4. Always release the lock
    await redis.del(lockKey);
  }
}
