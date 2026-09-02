// lib/sessionStore.js
// Gestione sessioni e token in-memory nativa (zero dipendenze esterne o database cloud)

if (!globalThis.__driveos_session_store__) {
  globalThis.__driveos_session_store__ = new Map();
}

const store = globalThis.__driveos_session_store__;

/**
 * Salva una sessione in memoria con TTL (default: 30 giorni)
 * @param {string} key - Chiave o Session ID (es: "spotify:sessionId" o "sessionId")
 * @param {any} data - Oggetto o valore da salvare
 * @param {number} ttlSeconds - Durata in secondi (default: 2592000 = 30 giorni)
 */
export function setSession(key, data, ttlSeconds = 30 * 24 * 3600) {
  if (!key) return;
  const normalizedKey = String(key).startsWith('spotify:') ? String(key) : `spotify:${key}`;
  const expiresAt = ttlSeconds ? Date.now() + ttlSeconds * 1000 : null;
  
  store.set(normalizedKey, {
    data,
    expiresAt,
    updatedAt: Date.now()
  });
  return true;
}

/**
 * Recupera una sessione in memoria verificando la scadenza
 * @param {string} key - Chiave o Session ID
 * @returns {any|null}
 */
export function getSession(key) {
  if (!key) return null;
  const normalizedKey = String(key).startsWith('spotify:') ? String(key) : `spotify:${key}`;
  const entry = store.get(normalizedKey);
  
  if (!entry) return null;
  
  if (entry.expiresAt && Date.now() > entry.expiresAt) {
    store.delete(normalizedKey);
    return null;
  }
  
  return entry.data;
}

/**
 * Elimina una sessione
 * @param {string} key 
 */
export function deleteSession(key) {
  if (!key) return false;
  const normalizedKey = String(key).startsWith('spotify:') ? String(key) : `spotify:${key}`;
  return store.delete(normalizedKey);
}

/**
 * Pulisce le sessioni scadute
 */
export function cleanExpiredSessions() {
  const now = Date.now();
  for (const [k, v] of store.entries()) {
    if (v.expiresAt && now > v.expiresAt) {
      store.delete(k);
    }
  }
}

// Intervallo di pulizia automatica ogni 10 minuti
if (!globalThis.__driveos_session_cleaner_interval__) {
  globalThis.__driveos_session_cleaner_interval__ = setInterval(cleanExpiredSessions, 10 * 60 * 1000);
}
