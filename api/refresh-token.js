
import { getRedis } from '../lib/redis.js';
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    console.error('❌ [REFRESH-ENDPOINT] Request di refresh per session=undefined');
    return res.status(400).json({ error: 'missing_session_id' });
  }

  console.log(`🔄 [REFRESH-ENDPOINT] Request di refresh per session=${sessionId}`);

  const updated = await ensureSpotifyToken(sessionId);

  if (updated && updated.access_token) {
    const expires_in = Math.round((updated.expires_at - Date.now()) / 1000);
    return res.status(200).json({ 
      access_token: updated.access_token, 
      expires_at: updated.expires_at,
      expires_in: expires_in
    });
  }

  const redis = getRedis();
  const raw = await redis.get(`spotify:${sessionId}`);

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.expired) {
        console.log(`⛔ [REFRESH-ENDPOINT] Session marked expired for ${sessionId}`);
        return res.status(401).json({ error: 'invalid_grant', description: 'Refresh token invalid or revoked' });
      }
      console.log(`⚠️ [REFRESH-ENDPOINT] Refresh non effettuato ora per ${sessionId}, ritenta tra poco`);
      return res.status(503).json({ error: 'refresh_failed_try_again' });
    } catch(e){}
  }

  console.log(`❌ [REFRESH-ENDPOINT] Nessuna session trovata per ${sessionId}`);
  return res.status(401).json({ error: 'session_not_found' });
}
