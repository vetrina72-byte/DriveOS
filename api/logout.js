// File: /api/logout.js
import { deleteSession, getSession, setSession, updateRelaySession } from '../lib/sessionStore.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-id');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const sessionId = req.headers['x-session-id'] || req.body?.sessionId || req.query?.sessionId;
  const relayId = req.body?.relayId || req.query?.relayId;

  if (sessionId) {
    try {
      const existing = getSession(`spotify:${sessionId}`) || getSession(sessionId);
      deleteSession(`spotify:${sessionId}`);
      deleteSession(sessionId);
      deleteSession(`spotify:auth:${sessionId}`);

      const targetRelay = relayId || existing?.relayId;
      if (targetRelay) {
        await updateRelaySession(targetRelay, {
          authenticated: false,
          loggedOut: true,
          access_token: null,
          status: 'logged_out',
          updatedAt: Date.now()
        });
      }
    } catch (err) {
      console.warn('[LOGOUT] Session deletion warning:', err);
    }
  }

  // Clear HTTP-only cookie
  let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
  if (process.env.NODE_ENV === 'production') {
    cookieString += '; Secure';
  }
  res.setHeader('Set-Cookie', cookieString);

  return res.status(200).json({ 
    success: true, 
    message: 'Disconnessione completata con successo' 
  });
}
