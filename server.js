import express from 'express';
import cors from 'cors';
import axios from 'axios';
import 'dotenv/config';

const app = express();
// The port for the backend server, should be different from the frontend.
const port = 8888;

// Middlewares
// Allow requests only from the frontend app's origin
app.use(cors({ origin: 'http://localhost:5173' })); 
app.use(express.json()); // To parse JSON request bodies

// --- Environment Variables ---
// These must be set in your .env file
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// This must exactly match the Redirect URI used in the frontend and in your Spotify Developer Dashboard
const REDIRECT_URI = 'http://localhost:5173/spotify-callback';

app.post('/api/exchange-token', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('SERVER ERROR: Spotify credentials are not configured in the .env file.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  // The 'Authorization' header requires a Base64 encoded string of "client_id:client_secret"
  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
  
  // The body of the request must be in 'application/x-www-form-urlencoded' format
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
    
    // Success: send the tokens from Spotify back to the React client
    res.json(spotifyResponse.data);

  } catch (error) {
    console.error('Error exchanging token with Spotify:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const details = error.response?.data || { message: 'An unknown error occurred' };
    res.status(status).json({
      error: 'Failed to exchange token with Spotify',
      details,
    });
  }
});

app.listen(port, () => {
  console.log(`Spotify auth backend server running at http://localhost:${port}`);
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.warn('WARNING: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set in the .env file. The server will not be able to authenticate with Spotify.');
  }
});