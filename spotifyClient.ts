
import axios from 'axios';
import { getSessionId } from './lib/sessionId';

const apiClient = axios.create({
  baseURL: 'https://api.spotify.com/v1'
});

// Request interceptor to add access token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken') || localStorage.getItem('spotify_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to automatically renew expired tokens on 401
let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('spotify_refresh_token');
      const sessionId = getSessionId();

      try {
        const refreshResp = await axios.post('/api/refresh-token', {
          refreshToken,
          sessionId
        }, {
          headers: {
            'x-session-id': sessionId
          }
        });

        const data = refreshResp.data;
        if (data?.access_token) {
          const newToken = data.access_token;
          localStorage.setItem('accessToken', newToken);
          localStorage.setItem('spotify_access_token', newToken);
          if (data.expires_at) {
            localStorage.setItem('expiresAt', String(data.expires_at));
            localStorage.setItem('spotify_token_expiry', String(data.expires_at));
          }
          if (data.refresh_token) {
            localStorage.setItem('spotify_refresh_token', data.refresh_token);
          }

          apiClient.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
          processQueue(null, newToken);
          isRefreshing = false;

          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        } else {
          throw new Error('No access_token returned');
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        console.warn('⚠️ Token refresh failed on 401, clearing auth session');
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

