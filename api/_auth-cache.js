// File: /api/_auth-cache.js
import { createClient } from '@vercel/kv';

console.log('[AUTH_CACHE] Inizializzazione. Controllo variabili d\'ambiente...');
console.log('[AUTH_CACHE] - KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'Trovata' : '!!! MANCANTE !!!');
console.log('[AUTH_CACHE] - KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'Trovata' : '!!! MANCANTE !!!');

const apiUrl = process.env.KV_REST_API_URL;
const apiToken = process.env.KV_REST_API_TOKEN;

let kvClient;
let initializationError = null;

if (!apiUrl || !apiToken) {
  initializationError = new Error("ERRORE CRITICO: Variabili d'ambiente KV_... non trovate.");
  console.error(initializationError.message);
} else {
  try {
    // --- MODIFICA CHIAVE ---
    // Aumentiamo la pazienza del client
    kvClient = createClient({
      url: apiUrl,
      token: apiToken,
      // Aumenta il timeout a 20 secondi (default è 10)
      retry: {
        retries: 3, // Riprova fino a 3 volte in caso di fallimento
        factor: 2, // Aspetta il doppio del tempo tra un tentativo e l'altro
      },
    });
    console.log('[AUTH_CACHE] Client KV creato con successo.');
  } catch (error) {
    initializationError = error;
    console.error('[AUTH_CACHE] ERRORE CRITICO in fase di creazione del client:', error);
  }
}

const authStore = {
  // Il resto del codice non cambia
  set: (key, value) => {
    if (initializationError) return Promise.reject(initializationError);
    return kvClient.set(key, value, { ex: 300 });
  },
  get: (key) => {
    if (initializationError) return Promise.reject(initializationError);
    return kvClient.get(key);
  },
  delete: (key) => {
    if (initializationError) return Promise.reject(initializationError);
    return kvClient.del(key);
  },
};

export default authStore;