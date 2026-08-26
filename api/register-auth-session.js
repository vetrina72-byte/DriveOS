import { getRedis } from '../lib/redis.js';

// In-memory fallback map for serverless execution context
const memoryAuthCache = globalThis._memoryAuthCache || (globalThis._memoryAuthCache = new Map());

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, codeVerifier, redirectUri } = req.body || {};
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing sessionId' });
    }

    const sessionData = {
      status: 'pending',
      codeVerifier,
      redirectUri,
      timestamp: Date.now()
    };

    memoryAuthCache.set(String(sessionId), sessionData);

    try {
      const redis = getRedis();
      if (redis) {
        await redis.set(`spotify:auth:${sessionId}`, JSON.stringify(sessionData), 'EX', 900);
      }
    } catch (e) {
      console.warn('[register-auth-session] Redis notice:', e?.message || e);
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[register-auth-session] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
