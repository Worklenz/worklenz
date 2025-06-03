import React from 'react';

// Polyfill React hooks globally to prevent undefined errors in dependencies
if (typeof window !== 'undefined') {
  // Ensure React is available globally
  (window as any).React = React;
}

// Also ensure it's available in globalThis for ES modules
if (typeof globalThis !== 'undefined') {
  (globalThis as any).React = React;
} 