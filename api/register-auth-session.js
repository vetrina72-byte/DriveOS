// File: /api/register-auth-session.js
import { setSession, createRelaySession } from '../lib/sessionStore.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, codeVerifier, redirectUri, authUrl, relayId: existingRelayId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    // Create cloud relay object for cross-instance sync on Vercel Serverless
    let relayId = existingRelayId || null;
    if (!relayId) {
      relayId = await createRelaySession(sessionId, { status: 'pending', redirectUri });
    }

    const sessionData = {
      status: 'pending',
      codeVerifier,
      redirectUri,
      authUrl,
      relayId,
      timestamp: Date.now()
    };

    // Save in native session store with 15-minute expiry
    setSession(`spotify:auth:${sessionId}`, sessionData, 15 * 60);

    return res.status(200).json({ ok: true, relayId });
  } catch (err) {
    console.error('[register-auth-session] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
