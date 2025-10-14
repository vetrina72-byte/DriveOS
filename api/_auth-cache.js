// File: /api/_auth-cache.js
import { createClient } from '@vercel/kv';
import { Agent } from 'undici';

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
    // --- VERSIONE CORAZZATA ---
    kvClient = createClient({
      url: apiUrl,
      token: apiToken,
      // 1. Mantiene la connessione attiva per migliorare la performance
      agent: new Agent({
        keepAliveTimeout: 30000, // 30 secondi
        keepAliveMaxTimeout: 60000, // 1 minuto
      }),
      // 2. Riprova aggressivamente in caso di fallimento
      retry: {
        retries: 5,     // Riprova fino a 5 volte
        factor: 2,      // Raddoppia il tempo di attesa a ogni tentativo
        maxTimeout: 15000 // Tempo massimo di attesa: 15 secondi
      },
    });
    console.log('[AUTH_CACHE] Client KV "Corazzato" creato con successo.');
  } catch (error) {
    initializationError = error;
    console.error('[AUTH_CACHE] ERRORE CRITICO in fase di creazione del client:', error);
  }
}

const authStore = {
  set: (key, value) => {
    if (initializationError) return Promise.reject(initializationError);
    // Vercel KV's .set() now returns a promise. We must await it to ensure completion.
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