// lib/sessionStore.js
// Gestione sessioni e token in-memory nativa con zero-config cloud relay per ambienti serverless (es. Vercel)

const RELAY_API = 'https://api.restful-api.dev/objects';

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

// -------------------------------------------------------------
// ZERO-CONFIG CLOUD RELAY (permette la sincronizzazione cross-device su Vercel Serverless)
// -------------------------------------------------------------

/**
 * Crea un oggetto di relay cloud per sincronizzare infotainment e smartphone su Vercel
 * @param {string} sessionId 
 * @param {object} initialData 
 * @returns {Promise<string|null>} relayId
 */
export async function createRelaySession(sessionId, initialData = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(RELAY_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: `driveos_${sessionId}`, 
        data: { sessionId, ...initialData, createdAt: Date.now() } 
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    return json.id || null;
  } catch (err) {
    console.warn('[sessionStore] createRelaySession notice:', err?.message || err);
    return null;
  }
}

/**
 * Aggiorna l'oggetto di relay cloud quando lo smartphone completa l'autenticazione
 * @param {string} relayId 
 * @param {object} payload 
 */
export async function updateRelaySession(relayId, payload) {
  if (!relayId) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${RELAY_API}/${relayId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        name: `driveos_auth_${payload.sessionId || 'session'}`, 
        data: { ...payload, updatedAt: Date.now() } 
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    return res.ok;
  } catch (err) {
    console.warn('[sessionStore] updateRelaySession notice:', err?.message || err);
    return false;
  }
}

/**
 * Recupera l'oggetto di relay cloud per verificare se lo smartphone ha completato il login
 * @param {string} relayId 
 * @returns {Promise<object|null>}
 */
export async function getRelaySession(relayId) {
  if (!relayId) return null;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`${RELAY_API}/${relayId}`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    const json = await res.json();
    return json.data || null;
  } catch (err) {
    return null;
  }
}
