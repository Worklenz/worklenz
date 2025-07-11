import axios, { AxiosError } from 'axios';

import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';
import config from '@/config/env';

// Store CSRF token in memory (since csrf-sync uses session-based tokens)
let csrfToken: string | null = null;

export const getCsrfToken = (): string | null => {
  return csrfToken;
};

// Function to refresh CSRF token from server
export const refreshCsrfToken = async (): Promise<string | null> => {
  try {
    const tokenStart = performance.now();
    console.log('[CSRF] Starting CSRF token refresh...');

    // Make a GET request to the server to get a fresh CSRF token with timeout
    const response = await axios.get(`${config.apiUrl}/csrf-token`, {
      withCredentials: true,
      timeout: 10000, // 10 second timeout for CSRF token requests
    });

    const tokenEnd = performance.now();
    console.log(`[CSRF] CSRF token refresh completed in ${(tokenEnd - tokenStart).toFixed(2)}ms`);

    if (response.data && response.data.token) {
      csrfToken = response.data.token;
      console.log('[CSRF] CSRF token successfully refreshed');
      return csrfToken;
    } else {
      console.warn('[CSRF] No token in response:', response.data);
    }
    return null;
  } catch (error) {
    console.error('[CSRF] Failed to refresh CSRF token:', error);
    return null;
  }
};

// Initialize CSRF token on app load
export const initializeCsrfToken = async (): Promise<void> => {
  if (!csrfToken) {
    await refreshCsrfToken();
  }
};

const apiClient = axios.create({
  baseURL: config.apiUrl,
  withCredentials: true,
  timeout: 30000, // 30 second timeout to prevent hanging requests
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor with performance optimization
apiClient.interceptors.request.use(
  async config => {
    const requestStart = performance.now();

    // Ensure we have a CSRF token before making requests
    if (!csrfToken) {
      const tokenStart = performance.now();
      await refreshCsrfToken();
      const tokenEnd = performance.now();
    }

    if (csrfToken) {
      config.headers['X-CSRF-Token'] = csrfToken;
    } else {
      console.warn('No CSRF token available after refresh attempt');
    }

    const requestEnd = performance.now();

    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor with notification handling based on done flag
apiClient.interceptors.response.use(
  response => {
    // Handle 302 redirect
    if (response.status === 302) {
      const redirectUrl = response.headers.location;
      if (redirectUrl) {
        window.location.href = redirectUrl;
        return response;
      }
    }

    if (response.data) {
      const { title, message, auth_error, done } = response.data;

      if (message && message.charAt(0) !== '$') {
        if (done) {
          alertService.success(title || '', message);
        } else {
          alertService.error(title || '', message);
        }
      } else if (auth_error) {
        alertService.error(title || 'Authentication Error', auth_error);
      }
    }
    return response;
  },
  async (error: AxiosError) => {
    const { message, code, name } = error || {};
    const errorResponse = error.response;

    // Handle CSRF token errors
    if (
      errorResponse?.status === 403 &&
      ((typeof errorResponse.data === 'object' &&
        errorResponse.data !== null &&
        'message' in errorResponse.data &&
        (errorResponse.data.message === 'invalid csrf token' ||
          errorResponse.data.message === 'Invalid CSRF token')) ||
        (error as any).code === 'EBADCSRFTOKEN')
    ) {
      alertService.error('Security Error', 'Invalid security token. Refreshing your session...');

      // Try to refresh the CSRF token and retry the request
      const newToken = await refreshCsrfToken();
      if (newToken && error.config) {
        // Update the token in the failed request
        error.config.headers['X-CSRF-Token'] = newToken;
        // Retry the original request with the new token
        return apiClient(error.config);
      } else {
        // If token refresh failed, redirect to login
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }
    }

    // Add 401 unauthorized handling
    if (error.response?.status === 401) {
      alertService.error('Session Expired', 'Please log in again');
      // Redirect to login page or trigger re-authentication
      window.location.href = '/auth/login'; // Adjust this path as needed
      return Promise.reject(error);
    }

    const errorMessage = message || 'An unexpected error occurred';
    const errorTitle = 'Error';

    if (error.code !== 'ERR_NETWORK') {
      alertService.error(errorTitle, errorMessage);
    }

    // Development logging
    if (import.meta.env.VITE_APP_ENV === 'development') {
      logger.error('API Error:', {
        code,
        name,
        message,
        headers: error.config?.headers,
        cookies: document.cookie,
      });
    }

    return Promise.reject(error);
  }
);

export default apiClient;
