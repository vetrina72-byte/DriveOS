import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.spotify.com/v1' // NESSUNO SLASH ALLA FINE
});

// A queue to hold requests while the token is being refreshed
let failedQueue: { resolve: (value?: any) => void; reject: (reason?: any) => void; }[] = [];
let isRefreshing = false;

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

// Interceptor to handle expired tokens
apiClient.interceptors.response.use(
  (response) => response, // Pass through successful responses
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't already retried this request
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // If a refresh is already in progress, queue this request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
        .then(token => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;
      
      try {
        // Call our backend to get a new access token using the HttpOnly cookie
        const { data } = await axios.post('/api/refresh-token', {}, {
          withCredentials: true, // This is crucial to send the cookie
        });

        const { access_token: newAccessToken, expires_in } = data;
        const expiresAt = Date.now() + expires_in * 1000;

        // Save the new token and expiry
        localStorage.setItem('spotify_access_token', newAccessToken);
        localStorage.setItem('spotify_expires_in', String(expiresAt));

        // Update the default header for subsequent requests
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        // Retry all queued requests with the new token
        failedQueue.forEach(prom => prom.resolve(newAccessToken));
        failedQueue = [];
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // The refresh failed (e.g., refresh token expired or was revoked)
        console.error("Token refresh failed. Logging out.", refreshError);
        failedQueue.forEach(prom => prom.reject(refreshError));
        failedQueue = [];
        
        // Force logout
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

export default apiClient;