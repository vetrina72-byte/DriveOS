// pages/api/spotify-callback.js
import fetch from 'node-fetch';
import { getRedis } from '../../lib/redis.js'; // adatta il path se diverso

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

// helper for safe set/del with try/catch
async function safeSet(redis, key, obj, ttlSec) {
  try {
    if (ttlSec) await redis.set(key, JSON.stringify(obj), 'EX', ttlSec);
    else await redis.set(key, JSON.stringify(obj));
  } catch (e) {
    console.error('[spotify-callback] safeSet error', e && e.message ? e.message : e);
  }
}
async function safeDel(redis, key) {
  try { await redis.del(key); } catch (e) { /* ignore */ }
}

// send simple HTML success page built WITHOUT template literals (join array to avoid backticks)
function sendSuccessPage(res) {
  const parts = [
    '<!doctype html>',
    '<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Accesso completato</title>',
    '<style>',
      'body { background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; height: 100vh; margin: 0; padding: 20vh 1rem 1rem; box-sizing: border-box; text-align: center; }',
      '.container { display: flex; flex-direction: column; align-items: center; gap: 3.5rem; }',
      '.spotify-logo { width: 140px; height: auto; }',
      '.success-icon svg { width: 64px; height: 64px; }',
      '.message { font-size: 1.25rem; font-weight: 500; max-width: 320px; line-height: 1.5; }',
    '</style></head>',
    '<body>',
      '<div class="container">',
        '<svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Spotify Logo"><path d="M83.996 25.001c0 13.808-11.193 25.001-25.001 25.001C45.187 50.002 34 38.809 34 25.001 34 11.193 45.187 0 58.995 0c13.808 0 25.001 11.193 25.001 25.001zM70.36 23.185c-2.9-5.25-9.18-7.05-15.11-3.84a1.56 1.56 0 00-1.89 1.34 1.56 1.56 0 001.34 1.89c5.12-2.82 10.45-1.34 12.8 2.91a1.55 1.55 0 002.164 1.155 1.55 1.55 0 00.7-3.455zM71.46 16.665c-3.41-6.26-10.74-8.3-17.5-4.57a1.88 1.88 0 00-2.27 1.6 1.88 1.88 0 001.6 2.27c5.6-3.14 11.85-1.4 14.83 4.05a1.88 1.88 0 002.53.74 1.88 1.88 0 00.81-4.09zM69.878 30.473c-2.734-4.223-8.15-5.222-13.568-2.887a1.25 1.25 0 00-1.51 1.074 1.25 1.25 0 001.074 1.51c4.71-2.07 9.42-1.22 11.75 2.5a1.24 1.24 0 001.741.93 1.24 1.24 0 00.513-3.127z"></path><path d="M96.38 31.57v-1.6c-2.28 2.5-5.2 3.9-9.3 3.9-9.2 0-16.4-7.2-16.4-17.1s7.2-17.2 15.4-17.2c4.4 0 7.8 1.4 10.3 4.1V19.37h6.2v23.2h-6.2zM90.88 18c-5.8 0-10.5 4.7-10.5 10.6s4.7 10.6 10.5 10.6c5.8 0 10.5-4.7 10.5-10.6s-4.7-10.6-10.5-10.6zM130.41 18.97c-9.5 0-15.5 6-15.5 14.8 0 8.2 5.2 12.3 13.3 12.3 4.2 0 7.8-1.5 10.2-4.4l-3.8-3.4c-1.6 1.8-3.6 2.7-6.2 2.7-4.1 0-6.6-2.5-7.4-6.3h24.4v-0.1c0-9.2-6.5-15-14.8-15zm-7.1 11.7c0.7-4.1 3.5-6.7 7.2-6.7 3.8 0 6.3 2.6 7 6.7h-14.2zM161.44 19.37h-9.2l-7.2 23.2h6.4l2-6.2h8.9l2 6.2h6.4l-7.2-23.2zm-1.1 12.3l3.5-10.9 3.5 10.9h-7z"></path></svg>',
        '<div class="success-icon">',
          '<svg viewBox="0 0 48 48" fill="white" xmlns="http://www.w3.org/2000/svg">',
            '<path fill-rule="evenodd" clip-rule="evenodd" d="M24,0 C10.745,0 0,10.745 0,24 C0,37.255 10.745,48 24,48 C37.255,48 48,37.255 48,24 C48,10.745 37.255,0 24,0 Z M35.707,18.707 C36.098,18.317 36.098,17.683 35.707,17.293 C35.317,16.902 34.683,16.902 34.293,17.293 L23,28.586 L15.707,21.293 C15.317,20.902 14.683,20.902 14.293,21.293 C13.902,21.683 13.902,22.317 14.293,22.707 L22.293,30.707 C22.683,31.098 23.317,31.098 23.707,30.707 L35.707,18.707 Z"/>',
          '</svg>',
        '</div>',
        '<p class="message">Hai collegato con successo il tuo account Spotify.</p>',
      '</div>',
      '<script>setTimeout(function(){ try{ window.close(); }catch(e){} }, 3500);</script>',
    '</body></html>'
  ];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).end(parts.join(''));
}

