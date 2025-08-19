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

// Interceptor to handle expired tokens
apiClient.interceptors.response.use(
  (response) => response, // Pass through successful responses
  async (error) => {
    const originalRequest = error.config;

    // If the error is 401 and we haven't already retried this request
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('spotify_refresh_token');

      if (!refreshToken) {
        // If there's no refresh token, we can't do anything.
        // Force logout and reload.
        console.error("No refresh token available. Logging out.");
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_expires_in');
        window.location.reload();
        return Promise.reject(error);
      }
      
      try {
        // Call our backend to get a new access token
        const { data } = await axios.post('http://localhost:8888/api/refresh-token', { refreshToken });

        const newAccessToken = data.access_token;

        // Save the new token
        localStorage.setItem('spotify_access_token', newAccessToken);

        // Update the header of the original request and retry it
        apiClient.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
        
        return apiClient(originalRequest);
      } catch (refreshError) {
        // The refresh failed (e.g., refresh token expired)
        console.error("Token refresh failed. Logging out.", refreshError);
        localStorage.removeItem('spotify_access_token');
        localStorage.removeItem('spotify_refresh_token');
        localStorage.removeItem('spotify_expires_in');
        window.location.reload();
        return Promise.reject(refreshError);
      }
    }

    // For all other errors, reject the promise
    return Promise.reject(error);
  }
);

export default apiClient;