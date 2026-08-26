import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    const testKey = `test:health:${Date.now()}`;
    await redis.set(testKey, JSON.stringify({ status: 'ok', time: Date.now() }), 'EX', 60);
    const readVal = await redis.get(testKey);
    const parsed = typeof readVal === 'string' ? JSON.parse(readVal) : readVal;

    return res.status(200).json({ 
      ok: true, 
      pong: pong,
      writeReadCheck: parsed?.status === 'ok' ? 'SUCCESS' : 'FAILED',
      storedValue: parsed
    });
  } catch (err) {
    console.error('[test-redis] error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
