import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.spotify.com/v1' // NESSUNO SLASH ALLA FINE
});

// Interceptor to add the token to every request
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('spotify_access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/*
// --- Robust Token Refresh Logic ---
// THIS INTERCEPTOR IS NOW DEPRECATED AND REPLACED BY LOGIC IN AuthContext.tsx
let isRefreshing = false;
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void; }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};


// Interceptor to handle expired tokens and automatically refresh them
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if the error is a 401 Unauthorized and we haven't retried yet.
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If a token refresh is already in progress, queue this request.
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest); // Retry the original request with the new token
        });
      }

      originalRequest._retry = true; // Mark that we've attempted a retry
      isRefreshing = true;

      try {
        // Call our backend to get a new access token using the HttpOnly cookie
        const { data } = await axios.post('/api/refresh-token', {}, {
          withCredentials: true, // Crucial for sending the HttpOnly cookie
        });

        const { access_token: newAccessToken, expires_in } = data;
        const expiresAt = Date.now() + expires_in * 1000;

        // Save the new token and expiry time
        localStorage.setItem('spotify_access_token', newAccessToken);
        localStorage.setItem('spotify_expires_in', String(expiresAt));

        // Update the default headers for all subsequent requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        // Retry all queued requests with the new token
        processQueue(null, newAccessToken);

        // Retry the original failed request
        return apiClient(originalRequest);
      } catch (refreshError) {
        // The refresh failed (e.g., refresh token expired or was revoked)
        console.error("Token refresh failed. Logging out.", refreshError);
        processQueue(refreshError, null);
        
        // Force logout and redirect to re-authenticate
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_expires_in');
        window.location.href = '/'; // Redirect to home to force re-login

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // For all other errors, reject the promise
    return Promise.reject(error);
  }
);
*/

export default apiClient;