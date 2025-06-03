import { useLayoutEffect, useEffect } from 'react';

// Use useLayoutEffect in browser environments and useEffect in SSR environments
// with additional safety checks to ensure React hooks are available
const useIsomorphicLayoutEffect = (() => {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    // Server-side: return useEffect (which won't execute anyway)
    return useEffect;
  }
  
  // Client-side: ensure React hooks are available
  try {
    if (useLayoutEffect && typeof useLayoutEffect === 'function') {
      return useLayoutEffect;
    }
  } catch (error) {
    console.warn('useLayoutEffect not available, falling back to useEffect:', error);
  }
  
  // Fallback to useEffect if useLayoutEffect is not available
  return useEffect;
})();

export default useIsomorphicLayoutEffect; 