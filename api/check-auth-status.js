// File: /api/check-auth-status.js
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const sessionId = req.query.sessionId || req.query.session;
  if (!sessionId) {
    return res.status(400).json({ error: 'missing_sessionId' });
  }

  try {
    const redis = getRedis();
    const key = `session:${sessionId}`;
    const raw = await redis.get(key);

    if (!raw) {
      // Not yet authenticated, tell the client to keep polling
      return res.status(200).json({ authenticated: false });
    }

    const session = JSON.parse(raw);

    if (session.authenticated) {
      // Session data found, return tokens and delete it to prevent reuse
      const tokens = {
        access_token: session.accessToken,
        expires_in: Math.round((session.expiresAt - Date.now()) / 1000),
      };
      
      await redis.del(key);
      
      return res.status(200).json({ authenticated: true, tokens: tokens });
    } else {
      return res.status(200).json({ authenticated: false });
    }
  } catch (err) {
    console.error('[check-auth-status] redis error', err && err.message ? err.message : err);
    // IMPORTANT: Do not return 500 on Redis errors.
    // This allows the client to handle the issue and retry gracefully.
    return res.status(200).json({ authenticated: false, error: 'redis_unreachable' });
  }
}
