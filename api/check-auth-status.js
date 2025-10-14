import authStore from './_auth-cache.js';

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    if (authStore.has(sessionId)) {
      const { code } = authStore.get(sessionId);
      
      // The code is retrieved, so we can remove it from the store to prevent reuse.
      authStore.delete(sessionId);
      
      // Return the code to the polling client (the infotainment unit)
      res.status(200).json({ status: 'completed', code });
    } else {
      // No code found for this session yet, tell the client to keep polling.
      res.status(200).json({ status: 'pending' });
    }
  } catch (error) {
    console.error(`Error checking status for session ${sessionId}:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
