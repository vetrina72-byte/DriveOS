import Redis from 'ioredis';

// Shared global in-memory store across serverless lambdas / local server
if (!globalThis.__driveos_redis_fallback_cache__) {
  globalThis.__driveos_redis_fallback_cache__ = new Map();
}

class InMemoryRedis {
  constructor() {
    this.store = globalThis.__driveos_redis_fallback_cache__;
  }

  async get(key) {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key, value, ...args) {
    let expiresAt = null;
    if (args.length >= 2) {
      const mode = String(args[0]).toUpperCase();
      const val = parseInt(args[1], 10);
      if (mode === 'EX' && !isNaN(val)) {
        expiresAt = Date.now() + val * 1000;
      } else if (mode === 'PX' && !isNaN(val)) {
        expiresAt = Date.now() + val;
      }
    }
    this.store.set(key, { value: String(value), expiresAt });
    return 'OK';
  }

  async del(key) {
    const deleted = this.store.delete(key);
    return deleted ? 1 : 0;
  }

  async ping() {
    return 'PONG';
  }

  async expire(key, seconds) {
    const entry = this.store.get(key);
    if (!entry) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }
}

class UpstashRestRedis {
  constructor(url, token) {
    let cleanUrl = String(url || '').trim().replace(/\/$/, '');
    if (cleanUrl.startsWith('redis://') || cleanUrl.startsWith('rediss://')) {
      cleanUrl = cleanUrl.replace(/^rediss?:\/\//, 'https://');
    }
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }
    this.baseUrl = cleanUrl;
    this.token = String(token || '').trim();
    this.memoryFallback = new InMemoryRedis();
  }

  async execCommand(...args) {
    if (!this.baseUrl || !this.token || !this.baseUrl.startsWith('http')) {
      const fn = this.memoryFallback[args[0].toLowerCase()];
      if (typeof fn === 'function') {
        return await fn.apply(this.memoryFallback, args.slice(1));
      }
      return null;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const res = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(args),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.warn(`[redis Upstash REST warning] HTTP ${res.status}: ${txt} - using in-memory fallback`);
        const fn = this.memoryFallback[args[0].toLowerCase()];
        if (typeof fn === 'function') {
          return await fn.apply(this.memoryFallback, args.slice(1));
        }
        return null;
      }
      const data = await res.json();
      if (data.error) {
        console.warn(`[redis Upstash REST error]: ${data.error} - using in-memory fallback`);
        const fn = this.memoryFallback[args[0].toLowerCase()];
        if (typeof fn === 'function') {
          return await fn.apply(this.memoryFallback, args.slice(1));
        }
        return null;
      }
      return data.result;
    } catch (err) {
      console.warn(`[redis Upstash REST notice] command '${args[0]}' fallback:`, err?.message || err);
      const fn = this.memoryFallback[args[0].toLowerCase()];
      if (typeof fn === 'function') {
        return await fn.apply(this.memoryFallback, args.slice(1));
      }
      return null;
    }
  }

  async get(key) {
    return await this.execCommand('GET', key);
  }

  async set(key, value, ...args) {
    return await this.execCommand('SET', key, String(value), ...args);
  }

  async del(key) {
    return await this.execCommand('DEL', key);
  }

  async ping() {
    return await this.execCommand('PING');
  }

  async expire(key, seconds) {
    return await this.execCommand('EXPIRE', key, seconds);
  }
}

let redisInstance = null;

export function getRedis() {
  if (redisInstance) return redisInstance;

  const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // Verify REST URL is a valid HTTP/HTTPS endpoint (and not a raw redis:// TCP address)
  if (restUrl && restToken && (String(restUrl).includes('upstash.io') || String(restUrl).startsWith('http'))) {
    console.log('[redis] Using Upstash REST API client.');
    redisInstance = new UpstashRestRedis(restUrl, restToken);
    return redisInstance;
  }

  const url = process.env.REDIS_URL || process.env.KV_URL || process.env.REDIS_TLS_URL || process.env.UPSTASH_REDIS_URL;
  const memoryFallback = new InMemoryRedis();

  if (!url) {
    console.log('[redis] No external REDIS_URL configured, using shared in-memory store.');
    redisInstance = memoryFallback;
    return redisInstance;
  }

  // If URL points to an unresolvable or dead TCP host, protect with defensive fallback
  try {
    const isTls = url.startsWith('rediss://') || url.includes('upstash.io');
    const client = new Redis(url, {
      connectTimeout: 2500,
      commandTimeout: 2500,
      maxRetriesPerRequest: 0,
      lazyConnect: true,
      enableOfflineQueue: false,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      retryStrategy: () => null, // Do not hang or spam reconnect attempts if DNS fails
    });

    client.on('error', (err) => {
      // Intercept DNS getaddrinfo ENOTFOUND or ECONNREFUSED without crashing Node process
      console.warn('[redis connection notice] Host unreachable, falling back gracefully to memory store:', err?.code || err?.message || err);
    });

    redisInstance = new Proxy(client, {
      get(target, prop, receiver) {
        const orig = Reflect.get(target, prop, receiver);
        if (typeof orig === 'function') {
          return async function (...args) {
            try {
              return await orig.apply(target, args);
            } catch (err) {
              console.warn(`[redis operation notice] '${String(prop)}' failed (${err?.code || err?.message}), using in-memory fallback.`);
              if (typeof memoryFallback[prop] === 'function') {
                return await memoryFallback[prop](...args);
              }
              return null;
            }
          };
        }
        return orig;
      }
    });

    return redisInstance;
  } catch (initErr) {
    console.warn('[redis] Failed to initialize ioredis client, using in-memory fallback:', initErr);
    redisInstance = memoryFallback;
    return redisInstance;
  }
}

