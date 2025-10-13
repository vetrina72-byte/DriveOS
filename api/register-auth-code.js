import authStore from './_auth-cache.js';

export default function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { sessionId, code } = req.body;

  if (!sessionId || !code) {
    return res.status(400).json({ error: 'Session ID and code are required.' });
  }

  // Store the code with the session ID and a timestamp
  authStore.set(sessionId, { code, timestamp: Date.now() });

  res.status(200).json({ message: 'Code registered successfully.' });
}