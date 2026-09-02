// lib/spotifySessionManager.js
import { getSession, setSession } from './sessionStore.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

export async function ensureSpotifyToken(sessionId) {
  if (!sessionId) return null;

  const key = `spotify:${sessionId}`;
  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';

  const data = getSession(key);

  if (!data) {
    return null;
  }

  const now = Date.now();
  const timeLeft = (data.expires_at || 0) - now;

  // Se c'è ancora più di 5 minuti, il token è valido
  if (timeLeft > 5 * 60 * 1000) return data;

  if (!data.refresh_token || !CLIENT_SECRET) {
    return data;
  }

  try {
    console.log(`🕒 [TOKEN MANAGER] Token in scadenza per ${sessionId}, preparo refresh...`);

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token
    }).toString();

    const auth = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok || json?.error) {
      console.error('❌ [TOKEN MANAGER] Refresh fallito', json || { status: resp.status });
      if (json?.error === 'invalid_grant') {
        const flagged = { ...data, authenticated: false, expired: true, refresh_error: json };
        setSession(key, flagged, 60 * 10);
        console.log(`⛔ [TOKEN MANAGER] invalid_grant per ${sessionId}: segnalo expired`);
        return null;
      }
      const attempts = (data.refresh_failures || 0) + 1;
      const updatedFailure = { ...data, refresh_failures: attempts };
      setSession(key, updatedFailure, 30 * 24 * 3600);
      return updatedFailure;
    }

    // success: aggiorna token
    const updated = {
      ...data,
      access_token: json.access_token,
      expires_at: Date.now() + (json.expires_in || 3600) * 1000,
      refresh_failures: 0
    };
    if (json.refresh_token) updated.refresh_token = json.refresh_token;

    setSession(key, updated, 30 * 24 * 3600); // 30 giorni
    console.log('🔄 [TOKEN MANAGER] Refresh completato con successo!');
    return updated;
  } catch (err) {
    console.error('🔥 [TOKEN MANAGER] Eccezione durante refresh:', err);
    return data;
  }
}
