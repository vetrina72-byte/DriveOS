import { getRedis } from '../lib/redis.js';

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.VITE_REDIRECT_URI || process.env.REDIRECT_URI;
  const redisUrl = process.env.REDIS_URL || process.env.KV_URL || process.env.UPSTASH_REDIS_URL;
  const restUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  let redisStatus = 'not_configured';
  let redisPing = null;
  try {
    const redis = getRedis();
    if (redis) {
      redisPing = await redis.ping();
      redisStatus = redisPing === 'PONG' ? 'connected' : 'active';
    }
  } catch (err) {
    redisStatus = `error: ${err.message}`;
  }

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      SPOTIFY_CLIENT_ID_SET: !!clientId,
      SPOTIFY_CLIENT_ID_SNIPPET: clientId ? `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}` : null,
      SPOTIFY_CLIENT_SECRET_SET: !!clientSecret,
      SPOTIFY_CLIENT_SECRET_SNIPPET: clientSecret ? `${clientSecret.substring(0, 3)}...` : null,
      REDIRECT_URI_CONFIGURED: redirectUri || 'Dynamic (Auto-detected per request)',
      REDIS_CONFIGURED: !!redisUrl,
      UPSTASH_REST_CONFIGURED: !!(restUrl && restToken),
      REDIS_CONNECTION_STATUS: redisStatus,
      REDIS_PING_RESULT: redisPing,
    },
    quickLinks: {
      testRedis: '/api/test-redis',
      checkStatusTemplate: '/api/check-auth-status?sessionId=YOUR_SESSION_ID',
    },
    instructions: {
      spotifyDashboardRedirect: 'Ensure your Spotify Developer Dashboard includes https://<YOUR-VERCEL-DOMAIN>/api/spotify-callback in Redirect URIs.',
      usersAndAccess: 'Ensure your Spotify account email is added under Users and Access in Spotify Developer Dashboard.',
    }
  });
}