import axios, { AxiosError } from 'axios';

import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';
import config from '@/config/env';
import { invitationRedirectService } from '@/services/invitation-redirect.service';

// Store CSRF token in memory (since csrf-sync uses session-based tokens)
let csrfToken: string | null = null;
// Track token initialization promise to prevent race conditions
let tokenInitializationPromise: Promise<string | null> | null = null;

export const getCsrfToken = (): string | null => {
  return csrfToken;
};

// Function to refresh CSRF token from server
export const refreshCsrfToken = async (): Promise<string | null> => {
  try {
    // Make a GET request to the server to get a fresh CSRF token with timeout
    // Use a separate axios instance to avoid circular dependency with interceptors
    const response = await axios.get(`${config.apiUrl}/csrf-token`, {
      withCredentials: true,
      timeout: 10000, // 10 second timeout for CSRF token requests
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });

    if (response.data && response.data.token) {
      csrfToken = response.data.token;
      return csrfToken;
    } else {
      // Check if token is in response headers
      const tokenFromHeader = response.headers['x-csrf-token'];
      if (tokenFromHeader) {
        csrfToken = tokenFromHeader;
        return csrfToken;
      }
    }
    return null;
  } catch (error: any) {
    console.error('[CSRF] Failed to refresh CSRF token:', error);
    return null;
  }
};

// Initialize CSRF token on app load
export const initializeCsrfToken = async (): Promise<void> => {
  if (!csrfToken) {
    // If initialization is already in progress, wait for it
    if (tokenInitializationPromise) {
      await tokenInitializationPromise;
      return;
    }
    
    // Start initialization
    tokenInitializationPromise = refreshCsrfToken();
    await tokenInitializationPromise;
    tokenInitializationPromise = null;
  }
};