function sendExpiredPage(res) {
  const p = [
    '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Autenticazione non valida</title></head>',
    '<style>',
      'body { background-color: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Circular", "Helvetica Neue", Arial, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; height: 100vh; margin: 0; padding: 20vh 1rem 1rem; box-sizing: border-box; text-align: center; }',
      '.container { display: flex; flex-direction: column; align-items: center; gap: 2.5rem; }',
      '.spotify-logo { width: 132px; height: auto; }',
      '.error-icon svg { width: 64px; height: 64px; color: #f87171; }',
      '.message { font-size: 1.15rem; font-weight: 500; max-width: 320px; line-height: 1.5; color: #d1d5db; margin-top: 0.5rem; }',
      '.title { font-size: 1.5rem; font-weight: 600; margin: 0; }',
      'button { background: #222; color: #fff; border: 1px solid #444; padding: 10px 20px; border-radius: 20px; font-weight: 600; margin-top: 2rem; cursor: pointer; }',
    '</style></head>',
    '<body>',
      '<div class="container">',
        '<svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg" aria-label="Spotify Logo"><path d="M83.996 25.001c0 13.808-11.193 25.001-25.001 25.001C45.187 50.002 34 38.809 34 25.001 34 11.193 45.187 0 58.995 0c13.808 0 25.001 11.193 25.001 25.001zM70.36 23.185c-2.9-5.25-9.18-7.05-15.11-3.84a1.56 1.56 0 00-1.89 1.34 1.56 1.56 0 001.34 1.89c5.12-2.82 10.45-1.34 12.8 2.91a1.55 1.55 0 002.164 1.155 1.55 1.55 0 00.7-3.455zM71.46 16.665c-3.41-6.26-10.74-8.3-17.5-4.57a1.88 1.88 0 00-2.27 1.6 1.88 1.88 0 001.6 2.27c5.6-3.14 11.85-1.4 14.83 4.05a1.88 1.88 0 002.53.74 1.88 1.88 0 00.81-4.09zM69.878 30.473c-2.734-4.223-8.15-5.222-13.568-2.887a1.25 1.25 0 00-1.51 1.074 1.25 1.25 0 001.074 1.51c4.71-2.07 9.42-1.22 11.75 2.5a1.24 1.24 0 001.741.93 1.24 1.24 0 00.513-3.127z"></path><path d="M96.38 31.57v-1.6c-2.28 2.5-5.2 3.9-9.3 3.9-9.2 0-16.4-7.2-16.4-17.1s7.2-17.2 15.4-17.2c4.4 0 7.8 1.4 10.3 4.1V19.37h6.2v23.2h-6.2zM90.88 18c-5.8 0-10.5 4.7-10.5 10.6s4.7 10.6 10.5 10.6c5.8 0 10.5-4.7 10.5-10.6s-4.7-10.6-10.5-10.6zM130.41 18.97c-9.5 0-15.5 6-15.5 14.8 0 8.2 5.2 12.3 13.3 12.3 4.2 0 7.8-1.5 10.2-4.4l-3.8-3.4c-1.6 1.8-3.6 2.7-6.2 2.7-4.1 0-6.6-2.5-7.4-6.3h24.4v-0.1c0-9.2-6.5-15-14.8-15zm-7.1 11.7c0.7-4.1 3.5-6.7 7.2-6.7 3.8 0 6.3 2.6 7 6.7h-14.2zM161.44 19.37h-9.2l-7.2 23.2h6.4l2-6.2h8.9l2 6.2h6.4l-7.2-23.2zm-1.1 12.3l3.5-10.9 3.5 10.9h-7z"></path></svg>',
        '<div class="error-icon">',
          '<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        '</div>',
        '<div>',
          '<h2 class="title">Autenticazione non valida</h2>',
          '<p class="message">Il codice è scaduto. Torna al tuo infotainment, un nuovo QR code verrà generato automaticamente.</p>',
        '</div>',
        '<button onclick="window.close()">Chiudi</button>',
      '</div>',
      '<script>setTimeout(function(){ try{ window.close(); }catch(e){} }, 4500);</script>',
    '</body></html>'
  ];
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).end(p.join(''));
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

    // 0) idempotency: se sessione autenticata, ritorna subito
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

    // 1) try acquire lock (SET NX EX)
    const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', 25); // 25s lock
    if (!lockAcquired) {
      console.log('[spotify-callback] lock busy for', sid, '-> wait & recheck');
      // brief wait loop then recheck session
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
      // couldn't verify -> polite message
      return res.status(202).send('<html><body style="background:#000;color:#fff">Processing authentication. If nothing happens, retry from infotainment.</body></html>');
    }

    // 2) perform token exchange immediately
    const authHeader = 'Basic ' + Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64');
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: process.env.VITE_REDIRECT_URI
    }).toString();

    // timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let tokenResp;
    try {
      tokenResp = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader
        },
        body,
        signal: controller.signal
      });
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('[spotify-callback] network error during token exchange', err && err.message ? err.message : err);
      await safeSet(redis, sessionKey, { authenticated: false, error: 'exchange_network_error' }, 300);
      await safeDel(redis, lockKey);
      return res.status(500).send('Network error during token exchange; please retry.');
    }
    clearTimeout(timeoutId);

    const respText = await tokenResp.text().catch(() => '<no body>');
    let tokenJson = null;
    try { tokenJson = JSON.parse(respText); } catch (e) { tokenJson = null; }

    if (!tokenResp.ok) {
      console.error('[spotify-callback] token exchange failed', tokenResp.status, respText);
      // invalid_grant -> code expired or already used
      if (tokenJson && tokenJson.error === 'invalid_grant') {
        await safeSet(redis, sessionKey, { authenticated: false, expired: true, token_error: tokenJson }, 300);
        await safeDel(redis, lockKey);
        return sendExpiredPage(res);
      }
      await safeSet(redis, sessionKey, { authenticated: false, error: 'token_exchange_failed', token_error: tokenJson || respText }, 300);
      await safeDel(redis, lockKey);
      return res.status(502).send('Token exchange failed');
    }

    // OK parse token result
    const access_token = tokenJson.access_token;
    const refresh_token = tokenJson.refresh_token;
    const expires_in = tokenJson.expires_in || 3600;

    const payload = {
      authenticated: true,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: Date.now() + expires_in * 1000
    };

    // Save session
    await safeSet(redis, sessionKey, payload, 60 * 60 * 24);
    
    // Set HttpOnly cookie for refresh token
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);

    await safeDel(redis, lockKey);

    console.log('[spotify-callback] OK: Saved session', sid, 'in Redis.');
    return sendSuccessPage(res);
  } catch (err) {
    console.error('[spotify-callback] unexpected error', err && err.message ? err.message : err);
    // best-effort: do not expose internals
    try { 
        const r = getRedis(); 
        await safeSet(r, 'session:error:' + (req.query.state || 'unknown'), { error: 'callback_exception', message: err.message }, 60); 
    } catch(e){ /* ignore */ }
    return res.status(500).send('Internal server error in callback');
  }
}
