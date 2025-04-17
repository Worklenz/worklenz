import axios, { AxiosError } from 'axios';

import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';

export const getCsrfToken = (): string | null => {
  const match = document.cookie.split('; ').find(cookie => cookie.startsWith('XSRF-TOKEN='));

  if (!match) {
    return null;
  }
  return decodeURIComponent(match.split('=')[1]);
};

// Function to refresh CSRF token if needed
export const refreshCsrfToken = async (): Promise<string | null> => {
  try {
    // Make a GET request to the server to get a fresh CSRF token
    await axios.get(`${import.meta.env.VITE_API_URL}/csrf-token`, { withCredentials: true });
    return getCsrfToken();
  } catch (error) {
    console.error('Failed to refresh CSRF token:', error);
    return null;
  }
};

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  config => {
    const token = getCsrfToken();
    if (token) {
      config.headers['X-CSRF-Token'] = token;
    } else {
      console.warn('No CSRF token found');
    }
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
    if (errorResponse?.status === 403 && 
        (typeof errorResponse.data === 'object' && 
         errorResponse.data !== null && 
         'message' in errorResponse.data && 
         errorResponse.data.message === 'Invalid CSRF token' || 
         (error as any).code === 'EBADCSRFTOKEN')) {
      alertService.error('Security Error', 'Invalid security token. Refreshing your session...');
      
      // Try to refresh the CSRF token and retry the request
      const newToken = await refreshCsrfToken();
      if (newToken && error.config) {
        // Update the token in the failed request
        error.config.headers['X-CSRF-Token'] = newToken;
        // Retry the original request with the new token
        return axios(error.config);
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
