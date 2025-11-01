import { getRedis } from '../lib/redis.js';
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  const sessionId = req.body?.sessionId || req.query?.sessionId;
  console.log(`🔄 [REFRESH-ENDPOINT] Request di refresh per session=${sessionId}`);

  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

  // Chiama la logica che fa lock+refresh se necessario
  const updated = await ensureSpotifyToken(sessionId);

  // Se updated === null controlla Redis: è stato marcato expired?
  const redis = getRedis();
  const raw = await redis.get(`spotify:${sessionId}`);

  if (updated && updated.access_token) {
    return res.status(200).json({ ok: true, access_token: updated.access_token, expires_at: updated.expires_at });
  }

  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed.expired) {
        console.log(`⛔ [REFRESH-ENDPOINT] Session marked expired for ${sessionId}`);
        return res.status(401).json({ error: 'invalid_grant', description: 'Refresh token invalid or revoked' });
      }
      // refresh temporaneo fallito ma sessione ancora presente -> chiedi retry al client
      console.log(`⚠️ [REFRESH-ENDPOINT] Refresh non effettuato ora per ${sessionId}, ritenta tra poco`);
      return res.status(503).json({ error: 'refresh_failed_try_again' });
    } catch(e){}
  }

  // nessuna session trovata
  console.log(`❌ [REFRESH-ENDPOINT] Nessuna session trovata per ${sessionId}`);
  return res.status(401).json({ error: 'session_not_found' });
}