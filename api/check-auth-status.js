// File: /api/check-auth-status.js
import { getSession } from '../lib/sessionStore.js';
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  // Prevent any CDN/browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const sessionId = req.query?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

    // 1. Check native session store
    const session = getSession(`spotify:${sessionId}`) || getSession(sessionId);
    if (session) {
      if (session.error) {
        console.log(`[POLLING API] Session error for ${sessionId}: ${session.error}`);
        return res.status(200).json({
          authenticated: false,
          error: session.error
        });
      }

      if (session.access_token) {
        console.log(`[POLLING API] Session authenticated for ${sessionId}`);
        return res.status(200).json({
          authenticated: true,
          access_token: session.access_token,
          expires_at: session.expires_at,
          expires_in: session.expires_at ? Math.max(60, Math.floor((session.expires_at - Date.now()) / 1000)) : 3600
        });
      }
    }

    // 2. Fallback session manager (for automatic token refresh)
    try {
      const updated = await ensureSpotifyToken(sessionId);
      if (updated && updated.access_token) {
        return res.status(200).json({
          authenticated: true,
          access_token: updated.access_token,
          expires_at: updated.expires_at,
          expires_in: updated.expires_at ? Math.max(60, Math.floor((updated.expires_at - Date.now()) / 1000)) : 3600
        });
      }
    } catch (mgrErr) {
      console.warn('[POLLING API] Session manager notice:', mgrErr?.message || mgrErr);
    }

    // Default: waiting for QR code authorization
    return res.status(200).json({ authenticated: false, status: 'pending' });
  } catch (err) {
    console.error('[POLLING API] Uncaught handler error:', err);
    return res.status(200).json({ authenticated: false, status: 'pending' });
  }
}
