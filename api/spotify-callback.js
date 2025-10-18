// File: /api/spotify-callback.js
import authStore from './_auth-cache.js';
import axios from 'axios';

export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;

  if (error) {
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
  
  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', VITE_REDIRECT_URI);

  try {
    const spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
        },
    });
    
    const { access_token, refresh_token, expires_in } = spotifyResponse.data;

    // Set HttpOnly cookie for refresh token for secure, subsequent token refreshes
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);

    // Store access token in KV store for the client to poll and fetch
    await authStore.set(sessionId, { 
        status: 'completed', 
        tokens: { access_token, expires_in } 
    });

    // Respond with a user-friendly success page to the user's phone.
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!doctype html>
      <html>
      <head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <title>Accesso completato</title>
      <style>
        body{display:flex;align-items:center;justify-content:center;height:100vh;background:#0b0b0c;color:#fff;font-family:system-ui,Segoe UI;}
        .card{width:90%;max-width:420px;padding:24px;border-radius:12px;text-align:center;background:linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01));backdrop-filter: blur(6px);}
        .spinner{width:64px;height:64px;border-radius:50%;border:6px solid rgba(255,255,255,0.08);border-top-color:#1DB954;animation:spin 1s linear infinite;margin:12px auto;}
        @keyframes spin{to{transform:rotate(360deg)}}
        button{margin-top:10px;padding:10px 16px;border-radius:8px;border:0;background:#1DB954;color:#000;font-weight:700}
      </style>
      </head>
      <body>
        <div class="card">
          <div class="spinner"></div>
          <h2>Accesso completato</h2>
          <p>Hai eseguito l'accesso con successo. Torna al tuo infotainment: verrà aggiornato automaticamente.</p>
          <button onclick="window.close()">Chiudi</button>
        </div>
        <script>setTimeout(() => window.close(), 3000);</script>
      </body>
      </html>
    `);

  } catch (exchangeError) {
    console.error('Error exchanging token:', exchangeError.response ? exchangeError.response.data : exchangeError.message);
    res.status(500).send('<h1>Authentication Failed</h1><p>Could not exchange the authorization code for an access token.</p>');
  }
}
