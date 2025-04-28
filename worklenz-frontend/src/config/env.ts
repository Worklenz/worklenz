/**
 * Environment configuration
 * Reads from window.VITE_API_URL (set by env-config.js)
 * Falls back to import.meta.env.VITE_API_URL (set during build time)
 * Falls back to a development default
 */

declare global {
  interface Window {
    VITE_API_URL?: string;
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

export default {
  apiUrl: getApiUrl(),
}; 