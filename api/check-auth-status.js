// File: /api/check-auth-status.js
import authStore from './_auth-cache.js';

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    const sessionData = await authStore.get(sessionId);

    if (sessionData && sessionData.status === 'completed') {
      // Session data found, delete it from the store to prevent reuse
      await authStore.delete(sessionId);
      
      // Send the tokens to the client, which will complete the login
      return res.status(200).json({ status: 'completed', tokens: sessionData.tokens });
    } else {
      // Not yet authenticated, tell the client to keep polling
      return res.status(202).json({ status: 'pending' });
    }
  } catch (error) {
    console.error(`[check-auth-status] Error reading from KV store for session ${sessionId}:`, error);
    // In case of a database error, it's safer to tell the client it's still pending
    // to avoid breaking the polling loop. The error is logged for debugging.
    return res.status(202).json({ status: 'pending', error: 'datastore_error' });
  }
}
