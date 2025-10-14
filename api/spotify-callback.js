// File: /api/spotify-callback.js

// Importa la cache condivisa. Assicurati che il percorso a '_auth-cache.js' sia corretto!
// Se _auth-cache.js è nella stessa cartella api/, il percorso è './_auth-cache.js'
import authStore from './_auth-cache.js'; 

export default async function handler(req, res) {
  // 1. Riceve 'code' e 'state' (il sessionId) da Spotify
  const { code, state, error } = req.query;
  const sessionId = state;

  if (error) {
    console.error('Errore dal callback di Spotify:', error);
    return res.status(400).send(`<h1>Errore di autorizzazione</h1><p>${error}</p>`);
  }

  if (!code || !sessionId) {
    return res.status(400).send('<h1>Errore</h1><p>Parametri "code" o "state" mancanti.</p>');
  }

  // 2. Salva il codice nella cache, associandolo al sessionId.
  // Questo è il passaggio che permette al polling di funzionare.
  authStore.set(sessionId, { code });
  console.log(`[CALLBACK] Codice ricevuto e salvato per la sessione: ${sessionId}`);

  // 3. Mostra una pagina di successo sul telefono.
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px; background-color: #1DB954; color: white; height: 100vh; margin: -10px;">
      <h1>Accesso completato!</h1>
      <p>L'infotainment si sta aggiornando. Puoi chiudere questa finestra.</p>
    </div>
  `);
}