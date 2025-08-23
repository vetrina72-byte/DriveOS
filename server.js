import express from 'express';
import cors from 'cors';
import 'dotenv/config';
// Import handlers from the new api directory
import exchangeTokenHandler from './api/exchange-token.js';
import refreshTokenHandler from './api/refresh-token.js';

const app = express();
const port = 8888;

const allowedOrigins = [
  'http://localhost:5173',
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  'https://drive-os-hc1q.vercel.app'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Origin '${origin}' not allowed by CORS`));
    }
  }
}));
app.use(express.json());

// Route requests to the imported handlers
app.post('/api/exchange-token', exchangeTokenHandler);
app.post('/api/refresh-token', refreshTokenHandler);

app.listen(port, () => {
  console.log(`Local dev server running at http://localhost:${port}`);
  console.log('This server uses the same logic as the Vercel Serverless Functions.');
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      console.warn('WARNING: SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is not set. Authentication will fail.');
  }
});
