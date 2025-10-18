import Redis from 'ioredis';

let redisClient;

export function getRedis() {
  if (redisClient) return redisClient;

  // legge REDIS_URL direttamente (es: redis://default:PASS@host:15250)
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error('REDIS_URL non impostato');
  }

  // ioredis capisce redis://... e usa TLS quando serve
  redisClient = new Redis(url, {
    // opzioni: timeout, retryStrategy, tls se necessario
    // se il server richiede TLS la stringa dovrebbe contenere "rediss://" oppure
    // ioredis prova STARTTLS/upgrade se necessario. In caso di problemi aggiungere:
    // tls: { rejectUnauthorized: true }
    connectTimeout: 10000,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      // ritenta con backoff esponenziale, ma non infinito
      if (times > 5) return null;
      return Math.min(1000 * 2 ** times, 30000);
    },
  });

  redisClient.on('error', (err) => {
    console.error('[redis] error', err && err.message ? err.message : err);
  });
  redisClient.on('connect', () => console.log('[redis] connected'));
  redisClient.on('ready', () => console.log('[redis] ready'));

  return redisClient;
}
