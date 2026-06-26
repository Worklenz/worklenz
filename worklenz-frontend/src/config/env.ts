/**
 * Environment configuration
 * Reads from window environment variables (set by env-config.js)
 * Falls back to import.meta.env variables (set during build time)
 * Falls back to development defaults
 */

declare global {
  interface Window {
    VITE_API_URL?: string;
    VITE_SOCKET_URL?: string;
    VITE_CLIENT_PORTAL_URL?: string;
  }
}

export const getApiUrl = (): string => {
  // First check runtime-injected environment variables
  if (window.VITE_API_URL) {
    return window.VITE_API_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }

  // Fallback for deployed environments when VITE_API_URL is not injected.
  // Example: ncinga.worklenz.com -> api.ncinga.worklenz.com
  // Example: app.worklenz.com -> api.worklenz.com
  const { protocol, hostname } = window.location;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  if (!isLocalhost && hostname.includes('.')) {
    if (hostname.startsWith('app.')) {
      return `${protocol}//api.${hostname.slice(4)}`;
    }

    if (!hostname.startsWith('api.')) {
      return `${protocol}//api.${hostname}`;
    }
  }

  // Default for local development
  return 'http://localhost:3000';
};

export const getSocketUrl = (): string => {
  // First check runtime-injected environment variables
  if (window.VITE_SOCKET_URL) {
    return window.VITE_SOCKET_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL;
  }

  // Default based on API URL (convert http->ws or https->wss)
  const apiUrl = getApiUrl();
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }

  // Final fallback
  return 'ws://localhost:3000';
};

/**
 * Get client portal base URL based on current environment
 * Matches the backend getClientPortalBaseUrl() logic
 */
export const getClientPortalBaseUrl = (): string => {
  // First check runtime-injected environment variables
  if (window.VITE_CLIENT_PORTAL_URL) {
    return window.VITE_CLIENT_PORTAL_URL;
  }

  // Then check build-time environment variables
  if (import.meta.env.VITE_CLIENT_PORTAL_URL) {
    return import.meta.env.VITE_CLIENT_PORTAL_URL;
  }

  // Derive from current window location
  const hostname = window.location.hostname;
  const protocol = window.location.protocol;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

  if (isLocalhost) {
    // For local development, client portal runs on port 5174
    return 'http://localhost:5174';
  }

  // For production/UST, derive from current hostname
  // If on app.worklenz.com, client portal might be on client.worklenz.com
  // Or use the same hostname with different subdomain
  if (hostname.includes('worklenz.com')) {
    // Replace 'app' with 'client' or use the same hostname
    const clientHostname = hostname
      .replace('app.', 'client.')
      .replace('worklenz.com', 'worklenz.com');
    return `${protocol}//${clientHostname}`;
  }

  // For other environments (UST, etc.), use the same hostname
  // The backend will handle the actual CLIENT_PORTAL_HOSTNAME
  // This is a fallback - ideally VITE_CLIENT_PORTAL_URL should be set
  return `${protocol}//${hostname}`;
};

export default {
  apiUrl: getApiUrl(),
  socketUrl: getSocketUrl(),
  clientPortalBaseUrl: getClientPortalBaseUrl(),
};
