
// pages/api/spotify-callback.js
import { getRedis } from '../lib/redis.js';

const TOKEN_URL = 'https://accounts.spotify.com/api/token';

const sendCallbackPage = (res, { success = true, message = '' }) => {
  const title = success ? 'Accesso Completato' : 'Errore';
  const displayMessage = message || (success 
      ? 'Hai collegato con successo il tuo account Spotify. Puoi chiudere questa finestra.' 
      : 'Qualcosa è andato storto. Riprova a scansionare il codice QR.');
  
  const iconHtml = success 
      ? `<div class="icon-circle success">
           <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
             <circle class="checkmark__circle" cx="26" cy="26" r="25" fill="none"/>
             <path class="checkmark__check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
           </svg>
         </div>`
      : `<div class="icon-circle error">
           <svg class="cross" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
             <circle class="cross__circle" cx="26" cy="26" r="25" fill="none"/>
             <path class="cross__path" fill="none" d="M16 16 36 36 M36 16 16 36"/>
           </svg>
         </div>`;

  const html = `
    <!doctype html>
    <html lang="it">
    <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${title}</title>
    <style>
      :root {
        --bg-color: #000000;
        --text-color: #ffffff;
        --spotify-green: #1DB954;
        --error-red: #ef4444;
      }
      body {
        background-color: var(--bg-color);
        color: var(--text-color);
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        margin: 0;
        height: 100vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      header {
        width: 100%;
        padding: 40px 0;
        display: flex;
        justify-content: center;
        align-items: center;
        flex-shrink: 0;
      }
      .spotify-logo {
        width: 140px;
        height: auto;
        display: block;
      }
      .container {
        flex-grow: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        padding-bottom: 20vh;
        text-align: center;
        animation: fadeIn 0.8s ease-out;
      }
      h1 {
        font-weight: 700;
        font-size: 1.75rem;
        margin: 1.5rem 0 1rem;
        letter-spacing: -0.02em;
      }
      p {
        font-weight: 400;
        font-size: 1.1rem;
        line-height: 1.5;
        color: #a1a1aa;
        max-width: 400px;
        margin: 0;
      }
      
      /* Animation Keyframes */
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* Checkmark Animation */
      .checkmark { width: 80px; height: 80px; border-radius: 50%; display: block; stroke-width: 3; stroke: #fff; stroke-miterlimit: 10; margin: 0 auto; box-shadow: inset 0px 0px 0px var(--spotify-green); animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .checkmark__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: var(--spotify-green); fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .checkmark__check { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }
      
      /* Error Animation */
      .cross { width: 80px; height: 80px; border-radius: 50%; display: block; stroke-width: 3; stroke: #fff; stroke-miterlimit: 10; margin: 0 auto; box-shadow: inset 0px 0px 0px var(--error-red); animation: fill-error .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both; }
      .cross__circle { stroke-dasharray: 166; stroke-dashoffset: 166; stroke-width: 2; stroke-miterlimit: 10; stroke: var(--error-red); fill: none; animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards; }
      .cross__path { transform-origin: 50% 50%; stroke-dasharray: 48; stroke-dashoffset: 48; animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards; }

      @keyframes stroke { 100% { stroke-dashoffset: 0; } }
      @keyframes scale { 0%, 100% { transform: none; } 50% { transform: scale3d(1.1, 1.1, 1); } }
      @keyframes fill { 100% { box-shadow: inset 0px 0px 0px 50px var(--spotify-green); } }
      @keyframes fill-error { 100% { box-shadow: inset 0px 0px 0px 50px var(--error-red); } }
    </style>
    </head>
    <body>
      <header>
        <svg class="spotify-logo" viewBox="0 0 168 50" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M25 0C11.2 0 0 11.2 0 25s11.2 25 25 25 25-11.2 25-25S38.8 0 25 0zm19.6 36.4c-1.2 2-3.4 2.5-5.4 1.3-2-1.2-2.5-3.4-1.3-5.4 1.2-2 3.4-2.5 5.4-1.3 2 1.2 2.5 3.4 1.3 5.4zm2.3-9.8c-2.3 1-4.9-1.2-5.9-3.5-1-2.3 1.2-4.9 3.5-5.9 2.3-1 4.9 1.2 5.9 3.5 1 2.3-1.2 4.9-3.5 5.9zM38 13.9c-2.7 1.1-5.9-1.4-7-4.1-1.1-2.7 1.4-5.9 4.1-7s5.9 1.4 7 4.1c1.1 2.7-1.4 5.9-4.1 7z"/>
            <path d="M96.4 31.6c-4.4 0-7.8 1.4-10.3 4.1V19.4h-6.2v23.2h6.2v-1.6c2.3 2.5 5.2 3.9 9.3 3.9 9.2 0 16.4-7.2 16.4-17.1s-7.2-17.2-15.4-17.2zm-5.5 24c-5.8 0-10.5-4.7-10.5-10.6s4.7-10.6 10.5-10.6c5.8 0 10.5 4.7 10.5 10.6-.1 5.9-4.7 10.6-10.5 10.6zM130.4 19c-9.5 0-15.5 6-15.5 14.8 0 8.2 5.2 12.3 13.3 12.3 4.2 0 7.8-1.5 10.2-4.4l-3.8-3.4c-1.6 1.8-3.6 2.7-6.2 2.7-4.1 0-6.6-2.5-7.4-6.3h24.4V34c0-9.2-6.5-15-14.8-15zm-7.1 11.7c.7-4.1 3.5-6.7 7.2-6.7 3.8 0 6.3 2.6 7 6.7h-14.2zM161.4 19.4h-9.2L145 42.6h6.4l2-6.2h8.9l2 6.2h6.4l-7.2-23.2zm-1.1 12.3l3.5-10.9 3.5 10.9h-7z"/>
        </svg>
      </header>
      <div class="container">
        ${iconHtml}
        <h1>${title}</h1>
        <p>${displayMessage}</p>
      </div>

      <script>setTimeout(() => { if (window.close) { window.close(); } }, 3500);</script>
    </body>
    </html>`;
  res.setHeader('Content-Type', 'text/html');
  res.status(success ? 200 : 400).send(html);
};


