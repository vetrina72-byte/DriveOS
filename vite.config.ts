import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    // Load env files from the root of the project.
    // Vite will automatically look for .env, .env.local, .env.[mode], .env.[mode].local
    const env = loadEnv(mode, '.', '');
    
    // For development, if VITE_REDIRECT_URI is not set in any .env file,
    // we provide a default value to ensure the app works locally.
    // For production, this variable MUST be set in the deployment environment (e.g., Vercel).
    if (mode === 'development' && !env.VITE_REDIRECT_URI) {
        env.VITE_REDIRECT_URI = 'http://localhost:5173/spotify-callback';
    }

    return {
      base: '/',
      // Vite automatically makes VITE_* variables available on import.meta.env.
      // We define them here to ensure our development default is included.
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'import.meta.env.VITE_REDIRECT_URI': JSON.stringify(env.VITE_REDIRECT_URI),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        proxy: {
          // Proxy API requests to the backend server during development
          '/api': {
            target: 'http://localhost:8888', // Your backend server address
            changeOrigin: true, // Recommended for virtual hosted sites
          },
        },
      },
    };
});