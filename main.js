
import { app, BrowserWindow, session } from 'electron';
import isDev from 'electron-is-dev';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import express from 'express';
import cors from 'cors';
import axios from 'axios';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { getRedis } from './lib/redis.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createAuthServer() {
  const server = express();
  const port = 8888; // As per README

  server.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  server.use(express.json());
  server.use(cookieParser());

  // Use Redis for persistence instead of in-memory Map
  const redis = getRedis();

  server.get('/api/spotify-callback', async (req, res) => {
    const { code, state: sessionId, error } = req.query;

    if (error) {
        console.error('Spotify callback error:', error);
        return res.status(400).send(`<h1>Authentication Error</h1><p>Spotify returned an error: ${error}</p>`);
    }
    if (!code || !sessionId) {
        return res.status(400).send('<h1>Authentication Error</h1><p>Missing required parameters (code or session ID).</p>');
    }

    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, VITE_REDIRECT_URI } = process.env;
    const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', VITE_REDIRECT_URI);

    try {
        const spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': authHeader,
            },
        });
        
        const { access_token, refresh_token, expires_in } = spotifyResponse.data;

        // Securely set the refresh token in an HttpOnly cookie
        let cookieString = `spotify_refresh_token=${refresh_token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=31536000`;
        if (!isDev) {
            cookieString += '; Secure';
        }
        res.setHeader('Set-Cookie', cookieString);

        // Store the access token in Redis with a TTL (e.g., 24h)
        // This ensures if the app restarts, the frontend can still poll/check this session.
        const sessionData = { 
            status: 'completed', 
            access_token, 
            expires_at: Date.now() + (expires_in * 1000) 
        };
        
        await redis.set(`spotify:${sessionId}`, JSON.stringify(sessionData), 'EX', 3600 * 24); 
        
        // Send the success page to the user's phone
        res.sendFile(path.join(__dirname, 'callback.html'));

    } catch (exchangeError) {
        console.error('Error exchanging token:', exchangeError.response ? exchangeError.response.data : exchangeError.message);
        res.status(500).send('<h1>Authentication Failed</h1><p>Could not exchange the authorization code for an access token.</p>');
    }
  });

  server.get('/api/check-auth-status', async (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }
    
    try {
        // Retrieve from Redis
        const rawData = await redis.get(`spotify:${sessionId}`);
        
        if (rawData) {
            const sessionData = JSON.parse(rawData);
            if (sessionData.status === 'completed') {
                res.status(200).json({ 
                    authenticated: true, 
                    access_token: sessionData.access_token,
                    expires_at: sessionData.expires_at
                });
                return;
            }
        }
        // If not found or not completed
        res.status(202).json({ status: 'pending' }); 
    } catch (e) {
        console.error("Redis Error", e);
        res.status(500).json({ error: 'Internal Server Error' });
    }
  });
  
  server.post('/api/refresh-token', async (req, res) => {
    const { spotify_refresh_token: refreshToken } = req.cookies;
    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token missing' });
    }
    const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env;
    const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    try {
      const spotifyResponse = await axios.post('https://accounts.spotify.com/api/token', params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': authHeader,
        },
      });
      const { access_token, expires_in, refresh_token: newRefreshToken } = spotifyResponse.data;
      if (newRefreshToken) {
        let cookieString = `spotify_refresh_token=${newRefreshToken}; HttpOnly; Path=/; SameSite=Strict; Max-Age=31536000`;
        if (!isDev) {
            cookieString += '; Secure';
        }
        res.setHeader('Set-Cookie', cookieString);
      }
      res.status(200).json({ access_token, expires_in });
    } catch (error) {
      console.error('Error refreshing token:', error.response ? error.response.data : error.message);
       if (error.response?.data?.error === 'invalid_grant') {
            let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
            if (!isDev) {
                cookieString += '; Secure';
            }
            res.setHeader('Set-Cookie', cookieString);
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
      res.status(error.response?.status || 500).json({ error: 'Failed to refresh token' });
    }
  });

  server.post('/api/logout', (req, res) => {
    let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (!isDev) {
        cookieString += '; Secure';
    }
    res.setHeader('Set-Cookie', cookieString);
    res.status(200).json({ message: 'Logged out successfully' });
  });

  server.listen(port, () => {
    console.log(`[Electron Main] Auth server listening on http://localhost:${port}`);
  });
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // IMPORTANT: Enable the <webview> tag.
      webviewTag: true,
      nodeIntegration: false,
      contextIsolation: true,
      // Add partition for persistent sessions
      partition: 'persist:default',
    },
  });
  
  // Set a standard User-Agent to avoid being blocked
  mainWindow.webContents.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36');

  const loadURL = isDev
    ? 'http://localhost:5173'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
    
  mainWindow.loadURL(loadURL);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(() => {
  createAuthServer(); // Start the stateful auth server

  // THIS IS THE CRITICAL PART: Intercept network requests and robustly remove security headers.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders } = details;
    const updatedHeaders = { ...responseHeaders };

    // A more robust way to remove headers: iterate over all keys and delete any that match case-insensitively.
    const headersToRemove = ['x-frame-options', 'content-security-policy'];

    for (const headerKey of Object.keys(updatedHeaders)) {
      if (headersToRemove.includes(headerKey.toLowerCase())) {
        delete updatedHeaders[headerKey];
      }
    }

    callback({ responseHeaders: updatedHeaders });
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Create a minimal preload.js for context isolation, even if it's empty.
const preloadPath = path.join(__dirname, 'preload.js');
fs.writeFile(preloadPath, '// Preload script for context isolation', 'utf-8').catch(err => {
  if (err) console.error("Failed to create preload.js:", err);
});
