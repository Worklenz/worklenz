import { useCallback, useMemo, useRef, useEffect, useState } from 'react';
import { useAppSelector } from './useAppSelector';
import { debounce, throttle } from 'lodash';

// Performance optimization utilities
export const usePerformanceOptimization = () => {
  const renderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(0);

  // Track render performance
  const trackRender = useCallback((componentName: string) => {
    renderCountRef.current += 1;
    const now = performance.now();
    const timeSinceLastRender = now - lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;

    if (process.env.NODE_ENV === 'development') {
      console.log(
        `[${componentName}] Render #${renderCountRef.current}, Time since last: ${timeSinceLastRender.toFixed(2)}ms`
      );

      if (timeSinceLastRender < 16) {
        // Less than 60fps
        console.warn(`[${componentName}] Potential over-rendering detected`);
      }
    }
  }, []);

  // Debounced callback creator
  const createDebouncedCallback = useCallback(
    <T extends (...args: any[]) => any>(callback: T, delay: number = 300) => {
      return debounce(callback, delay);
    },
    []
  );

  // Throttled callback creator
  const createThrottledCallback = useCallback(
    <T extends (...args: any[]) => any>(callback: T, delay: number = 100) => {
      return throttle(callback, delay);
    },
    []
  );

  return {
    trackRender,
    createDebouncedCallback,
    createThrottledCallback,
  };
};

// Optimized selector hook to prevent unnecessary re-renders
export const useOptimizedSelector = <T>(
  selector: (state: any) => T,
  equalityFn?: (left: T, right: T) => boolean
) => {
  const defaultEqualityFn = useCallback((left: T, right: T) => {
    // Deep equality check for objects and arrays
    if (typeof left === 'object' && typeof right === 'object') {
      return JSON.stringify(left) === JSON.stringify(right);
    }
    return left === right;
  }, []);

  return useAppSelector(selector, equalityFn || defaultEqualityFn);
};

// Memoized component props
export const useMemoizedProps = <T extends Record<string, any>>(props: T): T => {
  return useMemo(() => props, Object.values(props));
};

// Optimized event handlers
export const useOptimizedEventHandlers = <T extends Record<string, (...args: any[]) => any>>(
  handlers: T
) => {
  return useMemo(() => {
    const optimizedHandlers = {} as any;

    Object.entries(handlers).forEach(([key, handler]) => {
      optimizedHandlers[key] = useCallback(handler, [handler]);
    });

    return optimizedHandlers as T;
  }, [handlers]);
};

// Virtual scrolling utilities
export const useVirtualScrolling = (
  itemCount: number,
  itemHeight: number,
  containerHeight: number
) => {
  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(window.scrollY / itemHeight);
    const endIndex = Math.min(startIndex + Math.ceil(containerHeight / itemHeight) + 1, itemCount);

    return { startIndex: Math.max(0, startIndex), endIndex };
  }, [itemCount, itemHeight, containerHeight]);

  return visibleRange;
};

// Image lazy loading hook
export const useLazyLoading = (threshold: number = 0.1) => {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const targetRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) observerRef.current.disconnect();

      if (node) {
        observerRef.current = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observerRef.current?.disconnect();
            }
          },
          { threshold }
        );
        observerRef.current.observe(node);
      }
    },
    [threshold]
  );

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return { targetRef, isVisible };
};

// Memory optimization for large datasets
export const useMemoryOptimization = <T>(data: T[], maxCacheSize: number = 1000) => {
  const cacheRef = useRef(new Map<string, T>());

  const optimizedData = useMemo(() => {
    if (data.length <= maxCacheSize) {
      return data;
    }

    // Keep only the most recently accessed items
    const cache = cacheRef.current;
    const recentData = data.slice(0, maxCacheSize);

    // Clear old cache entries
    cache.clear();
    recentData.forEach((item, index) => {
      cache.set(String(index), item);
    });

    return recentData;
  }, [data, maxCacheSize]);

  return optimizedData;
};

export default usePerformanceOptimization;
