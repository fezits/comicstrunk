import axios from 'axios';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1',
  withCredentials: true, // Send cookies with requests (httpOnly refresh token)
});

// In-memory access token storage (never in localStorage for XSS protection)
let accessToken: string | null = null;

// Single refresh promise to coordinate concurrent 401 handling
let refreshPromise: Promise<string> | null = null;

/**
 * Set the in-memory access token.
 * Called after login/signup or after a successful token refresh.
 */
export function setAccessToken(token: string | null): void {
  accessToken = token;
}

/**
 * Get the current in-memory access token.
 * Useful for checking auth state without making an API call.
 */
export function getAccessToken(): string | null {
  return accessToken;
}

// Request interceptor: attach Bearer token to all requests
apiClient.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Response interceptor: handle 401 with coordinated single refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 and only once per request
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      // Coordinate: only one refresh call at a time
      // All concurrent 401s wait for the same promise
      if (!refreshPromise) {
        refreshPromise = apiClient
          .post('/auth/refresh')
          .then((res) => {
            const newToken = res.data.data.accessToken;
            setAccessToken(newToken);
            refreshPromise = null;
            return newToken;
          })
          .catch((refreshError) => {
            // Refresh failed: clear token and redirect to login
            setAccessToken(null);
            refreshPromise = null;

            if (typeof window !== 'undefined') {
              window.location.href = '/pt-BR/login';
            }

            throw refreshError;
          });
      }

      // Wait for the coordinated refresh to complete
      const newToken = await refreshPromise;
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    }

    return Promise.reject(error);
  }
);

export { apiClient };
export default apiClient;
