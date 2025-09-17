import { app, BrowserWindow, session } from 'electron';
import isDev from 'electron-is-dev';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
