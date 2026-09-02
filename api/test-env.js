// File: /api/test-env.js

export default async function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.VITE_REDIRECT_URI || process.env.REDIRECT_URI;

  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    authEngine: 'native-in-memory-session-store (Zero external DB dependencies)',
    env: {
      SPOTIFY_CLIENT_ID_SET: !!clientId,
      SPOTIFY_CLIENT_ID_SNIPPET: clientId ? `${clientId.substring(0, 4)}...${clientId.substring(clientId.length - 4)}` : null,
      SPOTIFY_CLIENT_SECRET_SET: !!clientSecret,
      SPOTIFY_CLIENT_SECRET_SNIPPET: clientSecret ? `${clientSecret.substring(0, 3)}...` : null,
      REDIRECT_URI_CONFIGURED: redirectUri || 'Dynamic (Auto-detected per request)',
    },
    quickLinks: {
      checkStatusTemplate: '/api/check-auth-status?sessionId=YOUR_SESSION_ID',
    },
    instructions: {
      spotifyDashboardRedirect: 'Ensure your Spotify Developer Dashboard includes https://<YOUR-DOMAIN>/api/spotify-callback in Redirect URIs.',
      usersAndAccess: 'Ensure your Spotify account email is added under Users and Access in Spotify Developer Dashboard.',
    }
  });
}
