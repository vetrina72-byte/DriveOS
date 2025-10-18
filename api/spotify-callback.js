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

    if (tokenResp.status !== 200) {
      console.error('[spotify-callback] Token exchange failed', tokenResp.status, tokenResp.data);
      return res.status(502).send('Spotify token exchange failed');
    }

    const { access_token, refresh_token, expires_in } = tokenResp.data;

    // Save session to Redis
    const redis = getRedis();
    const key = `session:${sessionId}`;
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
    res.status(200).send(`
      <html><body style="font-family:sans-serif;text-align:center;padding:2rem">
        <h2>✅ Accesso completato</h2>
        <p>Puoi chiudere questa finestra. L'infotainment si aggiornerà automaticamente.</p>
        <script>setTimeout(()=>window.close(),2500)</script>
      </body></html>
    `);

  } catch (err) {
    console.error('[spotify-callback] Error exchanging token:', err.response ? err.response.data : (err.message || err));
    return res.status(500).send('Internal error during Spotify callback');
  }
}
