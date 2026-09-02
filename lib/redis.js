// lib/redis.js
// Sostituito con session store nativo in-memory locale (nessun database esterno o dipendenza da redis/ioredis)
import { getSession, setSession, deleteSession } from './sessionStore.js';

class LocalSessionAdapter {
  async get(key) {
    const data = getSession(key);
    if (!data) return null;
    return typeof data === 'object' ? JSON.stringify(data) : String(data);
  }

  async set(key, value, ...args) {
    let ttl = 30 * 24 * 3600;
    if (args.length >= 2 && String(args[0]).toUpperCase() === 'EX') {
      const parsed = parseInt(args[1], 10);
      if (!isNaN(parsed)) ttl = parsed;
    }
    let parsedValue = value;
    if (typeof value === 'string') {
      try {
        parsedValue = JSON.parse(value);
      } catch (e) {
        parsedValue = value;
      }
    }
    setSession(key, parsedValue, ttl);
    return 'OK';
  }

  async del(key) {
    const deleted = deleteSession(key);
    return deleted ? 1 : 0;
  }

  async ping() {
    return 'PONG';
  }
}

const localAdapter = new LocalSessionAdapter();

export function getRedis() {
  return localAdapter;
}

export default localAdapter;
