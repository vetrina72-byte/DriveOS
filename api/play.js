import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const authHeader = req.headers['authorization'];
  let accessToken = null;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    accessToken = authHeader.substring(7).trim();
  } else if (req.body?.accessToken) {
    accessToken = String(req.body.accessToken).trim();
  }

  const sessionId = req.headers['x-session-id'] || req.body?.sessionId;

  if (!accessToken && sessionId) {
    const session = await ensureSpotifyToken(sessionId);
    if (session && session.access_token) {
      accessToken = session.access_token;
    }
  }

  if (!accessToken) {
    return res.status(401).json({ error: 'no_session_or_invalid_token' });
  }

  const { deviceId, body } = req.body;
  const url = deviceId ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` : `https://api.spotify.com/v1/me/player/play`;

  try {
    console.log(`▶️ [PROXY PLAY] Request to Spotify (${deviceId ? 'Device: ' + deviceId : 'Active Device'})`);
    
    let spotifyRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });

    if (spotifyRes.status === 401 && sessionId) {
      console.log(`🔄 [PROXY PLAY] Spotify 401, refreshing session ${sessionId}...`);
      const session = await ensureSpotifyToken(sessionId);
      if (session && session.access_token && session.access_token !== accessToken) {
        accessToken = session.access_token;
        spotifyRes = await fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body || {})
        });
      }
    }

    if (!spotifyRes.ok) {
        const text = await spotifyRes.text();
        console.error(`❌ [PROXY PLAY] Failed: ${spotifyRes.status} - ${text}`);
        
        try {
            const errJson = JSON.parse(text);
            if (errJson.error?.reason === 'NO_ACTIVE_DEVICE') {
                return res.status(404).json({ error: 'no_active_device' });
            }
        } catch(e) {}

        return res.status(spotifyRes.status).send(text);
    }

    return res.status(204).send('');
  } catch (e) {
    console.error(`🔥 [PROXY PLAY] Exception:`, e.message);
    return res.status(500).json({error: 'proxy_exception'});
  }
}
