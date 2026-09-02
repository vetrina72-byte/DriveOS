// File: /api/check-auth-status.js
import { getSession, setSession, getRelaySession } from '../lib/sessionStore.js';
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  // Prevent any CDN/browser caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const sessionId = req.query?.sessionId;
    const relayId = req.query?.relayId || req.query?.k;
    
    if (!sessionId && !relayId) {
      return res.status(400).json({ error: 'missing_sessionId' });
    }

    // 1. Check native local session store
    let session = sessionId ? (getSession(`spotify:${sessionId}`) || getSession(sessionId)) : null;
    
    // 2. If not found in local container memory, check the cloud relay (cross-instance sync on Vercel)
    if (!session || !session.access_token) {
      let targetRelayId = relayId;
      if (!targetRelayId && sessionId) {
        const storedAuth = getSession(`spotify:auth:${sessionId}`);
        targetRelayId = storedAuth?.relayId;
      }

      if (targetRelayId) {
        try {
          const relayData = await getRelaySession(targetRelayId);
          if (relayData && relayData.access_token) {
            session = relayData;
            // Cache locally in this container for subsequent fast hits
            if (sessionId) {
              setSession(`spotify:${sessionId}`, relayData, 30 * 24 * 3600);
            }
          } else if (relayData && relayData.error) {
            session = relayData;
          }
        } catch (e) {}
      }
    }

    if (session) {
      if (session.error) {
        return res.status(200).json({
          authenticated: false,
          error: session.error
        });
      }

      if (session.access_token) {
        return res.status(200).json({
          authenticated: true,
          access_token: session.access_token,
          expires_at: session.expires_at,
          expires_in: session.expires_at ? Math.max(60, Math.floor((session.expires_at - Date.now()) / 1000)) : 3600
        });
      }
    }

    // 3. Fallback session manager (for automatic token refresh)
    if (sessionId) {
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
      } catch (mgrErr) {}
    }

    // Default: waiting for authorization
    return res.status(200).json({ authenticated: false, status: 'pending' });
  } catch (err) {
    console.error('[POLLING API] Uncaught handler error:', err);
    return res.status(200).json({ authenticated: false, status: 'pending' });
  }
}
