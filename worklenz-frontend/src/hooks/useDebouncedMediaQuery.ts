import { useState, useEffect, useRef } from 'react';
import { useMediaQuery } from 'react-responsive';

/**
 * Debounced version of useMediaQuery that prevents rapid re-renders during window resize
 * This helps prevent errors when components re-render too quickly during resize events
 *
 * @param query - Media query string or object with query property
 * @param debounceMs - Debounce delay in milliseconds (default: 150ms)
 * @returns boolean indicating if the media query matches
 */
export const useDebouncedMediaQuery = (
  query: string | { query: string },
  debounceMs: number = 150
): boolean => {
  const queryString = typeof query === 'string' ? query : query.query;
  const immediateResult = useMediaQuery({ query: queryString });
  const [debouncedResult, setDebouncedResult] = useState(immediateResult);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastResultRef = useRef(immediateResult);

  useEffect(() => {
    // Update ref immediately
    lastResultRef.current = immediateResult;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Only debounce if the value actually changed
    if (debouncedResult !== immediateResult) {
      // Debounce the state update to prevent rapid re-renders
      timeoutRef.current = setTimeout(() => {
        setDebouncedResult(immediateResult);
      }, debounceMs);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [immediateResult, debounceMs, debouncedResult]);

  // Return the last known stable value to prevent rapid changes during resize
  // This prevents components from breaking due to rapid prop/state changes
  return debouncedResult;
};
