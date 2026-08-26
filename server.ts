import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { getRedis } from './lib/redis.js';
import { ensureSpotifyToken } from './lib/spotifySessionManager.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors({ 
    origin: true,
    credentials: true 
  }));
  app.use(express.json());
  app.use(cookieParser());

  const authStore = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of authStore.entries()) {
      if (now - value.timestamp > 15 * 60 * 1000) { // 15 minute expiry
        authStore.delete(key);
      }
    }
  }, 60 * 1000);

  app.post('/api/register-auth-session', async (req, res) => {
    const { sessionId, codeVerifier, redirectUri } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }
    const sessionData = {
      status: 'pending',
      codeVerifier,
      redirectUri,
      timestamp: Date.now()
    };
    authStore.set(String(sessionId), sessionData);
    try {
      const redis = getRedis();
      await redis.set(`spotify:auth:${sessionId}`, JSON.stringify(sessionData), 'EX', 900);
    } catch (e) {}
    res.json({ ok: true });
  });

  function parseState(rawState: any) {
    if (!rawState) return { sessionId: '', codeVerifier: null, redirectUri: null };
    const str = String(rawState).trim();
    
    if (str.startsWith('{') && str.endsWith('}')) {
      try {
        const p = JSON.parse(str);
        return { 
          sessionId: String(p.s || p.sessionId || ''), 
          codeVerifier: p.v || p.codeVerifier || null, 
          redirectUri: p.r || p.redirectUri || null 
        };
      } catch (e) {}
    }

    if (str.startsWith('%7B') || str.includes('%22')) {
      try {
        const decoded = decodeURIComponent(str);
        const p = JSON.parse(decoded);
        return { 
          sessionId: String(p.s || p.sessionId || ''), 
          codeVerifier: p.v || p.codeVerifier || null, 
          redirectUri: p.r || p.redirectUri || null 
        };
      } catch (e) {}
    }

    try {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      const jsonStr = Buffer.from(base64, 'base64').toString('utf8');
      if (jsonStr.startsWith('{') && jsonStr.endsWith('}')) {
        const p = JSON.parse(jsonStr);
        return { 
          sessionId: String(p.s || p.sessionId || ''), 
          codeVerifier: p.v || p.codeVerifier || null, 
          redirectUri: p.r || p.redirectUri || null 
        };
      }
    } catch (e) {}

    return { sessionId: str, codeVerifier: null, redirectUri: null };
  }

  app.get('/api/spotify-callback', async (req, res) => {
    const { code, state: rawState, error } = req.query;
    const { sessionId, codeVerifier, redirectUri: redirectUriFromState } = parseState(rawState);

    if (error) {
      console.error('Spotify callback error:', error);
      if (sessionId) {
        authStore.set(String(sessionId), { status: 'error', error: String(error), timestamp: Date.now() });
        const redis = getRedis();
        await redis.set(`spotify:${sessionId}`, JSON.stringify({ authenticated: false, error: String(error), timestamp: Date.now() }), 'EX', 3600).catch(() => {});
      }
      return res.sendFile(path.join(__dirname, 'callback.html'));
    }
    if (!code || !sessionId) {
      return res.sendFile(path.join(__dirname, 'callback.html'));
    }

    const sid = String(sessionId);
    let storedSession = authStore.get(sid);
    if (!storedSession) {
      try {
        const redis = getRedis();
        const raw = await redis.get(`spotify:auth:${sid}`);
        if (raw) storedSession = JSON.parse(raw);
      } catch (e) {}
    }

    const effectiveCodeVerifier = codeVerifier || storedSession?.codeVerifier || null;

    const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';
    const host = req.headers['x-forwarded-host'] || req.headers['host'] || 'localhost:3000';
    const proto = req.headers['x-forwarded-proto'] || (String(host).includes('localhost') ? 'http' : 'https');
    const dynamicRedirectUri = `${proto}://${host}/api/spotify-callback`;
    const redirectUri = redirectUriFromState || storedSession?.redirectUri || process.env.VITE_REDIRECT_URI || process.env.REDIRECT_URI || dynamicRedirectUri;

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code as string);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', clientId);
    if (effectiveCodeVerifier) {
      params.append('code_verifier', effectiveCodeVerifier);
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (clientSecret) {
      headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`;
    }

    try {
      let spotifyResponse;
      try {
        spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, { headers });
      } catch (firstErr: any) {
        // Fallback retry with dynamic redirect URI if different
        if (redirectUri !== dynamicRedirectUri) {
          console.warn(`[SPOTIFY CALLBACK] Token exchange failed with ${redirectUri}, retrying with ${dynamicRedirectUri}...`);
          params.set('redirect_uri', dynamicRedirectUri);
          spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, { headers });
        } else {
          throw firstErr;
        }
      }
      
      const { access_token, refresh_token, expires_in } = spotifyResponse.data;
      const expires_at = Date.now() + (expires_in * 1000);

      // Check for premium account (soft check, don't fail on rate-limit/network)
      try {
        const userRes = await axios.get('https://api.spotify.com/v1/me', {
          headers: { 'Authorization': `Bearer ${access_token}` },
          timeout: 4000
        });
        const userData = userRes.data;
        if (userData?.product && userData.product !== 'premium' && userData.product !== 'open') {
          console.log(`[SPOTIFY CALLBACK] Account product type for session ${sid}: ${userData.product}`);
        }
      } catch (userErr) {
        console.warn(`[SPOTIFY CALLBACK] Warning: User check soft error for session ${sid}, proceeding.`);
      }

      // Securely set the refresh token in an HttpOnly cookie
      if (refresh_token) {
        let cookieString = `spotify_refresh_token=${refresh_token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=31536000`;
        if (process.env.NODE_ENV === 'production') {
          cookieString += '; Secure';
        }
        res.setHeader('Set-Cookie', cookieString);
      }

      // Store in memory
      authStore.set(sid, { 
        status: 'completed', 
        tokens: { 
          access_token, 
          refresh_token,
          expires_in,
          expires_at
        }, 
        timestamp: Date.now() 
      });

      // Store in Redis / session manager
      const redis = getRedis();
      await redis.set(`spotify:${sid}`, JSON.stringify({
        authenticated: true,
        access_token,
        refresh_token,
        expires_at,
        created_at: Date.now()
      }), 'EX', 60 * 60 * 24 * 30).catch(() => {});
      
      console.log(`[SPOTIFY CALLBACK] Successfully authenticated session: ${sid}`);
      return res.sendFile(path.join(__dirname, 'callback.html'));

    } catch (exchangeError: any) {
      console.error('Error exchanging token:', exchangeError.response ? exchangeError.response.data : exchangeError.message);
      authStore.set(sid, { status: 'error', error: 'auth_failed', timestamp: Date.now() });
      return res.sendFile(path.join(__dirname, 'callback.html'));
    }
  });

  app.get('/api/check-auth-status', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }

    const sid = String(sessionId);
    const sessionData = authStore.get(sid);

    if (sessionData && sessionData.status === 'completed' && sessionData.tokens?.access_token) {
      return res.status(200).json({ 
        authenticated: true, 
        status: 'completed',
        access_token: sessionData.tokens.access_token,
        expires_at: sessionData.tokens.expires_at,
        tokens: sessionData.tokens
      });
    }

    if (sessionData && sessionData.status === 'error') {
      return res.status(200).json({
        authenticated: false,
        error: sessionData.error
      });
    }

    // Check Redis / storage
    try {
      const redis = getRedis();
      const raw = await redis.get(`spotify:${sid}`);
      if (raw) {
        let parsed;
        if (typeof raw === 'string') {
          try { parsed = JSON.parse(raw); } catch (e) { parsed = null; }
        } else {
          parsed = raw;
        }
        if (parsed && parsed.authenticated && parsed.access_token) {
          authStore.set(sid, { status: 'completed', tokens: parsed, timestamp: Date.now() });
          return res.status(200).json({
            authenticated: true,
            status: 'completed',
            access_token: parsed.access_token,
            expires_at: parsed.expires_at,
            tokens: parsed
          });
        }
        if (parsed.error) {
          return res.status(200).json({
            authenticated: false,
            error: parsed.error
          });
        }
      }
    } catch (e) {
      console.warn('[CHECK-AUTH] Redis check notice:', e);
    }

    return res.status(200).json({ authenticated: false });
  });
  
  app.post('/api/refresh-token', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || req.body?.sessionId || req.query?.sessionId;
    
    if (sessionId) {
      try {
        const updated = await ensureSpotifyToken(String(sessionId));
        if (updated && updated.access_token) {
          const expires_in = Math.max(0, Math.round(((updated.expires_at || Date.now()) - Date.now()) / 1000));
          return res.status(200).json({
            access_token: updated.access_token,
            expires_at: updated.expires_at,
            expires_in
          });
        }
      } catch (err: any) {
        console.error('Error refreshing token via session manager:', err?.message || err);
      }
    }

    // Fallback to cookie
    const refreshToken = req.cookies?.spotify_refresh_token;
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
        let cookieString = `spotify_refresh_token=${newRefreshToken}; HttpOnly; Path=/; SameSite=Lax; Max-Age=31536000`;
        if (process.env.NODE_ENV === 'production') {
          cookieString += '; Secure';
        }
        res.setHeader('Set-Cookie', cookieString);
      }
      res.status(200).json({ access_token, expires_in, expires_at: Date.now() + (expires_in * 1000) });
    } catch (error: any) {
      console.error('Error refreshing token:', error.response ? error.response.data : error.message);
      res.status(error.response?.status || 500).json({ error: 'Failed to refresh token' });
    }
  });

  app.post('/api/logout', (req, res) => {
    let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (process.env.NODE_ENV === 'production') {
      cookieString += '; Secure';
    }
    res.setHeader('Set-Cookie', cookieString);
    res.status(200).json({ message: 'Logged out successfully' });
  });

  app.put('/api/play', async (req, res) => {
    const sessionId = req.headers['x-session-id'] || req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

    let accessToken: string | null = null;
    const sessionData = authStore.get(String(sessionId));
    if (sessionData && sessionData.status === 'completed' && sessionData.tokens?.access_token) {
      accessToken = sessionData.tokens.access_token;
    } else {
      const session = await ensureSpotifyToken(String(sessionId));
      if (session && session.access_token) {
        accessToken = session.access_token;
      }
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'no_session_or_invalid_token' });
    }

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

    let accessToken: string | null = null;
    const sessionData = authStore.get(String(sessionId));
    if (sessionData && sessionData.status === 'completed' && sessionData.tokens?.access_token) {
      accessToken = sessionData.tokens.access_token;
    } else {
      const session = await ensureSpotifyToken(String(sessionId));
      if (session && session.access_token) {
        accessToken = session.access_token;
      }
    }

    if (!accessToken) {
      return res.status(401).json({ error: 'no_session_or_invalid_token' });
    }

    const url = 'https://api.spotify.com/v1/me/player';

    try {
      console.log('▶️ [PROXY TRANSFER] Calling spotify /v1/me/player for device', device_id);
      const spotifyRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ device_ids: [device_id], play: req.body.play !== undefined ? req.body.play : false })
      });

      if (spotifyRes.status === 204 || spotifyRes.status === 200) {
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
