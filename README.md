# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js

### Frontend

1.  **Install dependencies**:
    `npm install`
2.  **Set Environment Variables**: Create a file named `.env.local` and add your Gemini API key:
    ```
    GEMINI_API_KEY=YOUR_GEMINI_API_KEY
    ```
3.  **Run the app**:
    `npm run dev`

    The frontend will run on `http://localhost:5173` (or another port if 5173 is busy).

### Spotify Integration

This project uses the Spotify Web Playback SDK. For the authentication to work, you need a Spotify application.

1.  **Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)** and create a new application.
2.  **Copy your Client ID**: You will find this on your application's dashboard. The code uses `ecc9e126d442404b92e8081c7d95ecca` by default, which you should replace with your own if you wish.
3.  **Configure Spotify Redirect URI**: In your Spotify application's settings, make sure you have added the following URL to your "Redirect URIs":
    `http://localhost:5173/spotify-callback`

The authentication flow uses the secure "Authorization Code Flow with PKCE" and does not require a backend server or a client secret.