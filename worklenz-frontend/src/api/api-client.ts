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

    // Import operations (auto-map, ingest, commit) can legitimately take longer than our default timeout.
    // Keep the global timeout low for normal API calls, but relax it for import endpoints.
    const IMPORT_TIMEOUT_MS = 180_000; // 3 minutes
    const isImportEndpoint = (config.url || '').includes('/api/v1/imports');
    if (isImportEndpoint) {
      config.timeout = Math.max(Number(config.timeout || 0), IMPORT_TIMEOUT_MS);
    }

    // Attachment uploads send the file as a base64-encoded JSON body, which is
    // significantly larger than the raw file (base64 inflates by ~33%). On slower
    // connections a file just over 1 MB can easily exceed the default 30 s timeout
    // before the backend finishes writing to S3/Azure and responds.
    // Give attachment POSTs a generous 5-minute window to accommodate large files
    // and variable network/storage latency.
    const ATTACHMENT_UPLOAD_TIMEOUT_MS = 300_000; // 5 minutes
    const isAttachmentUpload =
      config.method?.toLowerCase() === 'post' &&
      (config.url || '').includes('/attachments/tasks');
    if (isAttachmentUpload) {
      config.timeout = Math.max(Number(config.timeout || 0), ATTACHMENT_UPLOAD_TIMEOUT_MS);
    }

    // Skip CSRF token for GET requests to /csrf-token endpoint (circular dependency)
    const isCsrfTokenEndpoint = config.url?.includes('/csrf-token');
    const isGetRequest = config.method?.toLowerCase() === 'get';

    // Only add CSRF token to state-changing requests (POST, PUT, DELETE, PATCH)
    const isStateChanging = ['post', 'put', 'delete', 'patch'].includes(
      config.method?.toLowerCase() || ''
    );

    if (isStateChanging && !isCsrfTokenEndpoint) {
      // Skip token check for retries - they already have the token in headers
      const isRetry = (config as any)?._retryCount > 0;

      if (!isRetry) {
        // Ensure we have a CSRF token before making state-changing requests
        if (!csrfToken) {
          // If initialization is in progress, wait for it
          if (tokenInitializationPromise) {
            const token = await tokenInitializationPromise;
            // Verify we got a token after waiting
            if (!token && !csrfToken) {
              console.warn('[CSRF] Token refresh returned null, attempting to refresh again');
              tokenInitializationPromise = refreshCsrfToken();
              const refreshedToken = await tokenInitializationPromise;
              tokenInitializationPromise = null;
              if (!refreshedToken) {
                console.error('[CSRF] Failed to obtain CSRF token after retry');
              }
            }
          } else {
            // Otherwise, refresh now
            tokenInitializationPromise = refreshCsrfToken();
            const token = await tokenInitializationPromise;
            tokenInitializationPromise = null;
            // Verify we got a token
            if (!token) {
              console.error('[CSRF] Failed to obtain CSRF token - request may fail');
            }
          }
        }
      }

      // For retries, use the token from headers (already set in error handler)
      // For new requests, use the stored token
      const tokenToUse = isRetry ? config.headers?.['X-CSRF-Token'] : csrfToken;

      if (tokenToUse) {
        config.headers = config.headers || {};
        config.headers['X-CSRF-Token'] = tokenToUse;
      } else if (!isRetry) {
        // Log warning if we don't have a token (backend will return proper error)
        console.warn('[CSRF] No CSRF token available for request:', config.method, config.url);
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
    // Check for CSRF errors in multiple ways to ensure we catch them
    const isCsrfError =
      errorResponse?.status === 403 &&
      // Check error code
      ((error as any).code === 'EBADCSRFTOKEN' ||
        // Check response message
        (typeof errorResponse.data === 'object' &&
          errorResponse.data !== null &&
          'message' in errorResponse.data &&
          typeof errorResponse.data.message === 'string' &&
          (errorResponse.data.message.toLowerCase().includes('csrf') ||
            errorResponse.data.message.toLowerCase().includes('invalid csrf') ||
            errorResponse.data.message === 'Invalid CSRF token')) ||
        // Check error message in response body (alternative format)
        (typeof errorResponse.data === 'string' &&
          errorResponse.data.toLowerCase().includes('csrf')));

    if (isCsrfError) {
      // Check if this is already a retry
      const retryCount = (error.config as any)?._retryCount || 0;

      // Prevent infinite retry loops
      if (retryCount >= 2) {
        alertService.error(
          'Security Error',
          'Unable to refresh security token. Please log in again.'
        );
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
        alertService.error(
          'Security Error',
          'Unable to refresh security token. Please log in again.'
        );
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
        alertService.warning('Authentication Required', 'Please log in to accept this team invitation');
        // Add delay so user can see the warning message
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 2000);
      } else if (projectInviteMatch) {
        const token = projectInviteMatch[1];
        invitationRedirectService.storePendingInvitation(token, 'project', currentPath);
        console.log('[API] Stored project invitation context before 401 redirect');
        alertService.warning('Authentication Required', 'Please log in to accept this project invitation');
        // Add delay so user can see the warning message
        setTimeout(() => {
          window.location.href = '/auth/login';
        }, 2000);
      } else {
        alertService.error('Session Expired', 'Please log in again');
        // Redirect immediately for non-invitation pages
        window.location.href = '/auth/login';
      }

      return Promise.reject(error);
    }

    // Add 403 forbidden handling for project access
    if (error.response?.status === 403) {
      const errorData = error.response.data as any;
      const errorMessage = errorData?.message || 'Access denied';

      // Check if this is a project access error - don't show alert, let component handle it
      if (errorMessage.toLowerCase().includes('project') || errorData?.body?.requiresTeamSwitch) {
        // Suppress alert - the project-view component will show appropriate messages
        return Promise.reject(error);
      }

      // For other 403 errors, show alert
      alertService.error('Access Denied', errorMessage);
      return Promise.reject(error);
    }

    const errorMessage = (errorResponse?.data as any)?.message || message || 'An unexpected error occurred';
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
