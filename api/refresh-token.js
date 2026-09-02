// File: /api/refresh-token.js
import { getSession, setSession } from '../lib/sessionStore.js';
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');

  const sessionId = req.headers['x-session-id'] || req.query?.sessionId || req.body?.sessionId;
  const refreshToken = req.body?.refreshToken || req.query?.refreshToken || req.body?.refresh_token;

  if (!sessionId && !refreshToken) {
    console.error('❌ [REFRESH-ENDPOINT] Request missing sessionId and refreshToken');
    return res.status(400).json({ error: 'missing_session_or_refresh_token' });
  }

  console.log(`🔄 [REFRESH-ENDPOINT] Refresh request for session=${sessionId || 'direct-token'}`);

  // 1. Try session manager refresh
  const updated = await ensureSpotifyToken(sessionId, refreshToken);

  if (updated && updated.access_token) {
    const expires_in = Math.max(0, Math.round(((updated.expires_at || Date.now()) - Date.now()) / 1000));
    return res.status(200).json({ 
      authenticated: true,
      access_token: updated.access_token, 
      refresh_token: updated.refresh_token || null,
      expires_at: updated.expires_at,
      expires_in: expires_in
    });
  }

  // 2. Direct Spotify refresh fallback if refreshToken is provided
  if (refreshToken) {
    try {
      const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
      const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';

      const bodyParams = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: CLIENT_ID
      });

      const headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
      if (CLIENT_SECRET) {
        headers['Authorization'] = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
      }

      const sResp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers,
        body: bodyParams.toString()
      });

      const sData = await sResp.json();
      if (sResp.ok && sData.access_token) {
        const expires_in = sData.expires_in || 3600;
        const expires_at = Date.now() + expires_in * 1000;
        const payload = {
          authenticated: true,
          access_token: sData.access_token,
          refresh_token: sData.refresh_token || refreshToken,
          expires_at,
          expires_in
        };
        if (sessionId) {
          setSession(`spotify:${sessionId}`, payload, 30 * 24 * 3600);
        }
        return res.status(200).json(payload);
      }
    } catch (dErr) {
      console.error('❌ [REFRESH-ENDPOINT] Direct Spotify refresh failed:', dErr);
    }
  }

  const session = sessionId ? (getSession(`spotify:${sessionId}`) || getSession(sessionId)) : null;

  if (session && session.expired) {
    console.log(`⛔ [REFRESH-ENDPOINT] Session marked expired for ${sessionId}`);
    return res.status(401).json({ error: 'invalid_grant', description: 'Refresh token invalid or revoked' });
  }

  console.log(`❌ [REFRESH-ENDPOINT] Nessuna session valida trovata per ${sessionId}`);
  return res.status(401).json({ error: 'session_not_found_or_expired' });
}

