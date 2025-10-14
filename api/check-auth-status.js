import authStore from './_auth-cache.js';

export default async function handler(req, res) {
  const { sessionId } = req.query;

  if (!sessionId) {
    console.log('[CHECK_STATUS] Request received with no sessionId.');
    return res.status(400).json({ error: 'Session ID is required.' });
  }

  try {
    const sessionData = await authStore.get(sessionId);

    if (sessionData && sessionData.code) {
      console.log(`[CHECK_STATUS] SUCCESS: Found code for session ${sessionId}.`);
      
      // CRITICAL: Await the delete operation. This prevents race conditions and unhandled promise rejections.
      await authStore.delete(sessionId);
      console.log(`[CHECK_STATUS] Deleted session ${sessionId} from cache.`);
      
      console.log(`[CHECK_STATUS] Responding with 'completed' for session ${sessionId}.`);
      return res.status(200).json({ status: 'completed', code: sessionData.code });

    } else {
      console.log(`[CHECK_STATUS] PENDING for session ${sessionId}.`);
      return res.status(200).json({ status: 'pending' });
    }

  } catch (error) {
    console.error(`[CHECK_STATUS] FATAL ERROR checking status for session ${sessionId}:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
