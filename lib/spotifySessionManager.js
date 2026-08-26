// lib/spotifySessionManager.js
import { getRedis } from './redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Using global fetch
export async function ensureSpotifyToken(sessionId) {
  if (!sessionId) return null;

  const redis = getRedis();
  const key = `spotify:${sessionId}`;
  const lockKey = `lock:refresh:${sessionId}`;

  const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID || 'ecc9e126d442404b92e8081c7d95ecca';
  const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET || '';

  let raw = null;
  try {
    raw = await redis.get(key);
  } catch (err) {
    console.warn(`[TOKEN MANAGER] get notice for ${sessionId}:`, err?.message || err);
  }

  if (!raw) {
    console.log(`⚠️ [TOKEN MANAGER] Nessuna session trovata per ${sessionId}`);
    return null;
  }

  let data;
  try { data = JSON.parse(raw); } catch(e){ console.error('[TOKEN MANAGER] parse error', e); return null; }

  const now = Date.now();
  const timeLeft = (data.expires_at || 0) - now;
  console.log(`⌛ [TOKEN MANAGER] session=${sessionId} token valido ancora per ${Math.round(timeLeft/1000)}s`);

  // Se c'è ancora più di 5 minuti, niente da fare
  if (timeLeft > 5 * 60 * 1000) return data;

  if (!data.refresh_token || !CLIENT_SECRET) {
    return data;
  }

  // Acquire lock (SET NX EX)
  let lock = null;
  try {
    lock = await redis.set(lockKey, '1', 'NX', 'EX', 30);
  } catch (e) {
    lock = 'OK';
  }

  if (!lock) {
    console.log(`🔒 [TOKEN MANAGER] Lock occupato per ${sessionId}, attendo breve e ricontrollo`);
    // breve attesa e re-check (non bloccare troppo)
    for (let i = 0; i < 8; i++) {
      await new Promise(r => setTimeout(r, 500));
      try {
        const nowRaw = await redis.get(key);
        if (!nowRaw) break;
        const maybe = JSON.parse(nowRaw);
        if ((maybe.expires_at || 0) > Date.now()) {
          console.log(`🔁 [TOKEN MANAGER] Altri worker hanno aggiornato token per ${sessionId}`);
          return maybe;
        }
      } catch(e){}
    }
    // fallback: ritorna lo stato corrente (non cancellare)
    console.log(`⚠️ [TOKEN MANAGER] Lock ancora occupato, ritorno session corrente per ${sessionId}`);
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

    const json = await resp.json().catch(()=>null);

    if (!resp.ok || json?.error) {
      console.error('❌ [TOKEN MANAGER] Refresh fallito', json || { status: resp.status });
      // se invalid_grant -> marca expired per forzare re-login
      if (json?.error === 'invalid_grant') {
        const flagged = { ...data, authenticated: false, expired: true, refresh_error: json };
        try {
          await redis.set(key, JSON.stringify(flagged), 'EX', 60 * 10);
        } catch (e) {}
        console.log(`⛔ [TOKEN MANAGER] invalid_grant per ${sessionId}: segnalo expired`);
        return null;
      }
      // incremento contatore di tentativi (ma NON cancellare sessione)
      const attempts = (data.refresh_failures || 0) + 1;
      const updatedFailure = { ...data, refresh_failures: attempts };
      try {
        await redis.set(key, JSON.stringify(updatedFailure));
      } catch (e) {}
      console.log(`⚠️ [TOKEN MANAGER] Refresh temporaneamente fallito per ${sessionId} (attempt ${attempts})`);
      return updatedFailure;
    }

    // success: aggiorna token (se rotato anche refresh_token)
    const updated = {
      ...data,
      access_token: json.access_token,
      expires_at: Date.now() + (json.expires_in || 3600) * 1000,
      refresh_failures: 0
    };
    if (json.refresh_token) updated.refresh_token = json.refresh_token;

    try {
      await redis.set(key, JSON.stringify(updated), 'EX', 60 * 60 * 24 * 30); // 30 days
    } catch (e) {}
    console.log('🔄 [TOKEN MANAGER] Refresh completato con successo!');
    console.log(`🟢 [TOKEN MANAGER] Nuovo access token valido fino a ${new Date(updated.expires_at).toLocaleTimeString()}`);

    return updated;
  } catch (err) {
    console.error('🔥 [TOKEN MANAGER] Eccezione durante refresh:', err);
    // non cancellare la sessione; lascialo per retry futuri
    return data;
  } finally {
    try { await redis.del(lockKey); } catch(e){/* ignore */ }
  }
}