// File: /api/check-auth-status.js
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const sessionId = req.query?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

  // 1. First, check Redis directly for any explicit error states to avoid race conditions with token manager
  const redis = getRedis();
  const raw = await redis.get(`spotify:${sessionId}`);
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p.error === 'premium_required') {
          return res.status(200).json({ authenticated: false, error: 'premium_required' });
      }
      if (p.expired) return res.status(200).json({ authenticated: false, expired: true });
    } catch(e){}
  }

  // 2. If no explicit error, try to get/refresh token
  const updated = await ensureSpotifyToken(sessionId);

  if (updated && updated.access_token) {
    return res.status(200).json({ 
      authenticated: true, 
      access_token: updated.access_token,
      expires_at: updated.expires_at 
    });
  }

  return res.status(200).json({ authenticated: false });
}