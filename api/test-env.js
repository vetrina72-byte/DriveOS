module.exports = (req, res) => {
      const clientId = process.env.SPOTIFY_CLIENT_ID;
      const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
      const redirectUri = process.env.VITE_REDIRECT_URI;

      res.status(200).json({
        SPOTIFY_CLIENT_ID_EXISTS: !!clientId,
        SPOTIFY_CLIENT_SECRET_EXISTS: !!clientSecret,
        VITE_REDIRECT_URI_EXISTS: !!redirectUri,
        // Per debug, mostriamo una piccola parte dell'ID per conferma
        CLIENT_ID_SNIPPET: clientId ? clientId.substring(0, 4) + '...' : null,
      });
    };
    