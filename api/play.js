
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const sessionId = req.headers['x-session-id'];
  if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

  const session = await ensureSpotifyToken(sessionId);
  if (!session || !session.access_token) {
    return res.status(401).json({ error: 'no_session_or_invalid_token' });
  }

  const accessToken = session.access_token;
  const { deviceId, body } = req.body;
  const url = deviceId ? `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}` : `https://api.spotify.com/v1/me/player/play`;

  try {
    console.log(`▶️ [PROXY PLAY] Request to Spotify (${deviceId ? 'Device Specific' : 'Active Device'})`);
    
    const spotifyRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body || {})
    });

    if (!spotifyRes.ok) {
        const text = await spotifyRes.text();
        console.error(`❌ [PROXY PLAY] Failed: ${spotifyRes.status} - ${text}`);
        
        // Parse error to see if it is a restriction
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
