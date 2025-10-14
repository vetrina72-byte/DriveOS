// File: /api/spotify-callback.js

import authStore from './_auth-cache.js'; 

export default async function handler(req, res) {
  // 1. Spotify sends 'code' and 'state' (which for us is the sessionId) via GET query params
  const { code, state, error } = req.query;
  const sessionId = state;

  // If the user denied access on Spotify
  if (error) {
    console.error('Error from Spotify callback:', error);
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; background-color: #1a1a1a; color: #e5e7eb; height: 100vh; box-sizing: border-box;">
            <h1>Authorization Error</h1>
            <p style="color: #f87171;">${error}</p>
            <p>Please try again.</p>
        </div>
    `);
  }

  if (!code || !sessionId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 50px; background-color: #1a1a1a; color: #e5e7eb; height: 100vh; box-sizing: border-box;">
            <h1>Invalid Request</h1>
            <p>Missing 'code' or 'state' parameter.</p>
        </div>
    `);
  }

  // 2. SAVE THE CODE! This is the crucial step.
  // The infotainment, by polling, will find this value.
  authStore.set(sessionId, { code, timestamp: Date.now() });
  console.log(`[CALLBACK] Code received and saved for session: ${sessionId}`);

  // 3. Show a success page to the user on their phone.
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <div style="background-color: #1a1a1a; color: #e5e7eb; display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 2rem; text-align: center;">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#1DB954" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom: 1.5rem;"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <h1 style="font-size: 1.5rem; margin-bottom: 1rem;">Accesso completato!</h1>
        <p style="color: #9ca3af;">L'infotainment si sta aggiornando. Puoi chiudere questa finestra.</p>
    </div>
  `);
}
