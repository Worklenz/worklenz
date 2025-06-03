import React from 'react';

// Ensure React is available globally before any @dnd-kit imports
if (typeof globalThis !== 'undefined') {
  (globalThis as any).React = React;
}

// Re-export @dnd-kit utilities with React dependency assured
export * from '@dnd-kit/core';
export * from '@dnd-kit/sortable';
export * from '@dnd-kit/modifiers';
export * from '@dnd-kit/utilities'; 