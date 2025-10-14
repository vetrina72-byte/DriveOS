import authStore from './_auth-cache.js';

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    // Chiediamo direttamente il valore. Sarà l'oggetto { code: '...' } o null.
    const sessionData = await authStore.get(sessionId);

    if (sessionData && sessionData.code) {
      // Trovato! La sessione è completata.
      
      // Puliamo la cache per evitare riutilizzi
      authStore.delete(sessionId);
      
      // Restituiamo il successo al client
      res.status(200).json({ status: 'completed', code: sessionData.code });

    } else {
      // Non trovato. La sessione è ancora in attesa.
      res.status(200).json({ status: 'pending' });
    }

  } catch (error) {
    console.error(`Error checking status for session ${sessionId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
