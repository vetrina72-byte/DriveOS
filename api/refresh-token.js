import axios from 'axios';

/**
 * Vercel Serverless Function to handle Spotify Access Token refresh.
 * @param {import('http').IncomingMessage} req - The request object.
 * @param {import('http').ServerResponse} res - The response object.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  const { refreshToken } = req.body;
  const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is missing' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('Serverless Function Error: Missing Spotify environment variables.');
    return res.status(500).json({ message: 'Server configuration error.' });
  }

  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');

  try {
    const response = await axios({
      method: 'post',
      url: 'https://accounts.spotify.com/api/token',
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
    });
    
    // Return the whole data object which contains the new access token
    res.status(200).json(response.data);

  } catch (error) {
    console.error('Error refreshing token:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const details = error.response?.data || { message: 'An unknown error occurred while refreshing token' };
    
    if (error.response?.data?.error === 'invalid_grant') {
      return res.status(401).json({ error: 'Invalid refresh token', details });
    }
    res.status(status).json({
      error: 'Failed to refresh token with Spotify',
      details,
    });
  }
}
