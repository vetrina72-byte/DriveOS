// File: /api/_auth-cache.js
import { createClient } from '@vercel/kv';

console.log('[AUTH_CACHE] Inizializzazione. Controllo variabili d\'ambiente...');
console.log('[AUTH_CACHE] - KV_REST_API_URL:', process.env.KV_REST_API_URL ? 'Trovata' : '!!! MANCANTE !!!');
console.log('[AUTH_CACHE] - KV_REST_API_TOKEN:', process.env.KV_REST_API_TOKEN ? 'Trovata' : '!!! MANCANTE !!!');

// Variabili per creare il client
const apiUrl = process.env.KV_REST_API_URL;
const apiToken = process.env.KV_REST_API_TOKEN;

let kvClient;
let initializationError = null;

// Controlliamo esplicitamente che le variabili esistano
if (!apiUrl || !apiToken) {
  initializationError = new Error("ERRORE CRITICO: Una o entrambe le variabili d'ambiente KV_REST_API_URL e KV_REST_API_TOKEN non sono state trovate. Controlla la dashboard di Vercel.");
  console.error(initializationError.message);
} else {
  try {
    // Creiamo il client SOLO con le variabili corrette
    kvClient = createClient({
      url: apiUrl,
      token: apiToken,
    });
    console.log('[AUTH_CACHE] Client KV creato con successo. La connessione è pronta.');
  } catch (error) {
    initializationError = error;
    console.error('[AUTH_CACHE] ERRORE CRITICO in fase di creazione del client:', error);
  }
}

const authStore = {
  set: (key, value) => {
    if (initializationError) return Promise.reject(initializationError);
    console.log(`[AUTH_CACHE] Sto salvando la chiave: ${key}`);
    return kvClient.set(key, value, { ex: 300 }); // Salva per 5 minuti
  },
  get: (key) => {
    if (initializationError) return Promise.reject(initializationError);
    console.log(`[AUTH_CACHE] Sto leggendo la chiave: ${key}`);
    const value = kvClient.get(key);
    console.log(`[AUTH_CACHE] Valore trovato per ${key}:`, value);
    return value;
  },
  delete: (key) => {
    if (initializationError) return Promise.reject(initializationError);
    console.log(`[AUTH_CACHE] Sto eliminando la chiave: ${key}`);
    return kvClient.del(key);
  },
};

export default authStore;
