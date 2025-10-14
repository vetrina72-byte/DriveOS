// File: /api/spotify-callback.js

// Importa la cache condivisa. Assicurati che il percorso a '_auth-cache.js' sia corretto!
// Se _auth-cache.js è nella stessa cartella api/, il percorso è './_auth-cache.js'
import authStore from './_auth-cache.js'; 

export default async function handler(req, res) {
  // 1. Riceve 'code' e 'state' (il sessionId) da Spotify
  const { code, state, error } = req.query;
  const sessionId = state;

  if (error) {
    console.error('[CALLBACK] Errore dal callback di Spotify:', error);
    return res.status(400).send(`
      <div style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #DC2626; color: white; height: 100vh; margin: -10px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="font-size: 2rem;">Errore di autorizzazione</h1>
        <p style="font-size: 1.2rem; max-width: 80%;">${error}</p>
      </div>
    `);
  }

  if (!code || !sessionId) {
    console.error('[CALLBACK] Parametri "code" o "state" (sessionId) mancanti.');
    return res.status(400).send('<h1>Errore</h1><p>Parametri "code" o "state" mancanti.</p>');
  }

  try {
    // 2. Salva il codice nella cache, associandolo al sessionId.
    // Questo è il passaggio che permette al polling di funzionare.
    // CRUCIALE: Usiamo `await` per assicurarci che l'operazione sia completata prima che la funzione termini.
    await authStore.set(sessionId, { code });
    console.log(`[CALLBACK] Codice ricevuto e salvato con successo per la sessione: ${sessionId}`);

    // 3. Mostra una pagina di successo sul telefono.
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; text-align: center; padding: 20px; background-color: #1DB954; color: white; height: 100vh; margin: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; box-sizing: border-box;">
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
          <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
        <h1 style="font-size: 2.5rem; margin-top: 20px; margin-bottom: 10px;">Accesso completato!</h1>
        <p style="font-size: 1.2rem; max-width: 80%;">L'infotainment si sta aggiornando. Puoi chiudere questa finestra.</p>
      </div>
    `);
  } catch (cacheError) {
    console.error(`[CALLBACK] ERRORE CRITICO nel salvataggio della sessione ${sessionId} nella cache:`, cacheError);
    // Mostra un errore chiaro all'utente se non riusciamo a salvare la sessione.
    res.status(500).send(`
      <div style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #DC2626; color: white; height: 100vh; margin: -10px;">
        <h1>Errore del Server</h1>
        <p>Impossibile salvare la sessione di login. Riprova.</p>
      </div>
    `);
  }
}