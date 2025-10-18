// pages/api/spotify-callback.js
import axios from 'axios';
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// --- HELPER FUNCTIONS FOR ROBUST REDIS OPERATIONS ---
async function safeSet(redis, key, obj, ttlSec) {
  try {
    if (ttlSec) await redis.set(key, JSON.stringify(obj), 'EX', ttlSec);
    else await redis.set(key, JSON.stringify(obj));
  } catch (e) {
    console.error(`[spotify-callback] safeSet error for key ${key}:`, e && e.message ? e.message : e);
  }
}

async function safeDel(redis, key) {
  try { await redis.del(key); } catch (e) { console.error(`[spotify-callback] safeDel error for key ${key}:`, e && e.message ? e.message : e); }
}

// --- STYLED HTML RESPONSE BUILDERS (NO TEMPLATE LITERALS) ---

function sendSuccessPage(res) {
  const parts = [
    '<!doctype html>',
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accesso completato</title>',
    '<style>',
    'html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }',
    'body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; text-align: center; }',
    '.container { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3rem; height: 100%; box-sizing: border-box; }',
    '.spotify-logo { width: 132px; height: auto; }',
    '.message { color: #fff; font-size: 1.3rem; font-weight: 500; line-height: 1.5; max-width: 340px; margin: 0; }',
    '.success-icon { width: 64px; height: 64px; }',
    '</style></head><body>',
    '<div class="container">',
      '<svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" aria-label="Spotify Logo">',
        '<path d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.743 83.743 83.743 46.25 0 83.744-37.493 83.744-83.743C167.74 37.77 130.246.277 83.996.277zM123.11 119.588c-1.878 3.12-5.31 4.1-8.432 2.222-3.123-1.878-4.1-5.31-2.222-8.432 1.878-3.123 5.31-4.1 8.432-2.222 3.122 1.878 4.1 5.31 2.222 8.432zm7.23-15.31c-2.31 1.543-5.743.36-7.285-1.95-1.543-2.31.36-5.743 1.95-7.285 2.31-1.543 5.743-.36 7.285 1.95 1.543 2.31-.36 5.743-1.95 7.285zm8.503-14.704c-2.822 1.785-6.6- P-.02-8.384-2.843-1.785-2.822 1.02-6.6 2.842-8.384 2.822-1.785 6.6.02 8.384 2.843 1.785 2.822-1.02 6.6-2.842 8.384z"/>',
      '</svg>',
      '<svg class="success-icon" viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Success checkmark">',
        '<path fill-rule="evenodd" clip-rule="evenodd" d="M24,0 C10.745,0 0,10.745 0,24 C0,37.255 10.745,48 24,48 C37.255,48 48,37.255 48,24 C48,10.745 37.255,0 24,0 Z M35.707,18.707 C36.098,18.317 36.098,17.683 35.707,17.293 C35.317,16.902 34.683,16.902 34.293,17.293 L23,28.586 L15.707,21.293 C15.317,20.902 14.683,20.902 14.293,21.293 C13.902,21.683 13.902,22.317 14.293,22.707 L22.293,30.707 C22.683,31.098 23.317,31.098 23.707,30.707 L35.707,18.707 Z"/>',
      '</svg>',
      '<p class="message">Hai collegato con successo il tuo account Spotify.</p>',
    '</div>',
    '<script>setTimeout(function(){ try{ window.close(); }catch(e){} }, 3500);</script>',
    '</body></html>'
  ];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).end(parts.join(''));
}

