// File: /api/check-auth-status.js
import { ensureSpotifyToken } from '../lib/spotifySessionManager.js';
import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const sessionId = req.query?.sessionId;
  if (!sessionId) return res.status(400).json({ error: 'missing_sessionId' });

  const redis = getRedis();
  
  // 1. Controlla stati immediati salvati dal callback in Redis
  try {
    const raw = await redis.get(`spotify:${sessionId}`);
    if (raw) {
      const p = JSON.parse(raw);
      
      // Se c'è un errore specifico (es. premium_required), rispondi immediatamente
      if (p.error) {
          return res.status(200).json({ 
            authenticated: false, 
            error: p.error,
            detail: p.detail || ''
          });
      }

      // Se l'autenticazione è avvenuta con successo, restituisci i dati per il login
      if (p.access_token) {
        return res.status(200).json({ 
          authenticated: true, 
          access_token: p.access_token,
          expires_at: p.expires_at 
        });
      }
    }
  } catch(e) {
    console.error("[POLLING API] Error reading from Redis:", e);
  }

  // 2. Fallback: prova a gestire il token tramite il manager (refresh automatico)
  const updated = await ensureSpotifyToken(sessionId);

  if (updated && updated.access_token) {
    return res.status(200).json({ 
      authenticated: true, 
      access_token: updated.access_token,
      expires_at: updated.expires_at 
    });
  }

  // Se non c'è nulla, la sessione è ancora in attesa
  return res.status(200).json({ authenticated: false });
}