// File: /api/spotify-callback.js
import authStore from './_auth-cache.js'; 

export default async function handler(req, res) {
  console.log('[CALLBACK] Richiesta ricevuta da Spotify.');
  
  const { code, state, error } = req.query;
  const sessionId = state;

  if (error) {
    console.error('[CALLBACK] Spotify ha restituito un errore:', error);
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send(`<h1>Errore di autorizzazione</h1><p>${error}</p>`);
  }

  if (!code || !sessionId) {
    console.error('[CALLBACK] Parametri "code" o "state" mancanti.');
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h1>Errore</h1><p>Parametri "code" o "state" mancanti.</p>');
  }

  try {
    console.log(`[CALLBACK] Tento di salvare il codice per la sessione: ${sessionId}`);
    
    // --- PASSAGGIO CHIAVE ---
    // Eseguiamo l'operazione di salvataggio. Dovrebbe essere molto veloce.
    await authStore.set(sessionId, { status: 'completed', code });
    
    console.log(`[CALLBACK] Codice salvato con successo per la sessione: ${sessionId}. Invio risposta al browser.`);

    // --- RISPOSTA IMMEDIATA ---
    // Non facciamo nient'altro. Rispondiamo subito.
    res.setHeader('Content-Type', 'text/html');
    res.status(200).send(`
      <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
        <h1>Accesso completato!</h1>
        <p>Puoi chiudere questa finestra.</p>
      </div>
    `);

  } catch (dbError) {
    console.error(`[CALLBACK] ERRORE CRITICO durante il salvataggio nel database KV:`, dbError);
    res.setHeader('Content-Type', 'text/html');
    res.status(500).send('<h1>Errore del Server</h1><p>Impossibile salvare la sessione di autenticazione.</p>');
  }
}