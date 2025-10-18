// File: /api/spotify-callback.js
import axios from 'axios';
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;

  if (error) {
    console.error(`[spotify-callback] Spotify returned an error: ${error}`);
    return res.status(400).send(`<h1>Authentication Error</h1><p>Spotify returned an error: ${error}</p>`);
  }
  if (!code || !sessionId) {
    return res.status(400).send('<h1>Authentication Error</h1><p>Missing required parameters (code or session ID).</p>');
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !VITE_REDIRECT_URI) {
    console.error('SERVER ERROR: Spotify environment variables are not configured on Vercel.');
    return res.status(500).send('<h1>Server Error</h1><p>Application is not configured correctly.</p>');
  }

  const redis = getRedis();
  const key = `session:${sessionId}`;

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: VITE_REDIRECT_URI,
      client_id: SPOTIFY_CLIENT_ID,
      client_secret: SPOTIFY_CLIENT_SECRET,
    });

    const tokenResp = await axios.post(TOKEN_URL, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      timeout: 15000,
    });

    // This part is only reached if the request succeeds (status 2xx)
    const { access_token, refresh_token, expires_in } = tokenResp.data;

    // Save session to Redis ONLY after a successful exchange
    const payload = {
      authenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000,
    };
    await redis.set(key, JSON.stringify(payload), 'EX', 60 * 60 * 24); // 24h TTL
    console.log(`[spotify-callback] Saved session ${sessionId}`);

    // Set HttpOnly cookie for secure, subsequent token refreshes
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);

    // Respond with a user-friendly success page to the user's phone.
    res.setHeader('Content-Type', 'text/html');
    res.status(200).sendFile(path.join(__dirname, '..', '..', 'callback.html'));

  } catch (err) {
    console.error('[spotify-callback] Error exchanging token:', axios.isAxiosError(err) && err.response ? err.response.data : (err.message || err));
    
    // Check if the error is from Spotify and is 'invalid_grant'
    if (axios.isAxiosError(err) && err.response?.data?.error === 'invalid_grant') {
      // Save expired state to Redis so the client can react
      await redis.set(key, JSON.stringify({
        authenticated: false,
        error: 'token_exchange_failed',
        token_error: { error: 'invalid_grant', error_description: 'Authorization code expired' }
      }), 'EX', 300); // Expire in 5 minutes

      // Respond with user-friendly error page for the phone
      return res.status(200).send(`
        <html>
          <head>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>Accesso Scaduto</title>
            <style>
              body { display: flex; align-items: center; justify-content: center; height: 100vh; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif; text-align: center; padding: 2rem; }
              .container { max-width: 380px; }
              h2 { font-size: 1.5rem; font-weight: 600; }
              p { color: #aaa; font-size: 1rem; line-height: 1.5; }
              button { margin-top: 2rem; padding: 0.75rem 1.5rem; border: none; border-radius: 50px; background: #1DB954; color: #fff; font-weight: 600; cursor: pointer; }
            </style>
          </head>
          <body>
            <div class="container">
              <h2>Accesso non completato</h2>
              <p>Il codice di autorizzazione è scaduto. Verrà generato un nuovo QR code sul tuo infotainment. Scansionalo di nuovo per continuare.</p>
              <button onclick="window.close()">Chiudi</button>
            </div>
          </body>
        </html>
      `);
    }
    
    // For other errors (network timeout, etc.)
    try {
      await redis.set(key, JSON.stringify({
        authenticated: false,
        error: 'exchange_exception',
        message: err.message
      }), 'EX', 300);
    } catch (redisErr) {
      console.error('[spotify-callback] Failed to write generic error state to Redis:', redisErr);
    }
    
    return res.status(500).send('<h1>Errore Interno</h1><p>Si è verificato un errore imprevisto durante l\'autenticazione.</p>');
  }
}
