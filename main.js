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

  // New endpoint to serve the success page on the user's device
  server.get('/api/spotify-callback', (req, res) => {
    res.sendFile(path.join(__dirname, 'callback.html'));
  });

  server.post('/api/register-auth-code', (req, res) => {
    const { sessionId, code } = req.body;
    if (!sessionId || !code) {
      return res.status(400).json({ error: 'Session ID and code are required.' });
    }
    authStore.set(sessionId, { code, timestamp: Date.now() });
    res.status(200).json({ message: 'Code registered successfully.' });
  });

  server.get('/api/check-auth-status', (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required.' });
    }
    if (authStore.has(sessionId)) {
      const { code } = authStore.get(sessionId);
      authStore.delete(sessionId);
      res.status(200).json({ code });
    } else {
      res.status(202).json({ status: 'pending' });
    }
  });

  server.post('/api/exchange-token', async (req, res) => {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'Authorization code is missing' });
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
      res.setHeader('Set-Cookie', `spotify_refresh_token=${refresh_token}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);
      res.status(200).json({ access_token, expires_in });
    } catch (error) {
      console.error('Error exchanging token:', error.response ? error.response.data : error.message);
      res.status(error.response?.status || 500).json({ error: 'Failed to exchange token' });
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
        res.setHeader('Set-Cookie', `spotify_refresh_token=${newRefreshToken}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);
      }
      res.status(200).json({ access_token, expires_in });
    } catch (error) {
      console.error('Error refreshing token:', error.response ? error.response.data : error.message);
       if (error.response?.data?.error === 'invalid_grant') {
            res.setHeader('Set-Cookie', 'spotify_refresh_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            return res.status(401).json({ error: 'Invalid refresh token' });
        }
      res.status(error.response?.status || 500).json({ error: 'Failed to refresh token' });
    }
  });

  server.post('/api/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'spotify_refresh_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
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
