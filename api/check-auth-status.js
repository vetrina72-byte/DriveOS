// File: /api/check-auth-status.js
import authStore from './_auth-cache.js';

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    const sessionData = await authStore.get(sessionId);

    // Controlliamo se lo stato è 'completed'
    if (sessionData && sessionData.status === 'completed') {
      // Trovato!
      res.status(200).json({ status: 'completed', code: sessionData.code });
    } else {
      // Non ancora.
      res.status(200).json({ status: 'pending' });
    }
  } catch (error) {
    console.error(`Error checking status for session ${sessionId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}