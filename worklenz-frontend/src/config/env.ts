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
  // PPM-OVERRIDE: Check runtime env vars first. Empty string is valid (same-origin proxy).
  if (typeof window.VITE_API_URL === 'string') {
    return window.VITE_API_URL;
  }

  // Then check build-time environment variables (skip placeholders)
  const buildTimeUrl = import.meta.env.VITE_API_URL;
  if (buildTimeUrl && !buildTimeUrl.startsWith('__')) {
    return buildTimeUrl;
  }

  // Default for development
  return 'http://localhost:3000';
};

export const getSocketUrl = (): string => {
  // PPM-OVERRIDE: Check runtime env vars first. Empty string is valid (same-origin proxy).
  if (typeof window.VITE_SOCKET_URL === 'string') {
    return window.VITE_SOCKET_URL;
  }

  // Then check build-time environment variables (skip placeholders)
  const buildTimeUrl = import.meta.env.VITE_SOCKET_URL;
  if (buildTimeUrl && !buildTimeUrl.startsWith('__')) {
    return buildTimeUrl;
  }

  // Default based on API URL (convert http->ws or https->wss)
  const apiUrl = getApiUrl();
  if (apiUrl.startsWith('https://')) {
    return apiUrl.replace('https://', 'wss://');
  } else if (apiUrl.startsWith('http://')) {
    return apiUrl.replace('http://', 'ws://');
  }

  // Final fallback — empty string means same-origin
  return '';
};

export default {
  apiUrl: getApiUrl(),
  socketUrl: getSocketUrl(),
};
