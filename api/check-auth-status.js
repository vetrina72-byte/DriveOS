
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

    const redis = getRedis();
    
    try {
      if (!redis) {
        console.warn("[POLLING API] Database non configurato, fallback assente.");
        return res.status(500).json({ error: 'redis_missing', details: 'Redis non disponibile' });
      }

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
            console.log(`[POLLING API] Trovata sessione per ${sessionId}:`, p.error ? `Errore: ${p.error}` : 'Successo');
            
            if (p.error) {
                return res.status(200).json({ 
                  authenticated: false, 
                  error: p.error 
                });
            }

            if (p.access_token) {
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
    } catch(e) {
      console.error("[POLLING API] Errore lettura Redis:", e);
      return res.status(500).json({ error: 'redis_fetch_failed', details: e.message || e });
    }

    // Fallback manager
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
      console.warn('[POLLING API] session manager notice:', mgrErr?.message || mgrErr);
    }

    return res.status(200).json({ authenticated: false });
  } catch (err) {
    console.error('[POLLING API] Uncaught handler error:', err);
    return res.status(200).json({ authenticated: false });
  }
}

