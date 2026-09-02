// File: /api/check-auth-status.js
import { getSession, setSession, getRelaySession } from '../lib/sessionStore.js';
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  // Set CORS headers for cross-origin infotainment polling
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

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
          status: 'error',
          error: session.error
        });
      }

      if (session.access_token) {
        const expiresIn = session.expires_at 
          ? Math.max(60, Math.floor((session.expires_at - Date.now()) / 1000)) 
          : (session.expires_in || 3600);

        return res.status(200).json({
          authenticated: true,
          status: 'completed',
          access_token: session.access_token,
          refresh_token: session.refresh_token || null,
          expires_at: session.expires_at || (Date.now() + expiresIn * 1000),
          expires_in: expiresIn
        });
      }

      if (session.status === 'scanned' || session.authorizing || session.status === 'authorizing') {
        return res.status(200).json({
          authenticated: false,
          status: 'scanned',
          message: 'Codice scansionato! Autorizzazione in corso...'
        });
      }
    }

    // 3. Fallback session manager (for automatic token refresh)
    if (sessionId) {
      try {
        const updated = await ensureSpotifyToken(sessionId);
        if (updated && updated.access_token) {
          const expiresIn = updated.expires_at 
            ? Math.max(60, Math.floor((updated.expires_at - Date.now()) / 1000)) 
            : 3600;

          return res.status(200).json({
            authenticated: true,
            status: 'completed',
            access_token: updated.access_token,
            refresh_token: updated.refresh_token || null,
            expires_at: updated.expires_at || (Date.now() + expiresIn * 1000),
            expires_in: expiresIn
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
