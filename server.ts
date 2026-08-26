import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ 
    origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || 'https://tuo-dominio.vercel.app') : 'http://localhost:5173', 
    credentials: true 
  }));
  app.use(express.json());
  app.use(cookieParser());

  const authStore = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of authStore.entries()) {
      if (now - value.timestamp > 5 * 60 * 1000) { // 5 minute expiry
        authStore.delete(key);
      }
    }
  }, 60 * 1000);

  app.get('/api/spotify-callback', async (req, res) => {
    const { code, state: sessionId, error } = req.query;

    if (error) {
        console.error('Spotify callback error:', error);
        return res.sendFile(path.join(__dirname, 'callback.html'));
    }
    if (!code || !sessionId) {
        return res.sendFile(path.join(__dirname, 'callback.html'));
    }

    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
    const dynamicRedirectUri = `${proto}://${host}/api/spotify-callback`;
    const redirectUri = process.env.VITE_REDIRECT_URI || process.env.REDIRECT_URI || dynamicRedirectUri;

    const authHeader = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code as string);
    params.append('redirect_uri', redirectUri);

    try {
        const spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader,
            },
        });
        
        const { access_token, refresh_token, expires_in } = spotifyResponse.data;

        // Check for premium account
        try {
            const userRes = await axios.get('https://api.spotify.com/v1/me', {
                headers: { 'Authorization': `Bearer ${access_token}` }
            });
            const userData = userRes.data;
            
            if (!userData.product || userData.product !== 'premium') {
                console.log(`[SPOTIFY CALLBACK] Account NON premium per session: ${sessionId} (Product: ${userData.product})`);
                authStore.set(sessionId, { status: 'error', error: 'premium_required', timestamp: Date.now() });
                return res.sendFile(path.join(__dirname, 'callback.html'));
            }
        } catch (userErr) {
            console.error(`[SPOTIFY CALLBACK] User Fetch Failed for session: ${sessionId}. Mapping to Premium Required.`);
            authStore.set(sessionId, { status: 'error', error: 'premium_required', timestamp: Date.now() });
            return res.sendFile(path.join(__dirname, 'callback.html'));
        }

        // Securely set the refresh token in an HttpOnly cookie
        let cookieString = `spotify_refresh_token=${refresh_token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=31536000`;
        if (process.env.NODE_ENV === 'production') {
            cookieString += '; Secure';
        }
        res.setHeader('Set-Cookie', cookieString);

        // Store the access token for the client to fetch via polling
        authStore.set(sessionId, { 
          status: 'completed', 
          tokens: { 
            access_token, 
            expires_in,
            expires_at: Date.now() + (expires_in * 1000)
          }, 
          timestamp: Date.now() 
        });
        
        // Send the success page to the user's phone
        res.sendFile(path.join(__dirname, 'callback.html'));

    } catch (exchangeError: any) {
        console.error('Error exchanging token:', exchangeError.response ? exchangeError.response.data : exchangeError.message);
        authStore.set(sessionId, { status: 'error', error: 'premium_required', timestamp: Date.now() });
        res.sendFile(path.join(__dirname, 'callback.html'));
    }
  });

  app.get('/api/check-auth-status', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }
    const sessionData = authStore.get(sessionId);

    if (sessionData && sessionData.status === 'completed') {
      res.status(200).json({ 
        authenticated: true, 
        access_token: sessionData.tokens.access_token,
        expires_at: sessionData.tokens.expires_at
      });
    } else if (sessionData && sessionData.status === 'error') {
      res.status(200).json({
        authenticated: false,
        error: sessionData.error
      });
    } else {
      res.status(200).json({ authenticated: false });
    }
  });
  
  app.post('/api/refresh-token', async (req, res) => {
    const { spotify_refresh_token: refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }
    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
    const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    try {
      const spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
        },
      });
      const { access_token, expires_in, refresh_token: newRefreshToken } = spotifyResponse.data;
      if (newRefreshToken) {
        let cookieString = `spotify_refresh_token=${newRefreshToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=31536000`;
        if (process.env.NODE_ENV === 'production') {
            cookieString += '; Secure';
        }
        res.setHeader('Set-Cookie', cookieString);
      }
      res.status(200).json({ access_token, expires_in });
    } catch (error: any) {
      console.error('Error refreshing token:', error.response ? error.response.data : error.message);
       if (error.response?.data?.error === 'invalid_grant') {
            let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
            if (process.env.NODE_ENV === 'production') {
                cookieString += '; Secure';
            }
            res.setHeader('Set-Cookie', cookieString);
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
      res.status(error.response?.status || 500).json({ error: 'Failed to refresh token' });
    }
  });

  app.post('/api/logout', (req, res) => {
    let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (process.env.NODE_ENV === 'production') {
        cookieString += '; Secure';
    }
    res.setHeader('Set-Cookie', cookieString);
    res.status(200).json({ message: 'Logged out successfully' });
  });

  app.put('/api/play', async (req, res) => {
    const sessionId = req.headers['x-session-id'];
    if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

    const sessionData = authStore.get(sessionId);
    if (!sessionData || sessionData.status !== 'completed') {
      return res.status(401).json({ error: 'no_session_or_invalid_token' });
    }

    const accessToken = sessionData.tokens.access_token;
    const { deviceId, body } = req.body;
    const url = deviceId ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` : `https://api.spotify.com/v1/me/player/play`;

    try {
      console.log(`▶️ [PROXY PLAY] Request to Spotify (${deviceId ? 'Device Specific' : 'Active Device'})`);
      
      const spotifyRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body || {})
      });

      if (!spotifyRes.ok) {
          const text = await spotifyRes.text();
          console.error(`❌ [PROXY PLAY] Failed: ${spotifyRes.status} - ${text}`);
          
          try {
              const errJson = JSON.parse(text);
              if (errJson.error?.reason === 'NO_ACTIVE_DEVICE') {
                  return res.status(404).json({ error: 'no_active_device' });
              }
          } catch(e) {}

          return res.status(spotifyRes.status).send(text);
      }

      return res.status(204).send('');
    } catch (e: any) {
      console.error(`🔥 [PROXY PLAY] Exception:`, e.message);
      return res.status(500).json({error: 'proxy_exception'});
    }
  });

  app.post('/api/transfer-player', async (req, res) => {
    const { sessionId, device_id } = req.body;

    if (!sessionId) return res.status(400).json({ error: 'missing_session_id' });
    if (!device_id) return res.status(400).json({ error: 'missing_device_id' });

    const sessionData = authStore.get(sessionId);
    if (!sessionData || sessionData.status !== 'completed') {
      return res.status(401).json({ error: 'no_session_or_invalid_token' });
    }

    const accessToken = sessionData.tokens.access_token;
    const url = 'https://api.spotify.com/v1/me/player';

    try {
      console.log('▶️ [PROXY TRANSFER] Calling spotify /v1/me/player for device', device_id);
      const spotifyRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_ids: [device_id], play: req.body.play !== undefined ? req.body.play : true })
      });

      if (spotifyRes.status === 204) {
        return res.status(200).json({ ok: true });
      }

      const text = await spotifyRes.text();
      console.warn(`▶️ [PROXY TRANSFER] failed ${spotifyRes.status} ${text}`);
      res.setHeader('Content-Type', 'application/json');
      return res.status(spotifyRes.status).send(text || `{ "error": "transfer_failed", "status": ${spotifyRes.status} }`);
    } catch (e: any) {
      console.error('❌ [PROXY TRANSFER] exception', e.message);
      return res.status(500).json({ error: 'proxy_failed' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
