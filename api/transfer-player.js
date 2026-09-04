import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers['authorization'];
  let accessToken = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  } else if (req.body?.accessToken) {
    accessToken = String(req.body.accessToken).trim();
  }

  const { sessionId, device_id } = req.body;

  if (!device_id) return res.status(400).json({ error: 'missing_device_id' });

  let usedSessionRefresh = false;

  if (sessionId) {
    const session = await ensureSpotifyToken(sessionId);
    if (session && session.access_token) {
      accessToken = session.access_token;
      usedSessionRefresh = true;
    }
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'no_session_or_invalid_token' });
  }

  const url = 'https://api.spotify.com/v1/me/player';

  try {
    console.log('▶️ [PROXY TRANSFER] Calling spotify /v1/me/player for device', device_id);
    let spotifyRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ device_ids: [device_id], play: false })
    });

    if (spotifyRes.status === 401 && sessionId && !usedSessionRefresh) {
      // Force refresh if we didn't get this token directly from a fresh session store retrieval
      const session = await ensureSpotifyToken(sessionId, null, true);
      if (session && session.access_token) {
        accessToken = session.access_token;
        spotifyRes = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ device_ids: [device_id], play: false })
        });
      }
    }

    if (spotifyRes.status === 204) {
      return res.status(200).json({ ok: true });
    }

    const text = await spotifyRes.text();
    console.warn(`▶️ [PROXY TRANSFER] failed ${spotifyRes.status} ${text}`);
    res.setHeader('Content-Type', 'application/json');
    return res.status(spotifyRes.status).send(text || `{ "error": "transfer_failed", "status": ${spotifyRes.status} }`);
  } catch (e) {
    console.error('❌ [PROXY TRANSFER] exception', e.message);
    return res.status(500).json({ error: 'proxy_failed' });
  }
}
