// File: /api/_auth-cache.js
import { createClient } from '@vercel/kv';

// Se non trova le variabili KV_, prova a usare REDIS_URL.
// Questo rende il codice compatibile con la configurazione che Vercel ha creato per te.
const redisUrl = process.env.REDIS_URL || process.env.KV_URL;
if (!redisUrl) {
  throw new Error("La variabile d'ambiente REDIS_URL o KV_URL non è stata trovata.");
}

// Il client si connette usando l'URL che Vercel ci ha fornito.
const kv = createClient({
  url: redisUrl,
  // Il token è già incluso nell'URL per questa configurazione,
  // quindi non serve passarlo separatamente.
});

const authStore = {
  // Salva un dato per 5 minuti (300 secondi)
  set: (key, value) => {
    console.log(`[AUTH_CACHE] Sto salvando la chiave: ${key}`);
    return kv.set(key, value, { ex: 300 });
  },
  // Legge un dato
  get: async (key) => {
    console.log(`[AUTH_CACHE] Sto leggendo la chiave: ${key}`);
    const value = await kv.get(key);
    console.log(`[AUTH_CACHE] Valore trovato per ${key}:`, value);
    return value;
  },
  // Elimina un dato
  delete: (key) => {
    console.log(`[AUTH_CACHE] Sto eliminando la chiave: ${key}`);
    return kv.del(key);
  },
};

export default authStore;
