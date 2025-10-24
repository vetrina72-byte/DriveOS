export default function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).json({ message: 'Method Not Allowed' });
    }
    // Pulisce il cookie impostando una data di scadenza nel passato.
    let cookieString = 'spotify_refresh_token=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
    if (process.env.NODE_ENV === 'production') {
        cookieString += '; Secure';
    }
    res.setHeader('Set-Cookie', cookieString);
    res.status(200).json({ message: 'Logged out successfully' });
}