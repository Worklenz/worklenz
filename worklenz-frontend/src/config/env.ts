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

  // Default for development
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

  // Default based on API host (convert http->ws or https->wss)
  const apiUrl = getApiUrl();
  try {
    const api = new URL(apiUrl);
    const protocol = api.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${api.host}`;
  } catch {
    // Final fallback
    return 'ws://localhost:3000';
  }
};

export default {
  apiUrl: getApiUrl(),
  socketUrl: getSocketUrl(),
};
