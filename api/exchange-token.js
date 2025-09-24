
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ message: 'Method Not Allowed' });
  }
  
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
  const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
  const REDIRECT_URI = process.env.VITE_REDIRECT_URI;

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !REDIRECT_URI) {
    console.error('SERVER ERROR: Spotify environment variables are not configured.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  
  const params = new URLSearchParams();
  params.append('grant_type', 'authorization_code');
  params.append('code', code);
  params.append('redirect_uri', REDIRECT_URI);

  try {
    const spotifyResponse = await axios.post(
      'https://accounts.spotify.com/api/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
        },
      }
    );
    
    const { access_token, refresh_token, expires_in } = spotifyResponse.data;

    // Imposta il refresh_token in un cookie sicuro, HttpOnly.
    // Questo è il pezzo più importante per la sicurezza. Il frontend non vedrà mai questo token.
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`); // Max-Age = 1 anno

    // Restituisce solo l'access_token al client.
    res.status(200).json({ access_token, expires_in });

  } catch (error) {
    console.error('Error exchanging token with Spotify:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const details = error.response?.data || { message: 'An unknown error occurred' };
    res.status(status).json({
      error: 'Failed to exchange token with Spotify',
      details,
    });
  }
}
