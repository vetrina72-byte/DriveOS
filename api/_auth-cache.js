// File: /api/_auth-cache.js
import { createClient } from '@vercel/kv';

// Log di debug per vedere se le variabili vengono lette
console.log('[AUTH_CACHE] Inizializzazione del file.');
console.log('[AUTH_CACHE] KV_REST_API_URL letto:', process.env.KV_REST_API_URL ? 'Sì, presente' : 'No, MANCANTE!');
console.log('[AUTH_CACHE] KV_REST_API_TOKEN letto:', process.env.KV_REST_API_TOKEN ? 'Sì, presente' : 'No, MANCANTE!');

let kvClient;
let initializationError = null;

try {
  // Controlliamo esplicitamente che le variabili esistano prima di usarle
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error("ERRORE: Una o entrambe le variabili d'ambiente KV_REST_API_URL e KV_REST_API_TOKEN non sono state trovate.");
  }
  
  // Creiamo il client
  kvClient = createClient({
    url: process.env.KV_REST_API_URL,
    token: process.env.KV_REST_API_TOKEN,
  });

  console.log('[AUTH_CACHE] Client KV creato con successo.');

} catch (error) {
  console.error('[AUTH_CACHE] ERRORE CRITICO durante l\'inizializzazione:', error);
  initializationError = error;
}

const authStore = {
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