export default async function handler(req, res) {
  const { code, state: sessionId, error } = req.query;

  if (error) {
    console.error('Spotify callback error:', error);
    sendCallbackPage(res, { success: false, message: `Spotify ha restituito un errore: ${error}` });
    return;
  }
  if (!code || !sessionId) {
    sendCallbackPage(res, { success: false, message: 'Parametri mancanti (code o session ID).' });
    return;
  }

  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;
  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', VITE_REDIRECT_URI);

  try {
    const spotifyResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': authHeader,
        },
        body: params,
    });
    
    const tokenData = await spotifyResponse.json();

    if (!spotifyResponse.ok) {
        console.error('Error exchanging token with Spotify:', tokenData);
        if (tokenData?.error === 'invalid_grant') {
            sendCallbackPage(res, { success: true, message: 'Autenticazione già completata. Puoi chiudere questa finestra.' });
        } else {
            sendCallbackPage(res, { success: false });
        }
        return;
    }
    
    const redis = getRedis();
    
    const payload = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      refresh_failures: 0
    };

    await redis.set(`spotify:${sessionId}`, JSON.stringify(payload), 'EX', 60*60*24*30); // 30 days
    console.log(`💾 [SPOTIFY-CALLBACK] Saved session ${sessionId}, expires at ${new Date(payload.expires_at).toLocaleTimeString()}`);
    
    sendCallbackPage(res, { success: true });

  } catch (exchangeError) {
    console.error('Network or parsing error during token exchange:', exchangeError.message);
    sendCallbackPage(res, { success: false, message: 'Errore di rete. Controlla la connessione e riprova.' });
  }
}