// Ensure CSRF token is available, with deduplication to prevent concurrent refresh requests
export const ensureCsrfToken = async (): Promise<string | null> => {
  // If we already have a token, return it
  if (csrfToken) {
    return csrfToken;
  }

  // If initialization is already in progress, wait for it
  if (tokenInitializationPromise) {
    const token = await tokenInitializationPromise;
    return token;
  }

  // Otherwise, start a new refresh
  try {
    tokenInitializationPromise = refreshCsrfToken();
    const token = await tokenInitializationPromise;
    tokenInitializationPromise = null;
    return token;
  } catch (error) {
    tokenInitializationPromise = null;
    throw error;
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

    // Skip CSRF token for GET requests to /csrf-token endpoint (circular dependency)
    const isCsrfTokenEndpoint = config.url?.includes('/csrf-token');
    const isGetRequest = config.method?.toLowerCase() === 'get';
    
    // Only add CSRF token to state-changing requests (POST, PUT, DELETE, PATCH)
    const isStateChanging = ['post', 'put', 'delete', 'patch'].includes(config.method?.toLowerCase() || '');
    
    if (isStateChanging && !isCsrfTokenEndpoint) {
      // Skip token check for retries - they already have the token in headers
      const isRetry = (config as any)?._retryCount > 0;
      
      if (!isRetry) {
        // Ensure we have a CSRF token before making state-changing requests
        if (!csrfToken) {
          // If initialization is in progress, wait for it
          if (tokenInitializationPromise) {
            await tokenInitializationPromise;
          } else {
            // Otherwise, refresh now
            tokenInitializationPromise = refreshCsrfToken();
            await tokenInitializationPromise;
            tokenInitializationPromise = null;
          }
        }
      }

      // For retries, use the token from headers (already set in error handler)
      // For new requests, use the stored token
      const tokenToUse = isRetry ? config.headers?.['X-CSRF-Token'] : csrfToken;
      
      if (tokenToUse) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = tokenToUse;
      }
    }

    const requestEnd = performance.now();

    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor with notification handling based on done flag
apiClient.interceptors.response.use(
  response => {
    // TEMPORARY: Disable CSRF token rotation to prevent race conditions with concurrent requests
    // Token rotation causes issues when multiple requests are in flight
    // The token is still validated, but won't rotate after each request
    
    // Handle CSRF token rotation from successful responses
    // Check for new token in response header (from CSRF rotation middleware)
    // const newTokenFromHeader = response.headers['x-csrf-token'];
    // if (newTokenFromHeader) {
    //   csrfToken = newTokenFromHeader;
    //   console.log('[CSRF] Token rotated from response header');
    // }
    
    // Check for new token in response body (from CSRF rotation middleware)
    // if (response.data && typeof response.data === 'object' && response.data.csrfToken) {
    //   csrfToken = response.data.csrfToken;
    //   console.log('[CSRF] Token rotated from response body');
    // }

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

      // Don't show alerts for CSRF token rotation responses (they're just metadata)
      const isCsrfTokenResponse = response.config?.url?.includes('/csrf-token');
      
      // Don't show error alerts for successful retries (they were already handled)
      const isRetry = (response.config as any)?._retryCount > 0;
      
      if (!isCsrfTokenResponse && message && message.charAt(0) !== '$') {
        // For retried requests, only show success messages, not errors
        // (errors were already handled in the error interceptor)
        if (isRetry && !done) {
          // Suppress error alert for successful retry
        } else if (done) {
          alertService.success(title || '', message);
        } else {
          alertService.error(title || '', message);
        }
      } else if (auth_error && !isRetry) {
        // Don't show auth errors for retries (they're likely false positives)
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
        typeof errorResponse.data.message === 'string' &&
        (errorResponse.data.message.toLowerCase().includes('csrf') ||
          errorResponse.data.message.toLowerCase().includes('invalid') ||
          errorResponse.data.message === 'Invalid CSRF token')) ||
        (error as any).code === 'EBADCSRFTOKEN')
    ) {
      // Check if this is already a retry
      const retryCount = (error.config as any)?._retryCount || 0;
      
      // Prevent infinite retry loops
      if (retryCount >= 2) {
        alertService.error('Security Error', 'Unable to refresh security token. Please log in again.');
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }

        // Try to refresh the CSRF token and retry the request
        // For CSRF errors, we need to force a refresh (token is invalid)
        // Use deduplication pattern to prevent concurrent refresh requests
        let newToken: string | null = null;
        if (tokenInitializationPromise) {
          // If refresh is already in progress, wait for it
          newToken = await tokenInitializationPromise;
        } else {
          // Start a new refresh
          try {
            tokenInitializationPromise = refreshCsrfToken();
            newToken = await tokenInitializationPromise;
            tokenInitializationPromise = null;
          } catch (refreshError) {
            tokenInitializationPromise = null;
            console.error('[CSRF] Failed to refresh CSRF token in error handler:', refreshError);
          }
        }
        
        if (newToken && error.config) {
          // Token is already updated in refreshCsrfToken, no need to update here
          
          // Mark that we're retrying
          (error.config as any)._retryCount = retryCount + 1;
          
          // Create a fresh config to avoid any issues with the original error config
          // Make sure to preserve the original config but update headers
          const retryConfig = {
            ...error.config,
            headers: {
              ...error.config.headers,
              'X-CSRF-Token': newToken,
            },
            // Clear any retry flags that might interfere
            _retryCount: retryCount + 1,
          };
          
          // Retry the original request with the new token
          try {
            const retryResponse = await apiClient(retryConfig);
            return retryResponse;
          } catch (retryError: any) {
            // If retry also fails, show error and handle
            if (retryError.response?.status === 403) {
              // Still CSRF error after retry - likely session issue
              alertService.error('Security Error', 'Session expired. Please log in again.');
              window.location.href = '/auth/login';
            }
            return Promise.reject(retryError);
          }
        } else {
          // If token refresh failed, redirect to login
          alertService.error('Security Error', 'Unable to refresh security token. Please log in again.');
          window.location.href = '/auth/login';
          return Promise.reject(error);
        }
    }

    // Add 401 unauthorized handling
    if (error.response?.status === 401) {
      // Check if we're on an invite page and preserve the context
      const currentPath = window.location.pathname;
      const teamInviteMatch = currentPath.match(/^\/invite\/team\/([^/]+)$/);
      const projectInviteMatch = currentPath.match(/^\/invite\/project\/([^/]+)$/);

      if (teamInviteMatch) {
        const token = teamInviteMatch[1];
        invitationRedirectService.storePendingInvitation(token, 'team', currentPath);
        console.log('[API] Stored team invitation context before 401 redirect');
      } else if (projectInviteMatch) {
        const token = projectInviteMatch[1];
        invitationRedirectService.storePendingInvitation(token, 'project', currentPath);
        console.log('[API] Stored project invitation context before 401 redirect');
      }

      alertService.error('Session Expired', 'Please log in again');
      // Redirect to login page or trigger re-authentication
      window.location.href = '/auth/login';
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
