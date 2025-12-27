// File: /api/check-auth-status.js
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const sessionId = req.query?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

  const redis = getRedis();
  
  // 1. Controlla stati di errore espliciti salvati dal callback
  try {
    const raw = await redis.get(`spotify:${sessionId}`);
    if (raw) {
      const p = JSON.parse(raw);
      if (p.error === 'premium_required') {
          return res.status(200).json({ authenticated: false, error: 'premium_required' });
      }
      if (p.error) {
          return res.status(200).json({ authenticated: false, error: p.error });
      }
    }
  } catch(e) {}

  // 2. Se non c'è errore, prova a gestire il token normale
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