function sendExpiredPage(res) {
  const parts = [
    '<!doctype html>',
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autenticazione Fallita</title>',
    '<style>',
    'html, body { height: 100%; width: 100%; margin: 0; padding: 0; overflow: hidden; }',
    'body { display: flex; align-items: center; justify-content: center; background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; text-align: center; }',
    '.container { padding: 2rem; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2rem; height: 100%; box-sizing: border-box; }',
    '.spotify-logo { width: 132px; height: auto; }',
    '.message { color: #d1d5db; font-size: 1.1rem; font-weight: 500; line-height: 1.5; max-width: 340px; margin: 0; }',
    '.title { font-size: 1.5rem; font-weight: 600; color: white; }',
    '.error-icon { width: 48px; height: 48px; color: #f87171; }',
    '</style></head><body>',
    '<div class="container">',
      '<svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Spotify Logo"><path d="M83.996.277C37.747.277.253 37.77.253 84.019c0 46.25 37.494 83.743 83.743 83.743 46.25 0 83.744-37.493 83.744-83.743C167.74 37.77 130.246.277 83.996.277zM123.11 119.588c-1.878 3.12-5.31 4.1-8.432 2.222-3.123-1.878-4.1-5.31-2.222-8.432 1.878-3.123 5.31-4.1 8.432-2.222 3.122 1.878 4.1 5.31 2.222 8.432zm7.23-15.31c-2.31 1.543-5.743.36-7.285-1.95-1.543-2.31.36-5.743 1.95-7.285 2.31-1.543 5.743-.36 7.285 1.95 1.543 2.31-.36 5.743-1.95 7.285zm8.503-14.704c-2.822 1.785-6.6- P-.02-8.384-2.843-1.785-2.822 1.02-6.6 2.842-8.384 2.822-1.785 6.6.02 8.384 2.843 1.785 2.822-1.02 6.6-2.842 8.384z"/></svg>',
      '<svg class="error-icon" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
      '<h2 class="title">Autenticazione non valida</h2>',
      '<p class="message">Il codice è scaduto. Torna al tuo infotainment, un nuovo QR code verrà generato automaticamente.</p>',
    '</div>',
    '<script>setTimeout(function(){ try{ window.close(); }catch(e){} }, 4500);</script>',
    '</body></html>'
  ];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).end(parts.join(''));
}

export default async function handler(req, res) {
  try {
    const code = req.query.code || req.body?.code;
    const sid = req.query.state || req.query.session || req.body?.session;
    if (!code || !sid) {
      return res.status(400).send('Missing code or session/state');
    }

    const redis = getRedis();
    const sessionKey = 'session:' + sid;
    const lockKey = 'lock:spotify-exchange:' + sid;

    // 0) Idempotency check
    try {
      const existing = await redis.get(sessionKey);
      if (existing) {
        const parsed = JSON.parse(existing);
        if (parsed && parsed.authenticated) {
          console.log('[spotify-callback] OK: already authenticated for', sid);
          return sendSuccessPage(res);
        }
      }
    } catch (e) {
      console.warn('[spotify-callback] warning reading existing session', e && e.message ? e.message : e);
    }

    // 1) Try acquire lock
    const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 25);
    if (!lockAcquired) {
      console.log('[spotify-callback] lock busy for', sid, '-> wait & recheck');
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        const now = await redis.get(sessionKey);
        if (now) {
          try {
            const p = JSON.parse(now);
            if (p && p.authenticated) return sendSuccessPage(res);
            if (p && p.expired) return sendExpiredPage(res);
          } catch (e) { /* ignore parse error */ }
        }
      }
      return res.status(202).send('<html><body style="background:#000;color:#fff">Processing authentication...</body></html>');
    }

    // 2) Perform token exchange
    const authHeader = 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.VITE_REDIRECT_URI
    }).toString();

    let tokenResp;
    try {
      tokenResp = await axios.post(TOKEN_URL, body, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        timeout: 15000
      });
    } catch (err) {
      console.error('[spotify-callback] network error during token exchange', err && err.message ? err.message : err);
      await safeSet(redis, sessionKey, { authenticated: false, error: 'exchange_network_error' }, 300);
      await safeDel(redis, lockKey);
      return res.status(500).send('Network error during token exchange; please retry.');
    }

    const tokenJson = tokenResp.data;

    if (tokenResp.status !== 200) {
      console.error('[spotify-callback] token exchange failed', tokenResp.status, tokenJson);
      if (tokenJson && tokenJson.error === 'invalid_grant') {
        await safeSet(redis, sessionKey, { authenticated: false, expired: true, token_error: tokenJson }, 300);
        await safeDel(redis, lockKey);
        return sendExpiredPage(res);
      }
      await safeSet(redis, sessionKey, { authenticated: false, error: 'token_exchange_failed', token_error: tokenJson }, 300);
      await safeDel(redis, lockKey);
      return res.status(502).send('Token exchange failed');
    }

    // OK: Save session
    const { access_token, refresh_token, expires_in = 3600 } = tokenJson;
    const payload = {
      authenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000
    };

    await safeSet(redis, sessionKey, payload, 60 * 60 * 24);
    
    // Set HttpOnly cookie for refresh token
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);

    await safeDel(redis, lockKey);

    console.log('[spotify-callback] OK: Saved session', sid, 'in Redis.');
    return sendSuccessPage(res);
  } catch (err) {
    console.error('[spotify-callback] unexpected error', err && err.message ? err.message : err);
    try { 
      const r = getRedis(); 
      await safeSet(r, 'session:error:' + (req.query.state || 'unknown'), { error: 'callback_exception', message: err.message }, 60); 
    } catch(e){ /* ignore redis error on top of another error */ }
    return res.status(500).send('Internal server error in callback');
  }
}
