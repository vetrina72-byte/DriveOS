import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.spotify.com/v1' // NESSUNO SLASH ALLA FINE
});

// Interceptor to add the token to every request
apiClient.interceptors.request.use(
  (config) => {
    // FIX: Use 'accessToken' to match the key used in AuthContext.
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;