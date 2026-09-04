// lib/spotifySessionManager.js
import { getSession, setSession } from './sessionStore.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

/**
 * Ensures a valid Spotify access token for a given session, performing PKCE or Basic auth refresh if expired.
 * @param {string} sessionId 
 * @param {string} [explicitRefreshToken]
 * @returns {Promise<object|null>}
 */
export async function ensureSpotifyToken(sessionId, explicitRefreshToken, forceRefresh = false) {
  if (!sessionId && !explicitRefreshToken) return null;

  const key = sessionId ? `spotify:${sessionId}` : null;
  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';

  const data = key ? getSession(key) : null;
  const refreshToken = explicitRefreshToken || data?.refresh_token;

  if (!data && !explicitRefreshToken) {
    return null;
  }

  const now = Date.now();
  const timeLeft = ((data?.expires_at || 0) - now);

  // If token is still valid for at least 3 minutes and we are not forcing refresh, return it
  if (!forceRefresh && data?.access_token && timeLeft > 3 * 60 * 1000 && !explicitRefreshToken) {
    return data;
  }

  if (!refreshToken) {
    console.warn(`[TOKEN MANAGER] No refresh token found for session ${sessionId}`);
    return data || null;
  }

  try {
    console.log(`🕒 [TOKEN MANAGER] Token expired or refreshing for ${sessionId || 'custom-token'}...`);

    const bodyParams = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CLIENT_ID
    });

    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // If CLIENT_SECRET is available, use Basic Auth header as per Spotify spec
    if (CLIENT_SECRET) {
      headers['Authorization'] = 'Basic ' + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    }

    const resp = await fetch(TOKEN_URL, {
      method: 'POST',
      headers,
      body: bodyParams.toString()
    });

    const json = await resp.json().catch(() => null);

    if (!resp.ok || json?.error) {
      console.error('❌ [TOKEN MANAGER] Refresh fallito:', json || { status: resp.status });
      if (json?.error === 'invalid_grant' && key && data) {
        const flagged = { ...data, authenticated: false, expired: true, refresh_error: json };
        setSession(key, flagged, 60 * 10);
        console.log(`⛔ [TOKEN MANAGER] invalid_grant per ${sessionId}: segnalo expired`);
        return null;
      }
      if (key && data) {
        const attempts = (data.refresh_failures || 0) + 1;
        const updatedFailure = { ...data, refresh_failures: attempts };
        setSession(key, updatedFailure, 30 * 24 * 3600);
        return updatedFailure;
      }
      return null;
    }

    // Success: aggiorna token
    const updated = {
      ...(data || {}),
      authenticated: true,
      access_token: json.access_token,
      expires_in: json.expires_in || 3600,
      expires_at: Date.now() + (json.expires_in || 3600) * 1000,
      refresh_token: json.refresh_token || refreshToken,
      refresh_failures: 0
    };

    if (key) {
      setSession(key, updated, 30 * 24 * 3600); // 30 giorni
    }
    console.log('🔄 [TOKEN MANAGER] Refresh completato con successo!');
    return updated;
  } catch (err) {
    console.error('🔥 [TOKEN MANAGER] Eccezione durante refresh:', err);
    return data || null;
  }
}

