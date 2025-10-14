// File: /api/spotify-callback.js
import authStore from './_auth-cache.js'; 

export default function handler(req, res) {
  console.log('[CALLBACK] Richiesta ricevuta da Spotify.');
  
  const { code, state, error } = req.query;
  const sessionId = state;

  if (error) {
    // Gestione errore immediata
    return res.status(400).send(`<h1>Errore</h1><p>${error}</p>`);
  }

  if (!code || !sessionId) {
    // Gestione errore immediata
    return res.status(400).send('<h1>Errore</h1><p>Parametri mancanti.</p>');
  }

  // --- NUOVA LOGICA "FIRE AND FORGET" ---

  // 1. RISPONDI SUBITO AL BROWSER!
  // Diamo all'utente la pagina di successo immediatamente.
  console.log(`[CALLBACK] Invio risposta di successo immediata per la sessione: ${sessionId}.`);
  res.setHeader('Content-Type', 'text/html');
  res.status(200).send(`
    <div style="font-family: sans-serif; text-align: center; padding-top: 50px;">
      <h1>Accesso quasi completato!</h1>
      <p>Stiamo finalizzando la configurazione. Puoi chiudere questa finestra.</p>
    </div>
  `);

  // 2. ORA, IN BACKGROUND, PROVA A SALVARE SUL DATABASE
  // Usiamo una funzione asincrona che non viene "attesa" (await).
  // Il server non aspetta che finisca prima di chiudere la connessione.
  const saveToDb = async () => {
    try {
      console.log(`[CALLBACK-BACKGROUND] Tento di salvare il codice per la sessione: ${sessionId}`);
      await authStore.set(sessionId, { status: 'completed', code });
      console.log(`[CALLBACK-BACKGROUND] Codice salvato con successo per: ${sessionId}`);
    } catch (dbError) {
      console.error(`[CALLBACK-BACKGROUND] ERRORE CRITICO durante il salvataggio nel DB:`, dbError);
      // Non possiamo fare altro qui, perché abbiamo già risposto al browser.
      // Ma il log ci dirà se c'è un problema persistente.
    }
  };

  // Avviamo l'operazione di salvataggio
  saveToDb();
}