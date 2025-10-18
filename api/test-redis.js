import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  try {
    const redis = getRedis();
    const pong = await redis.ping();
    return res.status(200).json({ ok: true, pong: pong });
  } catch (err) {
    console.error('[test-redis] error', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
