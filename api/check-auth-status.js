// File: /api/check-auth-status.js
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const sessionId = req.query?.sessionId;
  console.log(`📡 [CHECK-AUTH] Verifica per session=${sessionId}`);

  if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

  const updated = await ensureSpotifyToken(sessionId);

  if (updated && updated.access_token) {
    return res.status(200).json({ 
      authenticated: true, 
      access_token: updated.access_token,
      expires_at: updated.expires_at 
    });
  }

  // if null/expired from token manager, double check redis
  const redis = getRedis();
  const raw = await redis.get(`spotify:${sessionId}`);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p.expired) return res.status(200).json({ authenticated: false, expired: true });
    } catch(e){}
  }

  // No session found yet, client should keep polling.
  return res.status(200).json({ authenticated: false });
}