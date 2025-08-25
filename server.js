import express from 'express';
import cors from 'cors';
import axios from 'axios';
import 'dotenv/config';

const app = express();
// The port for the backend server, should be different from the frontend.
const port = 8888;

// Middlewares
// Allow requests only from the frontend app's origin
app.use(cors({ origin: 'http://localhost:5173', credentials: true })); 
app.use(express.json()); // To parse JSON request bodies

// --- Environment Variables ---
// These must be set in your .env file
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
// This must exactly match the Redirect URI used in the frontend and in your Spotify Developer Dashboard
const REDIRECT_URI = process.env.VITE_REDIRECT_URI;

app.post('/api/exchange-token', async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is missing' });
  }

  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.error('SERVER ERROR: Spotify credentials are not configured in the .env file.');
    return res.status(500).json({ error: 'Server configuration error.' });
  }

  if (!REDIRECT_URI) {
    console.error('SERVER ERROR: VITE_REDIRECT_URI is not configured in the .env file for the server.');
    return res.status(500).json({ error: 'Server configuration error: Missing Redirect URI.' });
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
    
    const { access_token, refresh_token, expires_in } = spotifyResponse.data;

    // Set the refresh token in a secure, HttpOnly cookie.
    res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`); // Max-Age = 1 year

    // Only send the access token and its expiry to the client.
    res.json({ access_token, expires_in });

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

// New endpoint for refreshing the access token, reading from the cookie
app.post('/api/refresh-token', async (req, res) => {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(cookieHeader.split(';').map(c => c.trim().split('=').map(decodeURIComponent)));
  const refreshToken = cookies.spotify_refresh_token;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token missing from cookies' });
  }

  const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;

  const params = new URLSearchParams();
  params.append('grant_type', 'refresh_token');
  params.append('refresh_token', refreshToken);

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
    
    const { access_token, expires_in, refresh_token: newRefreshToken } = spotifyResponse.data;

    // Spotify may return a new refresh token. If so, update the cookie.
    if (newRefreshToken) {
      res.setHeader('Set-Cookie', `spotify_refresh_token=${newRefreshToken}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);
    }

    res.json({
      access_token,
      expires_in,
    });

  } catch (error) {
    console.error('Error refreshing token with Spotify:', error.response ? error.response.data : error.message);
    const status = error.response?.status || 500;
    const details = error.response?.data || { message: 'An unknown error occurred while refreshing token' };
    
    // If the refresh token is invalid, clear the cookie to prevent loops
    if (error.response?.data?.error === 'invalid_grant') {
      res.setHeader('Set-Cookie', 'spotify_refresh_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
      return res.status(401).json({ error: 'Invalid refresh token', details });
    }
    res.status(status).json({
      error: 'Failed to refresh token with Spotify',
      details,
    });
  }
});

// Endpoint to clear the refresh token cookie on logout
app.post('/api/logout', (req, res) => {
  res.setHeader('Set-Cookie', 'spotify_refresh_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  res.status(200).json({ message: 'Logged out successfully' });
});

app.listen(port, () => {
  console.log(`Spotify auth backend server running at http://localhost:${port}`);
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      console.warn('WARNING: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set in the .env file. The server will not be able to authenticate with Spotify.');
  }
});