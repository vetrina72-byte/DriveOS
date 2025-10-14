import authStore from './_auth-cache.js';

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    console.log('[CHECK_STATUS] Richiesta fallita: sessionId mancante.');
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    console.log(`[CHECK_STATUS] Sto leggendo la chiave: ${sessionId}`);
    // Chiediamo direttamente il valore. Sarà l'oggetto { code: '...' } o null.
    const sessionData = await authStore.get(sessionId);

    if (sessionData && sessionData.code) {
      // Trovato! La sessione è completata.
      console.log(`[CHECK_STATUS] SUCCESSO! Trovato codice per la sessione: ${sessionId}`);
      
      // Puliamo la cache per evitare riutilizzi.
      // CRUCIALE: Usiamo `await` per assicurarci che la cancellazione sia completata.
      // La mancanza di `await` qui era la causa degli errori 500!
      await authStore.delete(sessionId);
      console.log(`[CHECK_STATUS] Sessione ${sessionId} cancellata dalla cache.`);
      
      // Restituiamo il successo al client
      res.status(200).json({ status: 'completed', code: sessionData.code });

    } else {
      // Non trovato. La sessione è ancora in attesa.
      console.log(`[CHECK_STATUS] In attesa per la sessione: ${sessionId}`);
      res.status(200).json({ status: 'pending' });
    }

  } catch (error) {
    console.error(`[CHECK_STATUS] ERRORE CRITICO durante il controllo dello stato per la sessione ${sessionId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}