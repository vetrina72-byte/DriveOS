import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react'; // <-- Probabilmente manca questo import!
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      // PLUGINS (NECESSARIO PER REACT)
      plugins: [react()], // <-- Aggiungi questa sezione se non c'è

      // CONFIGURAZIONE DI BUILD (LA PARTE MANCANTE)
      build: {
        outDir: 'dist', // Dice a Vite di creare la cartella 'dist'
      },
      
      // IL RESTO DELLA TUA CONFIGURAZIONE (che è corretta)
      base: '/',
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.VITE_REDIRECT_URI': JSON.stringify(env.VITE_REDIRECT_URI),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
