import axios from 'axios';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }

    const { spotify_refresh_token: refreshToken } = req.cookies;

    if (!refreshToken) {
        return res.status(401).json({ error: 'Refresh token missing from cookies' });
    }

    const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
    const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

    const authHeader = `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`;

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);

    try {
        const spotifyResponse = await axios.post(
            'https://accounts.spotify.com/api/token',
            params,
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': authHeader,
                },
            }
        );
        
        const { access_token, expires_in, refresh_token: newRefreshToken } = spotifyResponse.data;

        if (newRefreshToken) {
            res.setHeader('Set-Cookie', `spotify_refresh_token=${newRefreshToken}; HttpOnly; Secure; Path=/; SameSite=Strict; Max-Age=31536000`);
        }

        res.status(200).json({
            access_token,
            expires_in,
        });

    } catch (error) {
        console.error('Error refreshing token with Spotify:', error.response ? error.response.data : error.message);
        const status = error.response?.status || 500;
        const details = error.response?.data || { message: 'An unknown error occurred while refreshing token' };
        
        if (error.response?.data?.error === 'invalid_grant') {
            res.setHeader('Set-Cookie', 'spotify_refresh_token=; HttpOnly; Secure; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
            return res.status(401).json({ error: 'Invalid refresh token', details });
        }
        res.status(status).json({
            error: 'Failed to refresh token with Spotify',
            details,
        });
    }
}
