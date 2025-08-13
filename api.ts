import axios from 'axios';

// This flag prevents multiple, simultaneous token refresh requests.
let isRefreshing = false;
// A queue for requests that failed with 401, to be retried after token refresh.
let failedQueue: { resolve: (value: unknown) => void; reject: (reason?: any) => void; }[] = [];

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

const apiClient = axios.create({
  baseURL: 'https://api.spotify.com/v1',
});

// This function sets up the interceptors, allowing us to pass the logout function
// from the AuthContext to be used within the interceptor logic.
export const setupInterceptors = (logout: () => void) => {
  apiClient.interceptors.request.use(
    config => {
      const token = localStorage.getItem('spotify_access_token');
      if (token) {
        config.headers['Authorization'] = 'Bearer ' + token;
      }
      return config;
    },
    error => {
      return Promise.reject(error);
    }
  );

  apiClient.interceptors.response.use(
    response => {
      return response;
    },
    async (error) => {
      const originalRequest = error.config;

      // Check for 401 Unauthorized error and ensure it's not a retry.
      if (error.response?.status === 401 && !originalRequest._retry) {
        if (isRefreshing) {
          // If a refresh is already in progress, queue this request to be retried later.
          return new Promise(function(resolve, reject) {
            failedQueue.push({ resolve, reject });
          })
          .then(token => {
              originalRequest.headers['Authorization'] = 'Bearer ' + token;
              return apiClient(originalRequest);
          })
          .catch(err => {
              return Promise.reject(err);
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = localStorage.getItem('spotify_refresh_token');
        if (!refreshToken) {
          logout();
          return Promise.reject(error);
        }

        try {
          // Make a request to our backend to refresh the token.
          const rs = await axios.post('http://localhost:8888/api/refresh-token', {
            refreshToken: refreshToken
          });

          const { access_token } = rs.data;
          localStorage.setItem('spotify_access_token', access_token);
          apiClient.defaults.headers.common['Authorization'] = 'Bearer ' + access_token;
          originalRequest.headers['Authorization'] = 'Bearer ' + access_token;
          
          processQueue(null, access_token); // Retry all queued requests with the new token.
          return apiClient(originalRequest); // Retry the original request.

        } catch (_error) {
          processQueue(_error, null);
          logout(); // If refreshing fails, log the user out.
          return Promise.reject(_error);
        } finally {
          isRefreshing = false;
        }
      }

      // For permission errors (403), force a logout.
      if (error.response?.status === 403) {
        console.error("Permission denied (403). Forcing logout.");
        logout();
      }

      return Promise.reject(error);
    }
  );
};

export default apiClient;
