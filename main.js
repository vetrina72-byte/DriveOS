
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

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createAuthServer() {
  const server = express();
  const port = 8888; // As per README

  server.use(cors({ origin: 'http://localhost:5173', credentials: true }));
  server.use(express.json());
  server.use(cookieParser());

  const authStore = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of authStore.entries()) {
      if (now - value.timestamp > 5 * 60 * 1000) { // 5 minute expiry
        authStore.delete(key);
      }
    }
  }, 60 * 1000);

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

        // Store the access token for the client to fetch via polling
        authStore.set(sessionId, { status: 'completed', tokens: { access_token, expires_in }, timestamp: Date.now() });
        
        // Send the success page to the user's phone
        res.sendFile(path.join(__dirname, 'callback.html'));

    } catch (exchangeError) {
        console.error('Error exchanging token:', exchangeError.response ? exchangeError.response.data : exchangeError.message);
        res.status(500).send('<h1>Authentication Failed</h1><p>Could not exchange the authorization code for an access token.</p>');
    }
  });

  server.get('/api/check-auth-status', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }
    const sessionData = authStore.get(sessionId);

    if (sessionData && sessionData.status === 'completed') {
      // DO NOT DELETE THE SESSION HERE
      // We must keep it alive for subsequent requests if using local store logic, 
      // or at least let it expire by TTL.
      // authStore.delete(sessionId); 
      res.status(200).json({ status: 'completed', tokens: sessionData.tokens });
    } else {
      res.status(202).json({ status: 'pending' }); // 202 Accepted means "not ready yet, keep polling"
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
