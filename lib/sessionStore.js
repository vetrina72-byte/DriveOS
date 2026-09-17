// lib/sessionStore.js
// Gestione sessioni e token in-memory nativa con cloud relay pub/sub ad alta affidabilità

const RELAY_BASE = 'https://ntfy.sh';

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
// RELIABLE CLOUD RELAY (sincronizzazione cross-device immediata e senza limiti restrittivi)
// -------------------------------------------------------------

function getTopicName(id) {
  const cleanId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `driveos_auth_${cleanId}`;
}

/**
 * Crea o inizializza un topic di relay per la sessione
 * @param {string} sessionId 
 * @param {object} initialData 
 * @returns {Promise<string>} relayId
 */
export async function createRelaySession(sessionId, initialData = {}) {
  const relayId = sessionId;
  try {
    setSession(`spotify:auth:${sessionId}`, { sessionId, ...initialData, relayId, createdAt: Date.now() }, 15 * 60);
    return relayId;
  } catch (err) {
    console.warn('[sessionStore] createRelaySession notice:', err?.message || err);
    return relayId;
  }
}

/**
 * Aggiorna il relay cloud pubblicando il payload sul canale della sessione
 * @param {string} relayId 
 * @param {object} payload 
 */
export async function updateRelaySession(relayId, payload) {
  if (!relayId) return false;
  const targetId = payload?.sessionId || relayId;
  
  // 1. Salva sempre nella memoria locale del processo
  setSession(`spotify:${targetId}`, payload, 30 * 24 * 3600);
  
  // 2. Pubblica sul topic cloud per sincronizzazione tra istanze remote
  try {
    const topic = getTopicName(targetId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${RELAY_BASE}/${topic}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    console.log(`[AUTH CALLBACK] relay updated: ${targetId}`);
    return res.ok;
  } catch (err) {
    console.warn('[sessionStore] updateRelaySession notice:', err?.message || err);
    return false;
  }
}

/**
 * Recupera lo stato dal relay cloud verificando i messaggi pubblicati
 * @param {string} relayId 
 * @returns {Promise<object|null>}
 */
export async function getRelaySession(relayId) {
  if (!relayId) return null;
  
  // 1. Controlla prima la memoria locale
  const local = getSession(`spotify:${relayId}`) || getSession(relayId);
  if (local && (local.access_token || local.authenticated)) {
    return local;
  }

  // 2. Interroga il topic cloud
  try {
    const topic = getTopicName(relayId);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const res = await fetch(`${RELAY_BASE}/${topic}/json?poll=1`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!res.ok) return local;
    const text = await res.text();
    if (!text || !text.trim()) return local;

    // ntfy restituisce linee di JSON (NDJSON) per ogni messaggio
    const lines = text.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const item = JSON.parse(lines[i]);
        if (item.event === 'message' && item.message) {
          const parsed = typeof item.message === 'string' ? JSON.parse(item.message) : item.message;
          if (parsed && (parsed.access_token || parsed.authenticated || parsed.status)) {
            // Salva nella memoria locale per i successivi controlli rapidi
            setSession(`spotify:${relayId}`, parsed, 30 * 24 * 3600);
            return parsed;
          }
        }
      } catch (e) {}
    }
    return local;
  } catch (err) {
    return local;
  }
}

