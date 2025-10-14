// File: /api/spotify-callback.js

// Importa la cache condivisa. Assicurati che il percorso a '_auth-cache.js' sia corretto!
// Se _auth-cache.js è nella stessa cartella api/, il percorso è './_auth-cache.js'
import authStore from './_auth-cache.js'; 

export default async function handler(req, res) {
  // 1. Riceve 'code' e 'state' (il sessionId) da Spotify
  const { code, state, error } = req.query;
  const sessionId = state;

  if (error) {
    console.error(`[CALLBACK] Error from Spotify for session ${sessionId || 'N/A'}:`, error);
    return res.status(400).send(`<h1>Errore di autorizzazione</h1><p>${error}</p>`);
  }

  if (!code || !sessionId) {
    console.error(`[CALLBACK] Missing code or state. Code: ${!!code}, SessionID: ${!!sessionId}`);
    return res.status(400).send('<h1>Errore</h1><p>Parametri "code" o "state" mancanti.</p>');
  }

  try {
    // 2. Salva il codice nella cache, associandolo al sessionId.
    // Await ensures the operation completes before we respond to the user's phone.
    await authStore.set(sessionId, { code });
    console.log(`[CALLBACK] SUCCESS: Code saved successfully for session: ${sessionId}`);

    // 3. Mostra una pagina di successo sul telefono.
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="it">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Accesso Riuscito</title>
        <style>
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
            text-align: center; 
            background-color: #1DB954; 
            color: white; 
            height: 100vh; 
            margin: 0;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
          }
          svg {
            animation: checkmark-in 0.5s ease-out forwards;
          }
          @keyframes checkmark-in {
            from { transform: scale(0.5); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        </style>
      </head>
      <body>
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
        <h1 style="margin-top: 20px;">Accesso completato!</h1>
        <p>L'infotainment si sta aggiornando. Puoi chiudere questa finestra.</p>
      </body>
      </html>
    `);
  } catch (storeError) {
      console.error(`[CALLBACK] FATAL ERROR: Failed to save code for session ${sessionId}. Error:`, storeError);
      return res.status(500).send('<h1>Errore del Server</h1><p>Impossibile salvare lo stato della sessione. Riprova.</p>');
  }
}
