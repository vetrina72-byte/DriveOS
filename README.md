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

### Backend (for Spotify Authentication)

This project includes a small Node.js server to handle the Spotify authentication flow securely.

1.  **Create an environment file**: Create a file named `.env` in the root of the project.
2.  **Add credentials**: Add your Spotify application credentials and the local redirect URI to the `.env` file. You can get the client ID and secret from the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard). You will also need an API key from [MapTiler](https://www.maptiler.com/cloud/) for the "Dark Matter" night map style.

    ```
    # .env
    SPOTIFY_CLIENT_ID=ecc9e126d442404b92e8081c7d95ecca
    SPOTIFY_CLIENT_SECRET=YOUR_SPOTIFY_CLIENT_SECRET
    VITE_REDIRECT_URI=http://localhost:5173/api/spotify-callback
    MAPTILER_API_KEY=YOUR_MAPTILER_API_KEY
    ```

3.  **Run the server**: In a **separate terminal window**, start the backend server:
    `npm run server`

    The server will run on `http://localhost:8888`.

4.  **Configure Spotify Redirect URI**: In your Spotify Developer Dashboard, go to your application's settings and make sure you have added the following URL to your "Redirect URIs":
    `http://localhost:5173/api/spotify-callback`

    For production (e.g., on Vercel), you will need to set these same environment variables in your deployment settings. The `VITE_REDIRECT_URI` must be your full production URL, including the `/api/spotify-callback` path. For example: `https://your-app-name.vercel.app/api/spotify-callback`.