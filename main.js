import { app, BrowserWindow, session } from 'electron';
import isDev from 'electron-is-dev';
import path from 'path';
import { fileURLToPath } from 'url';

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
  // THIS IS THE CRITICAL PART: Intercept network requests and remove security headers.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        // Remove or overwrite the security headers that prevent embedding.
        // Assigning an empty array effectively removes them.
        'X-Frame-Options': [],
        'Content-Security-Policy': [] 
      }
    });
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
import { promises as fs } from 'fs';
const preloadPath = path.join(__dirname, 'preload.js');
fs.writeFile(preloadPath, '// Preload script for context isolation', 'utf-8').catch(err => {
  if (err) console.error("Failed to create preload.js:", err);
});