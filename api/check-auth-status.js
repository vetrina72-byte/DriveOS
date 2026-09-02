
// File: /api/check-auth-status.js
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  // Prevent any CDN/browser 304 caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const sessionId = req.query?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

    // 1. Try reading from Redis (with try/catch to intercept ENOTFOUND / DNS / connection issues)
    try {
      const redis = getRedis();
      if (redis) {
        const raw = await redis.get(`spotify:${sessionId}`);
        if (raw) {
          let p;
          if (typeof raw === 'string') {
            try { p = JSON.parse(raw); } catch (e) { p = null; }
          } else {
            p = raw;
          }

          if (p) {
            if (p.error) {
              console.log(`[POLLING API] Session error for ${sessionId}: ${p.error}`);
              return res.status(200).json({ 
                authenticated: false, 
                error: p.error 
              });
            }

            if (p.access_token) {
              console.log(`[POLLING API] Session authenticated for ${sessionId}`);
              return res.status(200).json({ 
                authenticated: true, 
                access_token: p.access_token, 
                expires_at: p.expires_at,
                expires_in: p.expires_at ? Math.max(60, Math.floor((p.expires_at - Date.now()) / 1000)) : 3600
              });
            }
          }
        }
      }
    } catch (redisErr) {
      // Intercept ENOTFOUND or Redis network error without returning 500
      console.warn('[POLLING API] Redis access notice (continuing with local fallback):', redisErr?.code || redisErr?.message || redisErr);
    }

    // 2. In-memory global cache check (guarantees cross-function lookup if Redis fails)
    try {
      if (globalThis.__driveos_redis_fallback_cache__) {
        const entry = globalThis.__driveos_redis_fallback_cache__.get(`spotify:${sessionId}`);
        if (entry && entry.value) {
          const p = typeof entry.value === 'string' ? JSON.parse(entry.value) : entry.value;
          if (p && p.access_token) {
            return res.status(200).json({
              authenticated: true,
              access_token: p.access_token,
              expires_at: p.expires_at,
              expires_in: p.expires_at ? Math.max(60, Math.floor((p.expires_at - Date.now()) / 1000)) : 3600
            });
          }
        }
      }
    } catch (cacheErr) {
      console.warn('[POLLING API] Memory cache notice:', cacheErr?.message || cacheErr);
    }

    // 3. Fallback session manager
    try {
      const updated = await ensureSpotifyToken(sessionId);
      if (updated && updated.access_token) {
        return res.status(200).json({ 
          authenticated: true, 
          access_token: updated.access_token, 
          expires_at: updated.expires_at 
        });
      }
    } catch (mgrErr) {
      console.warn('[POLLING API] Session manager notice:', mgrErr?.message || mgrErr);
    }

    // Default polling in progress (waiting for QR code authorization)
    return res.status(200).json({ authenticated: false, status: 'pending' });
  } catch (err) {
    console.error('[POLLING API] Uncaught handler error:', err);
    return res.status(200).json({ authenticated: false, status: 'pending' });
  }
}

