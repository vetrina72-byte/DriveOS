import axios from 'axios';

/**
 * Vercel Serverless Function to handle Spotify Authorization Code exchange.
 * @param {import('http').IncomingMessage} req - The request object.
 * @param {import('http').ServerResponse} res - The response object.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { code } = req.body;
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;

  if (!code) {
    return res.status(400).json({ message: 'Authorization code is missing.' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !VITE_REDIRECT_URI) {
    console.error('Serverless Function Error: Missing Spotify environment variables.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: VITE_REDIRECT_URI,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
    });

    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error exchanging token:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const data = error.response?.data || { message: 'Failed to exchange token with Spotify.' };
    res.status(status).json(data);
  }
}
